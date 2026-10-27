// lib/git.js — git 命令封装与解析。零依赖;解析函数为纯函数,可独立单测。
//
// 设计原则(见 DESIGN.md §3.1/§3.2):
//  - 只暴露白名单原子操作,不提供任意命令透传;
//  - 路径一律放在 `--` 之后,且校验不含 NUL、非空,杜绝参数注入;
//  - 机器可读输出:status --porcelain=v2 -z(不 quote 中文路径)、固定分隔符 log、numstat;
//  - 执行器 exec 由宿主侧注入(createGit({ exec })),本文件不接触 harness API,可直接单测。

// porcelain v2 状态码含义(X=index/staged,Y=worktree/unstaged)
const STATE_LABEL = {
  '.': 'unmodified', A: 'added', M: 'modified', D: 'deleted',
  R: 'renamed', C: 'copied', T: 'typechange', U: 'unmerged', '?': 'other',
}

/** 路径校验:非空字符串、不含 NUL。所有白名单操作的 path 参数都过这里。 */
export function checkPath(p) {
  if (typeof p !== 'string' || p.length === 0) throw new Error('git-panel: path 必须是非空字符串')
  if (p.includes('\0')) throw new Error('git-panel: path 非法(含 NUL)')
  return p
}

function checkPaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error('git-panel: paths 必须是非空数组')
  return paths.map(checkPath)
}

/**
 * 解析 `git status --porcelain=v2 --branch -z` 输出。
 * -z 格式:记录间以 NUL 分隔;`2`(rename)记录的 origPath 是紧随的独立 NUL 字段;路径不做 quote。
 * 返回:
 * {
 *   branch: { oid, head, upstream, ahead, behind },   // upstream/ahead/behind 可能不存在
 *   staged:    [{ path, x, state, origPath? }],
 *   unstaged:  [{ path, y, state, origPath? }],
 *   untracked: [{ path }],
 *   conflicted:[{ path }],
 * }
 */
export function parseStatusV2(out) {
  const branch = { oid: null, head: null, upstream: null, ahead: null, behind: null }
  const staged = [], unstaged = [], untracked = [], conflicted = []
  const records = (out || '').split('\0')
  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    if (!rec) continue
    if (rec.startsWith('# ')) {
      const m = rec.match(/^# (\S+)\s?(.*)$/)
      if (!m) continue
      const [, key, value] = m
      if (key === 'branch.oid') branch.oid = value
      else if (key === 'branch.head') branch.head = value === '(detached)' ? null : value
      else if (key === 'branch.upstream') branch.upstream = value
      else if (key === 'branch.ab') {
        const ab = value.match(/^\+(\d+)\s+-(\d+)$/)
        if (ab) { branch.ahead = Number(ab[1]); branch.behind = Number(ab[2]) }
      }
      continue
    }
    const kind = rec[0]
    if (kind === '?') { untracked.push({ path: rec.slice(2) }); continue }
    if (kind === '!') continue // ignored 不展示
    if (kind === 'u') {
      // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
      const f = rec.slice(2).split(' ')
      conflicted.push({ path: f.slice(9).join(' '), xy: f[0] })
      continue
    }
    if (kind !== '1' && kind !== '2') continue
    // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>                  → 路径在下标 7
    // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path>      → 路径在下标 8
    const f = rec.slice(2).split(' ')
    const xy = f[0]
    const pathStart = kind === '2' ? 8 : 7
    const path = f.slice(pathStart).join(' ')
    let origPath = null
    if (kind === '2') { i += 1; origPath = records[i] || null } // -z:origPath 是下一个 NUL 字段
    const x = xy[0], y = xy[1]
    if (x && x !== '.') staged.push({ path, x, state: STATE_LABEL[x] || x, origPath, renamed: kind === '2' })
    if (y && y !== '.' && y !== 'U') unstaged.push({ path, y, state: STATE_LABEL[y] || y, origPath, renamed: kind === '2' })
    if (y === 'U' || x === 'U' || kind === 'u') conflicted.push({ path })
  }
  return { branch, staged, unstaged, untracked, conflicted }
}

/**
 * 解析 `git log --pretty=format:%H%x1f%h%x1f%an%x1f%at%x1f%s%x1f%D%x1e -n N` 输出。
 * 记录分隔 \x1e,字段分隔 \x1f。返回 [{ hash, short, author, time, subject, refs }]
 */
export function parseLog(out) {
  const list = []
  for (const rec of (out || '').split('\x1e')) {
    if (!rec.trim()) continue
    const [hash = '', short = '', author = '', time = '', subject = '', refs = ''] = rec.split('\x1f')
    if (!hash) continue
    list.push({ hash, short, author, time: Number(time) || 0, subject, refs: refs || '' })
  }
  return list
}

/**
 * 解析 `git diff [--cached] --numstat` 输出:`added\tdeleted\tpath`(binary 为 `-\t-`)。
 * 返回 [{ path, added, deleted, binary }]
 */
export function parseNumstat(out) {
  const list = []
  for (const line of (out || '').split('\n')) {
    if (!line) continue
    const i1 = line.indexOf('\t'); if (i1 < 0) continue
    const i2 = line.indexOf('\t', i1 + 1); if (i2 < 0) continue
    const added = line.slice(0, i1), deleted = line.slice(i1 + 1, i2)
    const path = line.slice(i2 + 1)
    const binary = added === '-' || deleted === '-'
    list.push({ path, added: binary ? null : Number(added), deleted: binary ? null : Number(deleted), binary })
  }
  return list
}

/**
 * 解析 `git branch --format=%(refname:short)%00%(objectname:short)%00%(HEAD)%00%(upstream:short)`。
 * 返回 [{ name, short, current, upstream }]
 */
export function parseBranches(out) {
  const list = []
  for (const line of (out || '').split('\n')) {
    if (!line) continue
    const [name = '', short = '', head = '', upstream = ''] = line.split('\0')
    if (!name) continue
    list.push({ name, short: short || name.slice(0, 7), current: head === '*', upstream: upstream || null })
  }
  return list
}

/**
 * 解析 `git stash list --format=%gd%x1f%at%x1f%gs`。
 * 返回 [{ ref, time, subject }]
 */
export function parseStashList(out) {
  const list = []
  for (const rec of (out || '').split('\n')) {
    if (!rec) continue
    const [ref = '', time = '', subject = ''] = rec.split('\x1f')
    if (!ref) continue
    list.push({ ref, time: Number(time) || 0, subject })
  }
  return list
}

/** 统一 diff → 简单结构(hunk/行类型),client 直接渲染。 */
export function parseUnifiedDiff(out) {
  const files = []
  let cur = null
  const META = /^(index |old mode|new mode|deleted file mode|new file mode|similarity index|dissimilarity index|rename from |rename to |copy from |copy to |--- |\+\+\+ |Binary files )/
  for (const line of (out || '').split('\n')) {
    if (line.startsWith('diff --git ')) {
      cur = { header: line, lines: [] }
      files.push(cur)
      continue
    }
    if (!cur) continue
    const t = line[0]
    // 注意:+++ / --- 是文件头元信息,必须先于 +/- 行型判断
    if (META.test(line)) cur.lines.push({ type: 'meta', text: line })
    else if (t === '@') cur.lines.push({ type: 'hunk', text: line })
    else if (t === '+') cur.lines.push({ type: 'add', text: line.slice(1) })
    else if (t === '-') cur.lines.push({ type: 'del', text: line.slice(1) })
    else cur.lines.push({ type: 'ctx', text: line.replace(/^ /, '') })
  }
  return files
}

// ─────────────────────────────────────────────────────────────
// 白名单操作集(exec 由宿主注入)
// ─────────────────────────────────────────────────────────────

/**
 * @param {({ argv: string[], cwd: string, timeoutMs?: number }) => Promise<{ code: number, stdout: string, stderr: string }>} exec
 */
export function createGit(exec) {
  async function run(cwd, argv, opts = {}) {
    const r = await exec({ argv, cwd, timeoutMs: opts.timeoutMs ?? 20000 })
    return r
  }
  async function ok(cwd, argv, opts = {}) {
    const r = await run(cwd, argv, opts)
    if (r.code !== 0) {
      const err = new Error(`git ${argv[0]} 失败: ${(r.stderr || r.stdout || '').trim().slice(0, 500)}`)
      err.code = r.code; err.stderr = r.stderr
      throw err
    }
    return r
  }

  return {
    // ── 查询 ──
    async isRepo(cwd) {
      const r = await run(cwd, ['rev-parse', '--is-inside-work-tree'])
      return r.code === 0 && r.stdout.trim() === 'true'
    },
    async toplevel(cwd) {
      const r = await run(cwd, ['rev-parse', '--show-toplevel'])
      return r.code === 0 ? r.stdout.trim() : null
    },
    async status(cwd) {
      // -uall:未跟踪目录展开到文件(面板按文件勾选,不要目录折叠)
      const r = await ok(cwd, ['status', '--porcelain=v2', '--branch', '-z', '-uall'])
      return parseStatusV2(r.stdout)
    },
    async numstat(cwd, { staged = false } = {}) {
      const r = await ok(cwd, staged ? ['diff', '--cached', '--numstat'] : ['diff', '--numstat'])
      return parseNumstat(r.stdout)
    },
    async diffFile(cwd, path, { staged = false } = {}) {
      checkPath(path)
      const argv = ['diff', '--no-color']
      if (staged) argv.push('--cached')
      argv.push('--', path)
      const r = await ok(cwd, argv)
      return parseUnifiedDiff(r.stdout)
    },
    /** 未跟踪文件没有 diff,用 no-index 与空设备比对生成「全 +」视图。 */
    async diffUntracked(cwd, path) {
      checkPath(path)
      const r = await run(cwd, ['diff', '--no-color', '--no-index', '--', '/dev/null', path])
      return parseUnifiedDiff(r.stdout) // --no-index 对新文件退出码为 1,容忍
    },
    async log(cwd, { limit = 30 } = {}) {
      const fmt = '%H%x1f%h%x1f%an%x1f%at%x1f%s%x1f%D%x1e'
      const r = await ok(cwd, ['log', `--pretty=format:${fmt}`, '-n', String(Math.min(Math.max(1, limit), 200))])
      return parseLog(r.stdout)
    },
    async branches(cwd) {
      const r = await ok(cwd, ['branch', '--format=%(refname:short)%00%(objectname:short)%00%(HEAD)%00%(upstream:short)'])
      return parseBranches(r.stdout)
    },
    async stashList(cwd) {
      const r = await run(cwd, ['stash', 'list', '--format=%gd%x1f%at%x1f%gs'])
      return r.code === 0 ? parseStashList(r.stdout) : []
    },

    // ── 暂存/提交 ──
    async stage(cwd, paths) { return ok(cwd, ['add', '--', ...checkPaths(paths)]) },
    async unstage(cwd, paths) { return ok(cwd, ['restore', '--staged', '--', ...checkPaths(paths)]) },
    async stageAll(cwd) { return ok(cwd, ['add', '-A']) },
    async unstageAll(cwd) { return ok(cwd, ['reset', '--mixed']) },
    async commit(cwd, message) {
      if (typeof message !== 'string' || !message.trim()) throw new Error('git-panel: commit message 不能为空')
      return ok(cwd, ['commit', '-m', message])
    },
    async undoCommit(cwd, { confirm = false } = {}) {
      if (!confirm) throw new Error('git-panel: undoCommit 需要显式 confirm')
      return ok(cwd, ['reset', '--soft', 'HEAD~1'])
    },
    async discardFile(cwd, path, { confirm = false } = {}) {
      if (!confirm) throw new Error('git-panel: discard 需要显式 confirm')
      return ok(cwd, ['restore', '--worktree', '--', checkPath(path)])
    },

    // ── 分支 ──
    async switchBranch(cwd, name) {
      checkRef(name)
      return ok(cwd, ['switch', name])
    },
    async createBranch(cwd, name, { startPoint } = {}) {
      checkRef(name)
      const argv = ['switch', '-c', name]
      if (startPoint) argv.push(checkRef(startPoint))
      return ok(cwd, argv)
    },
    async deleteBranch(cwd, name, { force = false, confirm = false } = {}) {
      checkRef(name)
      if (!confirm) throw new Error('git-panel: deleteBranch 需要显式 confirm')
      return ok(cwd, ['branch', force ? '-D' : '-d', name])
    },

    // ── 远端同步 ──
    async fetch(cwd) { return ok(cwd, ['fetch', '--all'], { timeoutMs: 120000 }) },
    async pull(cwd) { return ok(cwd, ['pull'], { timeoutMs: 120000 }) },
    async push(cwd, { force = false, confirm = false } = {}) {
      if (force && !confirm) throw new Error('git-panel: force push 需要显式 confirm')
      return ok(cwd, force ? ['push', '--force-with-lease'] : ['push'], { timeoutMs: 120000 })
    },

    // ── stash(M3 预留) ──
    async stashApply(cwd, ref) { return ok(cwd, ['stash', 'apply', checkRef(ref)]) },
    async stashPop(cwd, ref) { return ok(cwd, ['stash', 'pop', checkRef(ref)]) },
    async stashDrop(cwd, ref, { confirm = false } = {}) {
      if (!confirm) throw new Error('git-panel: stashDrop 需要显式 confirm')
      return ok(cwd, ['stash', 'drop', checkRef(ref)])
    },
  }
}

/** ref/分支名校验:拒绝选项注入与空白、控制字符。 */
export function checkRef(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('git-panel: ref 不能为空')
  if (name.startsWith('-') || /[\s\0\x1f\x1e]/.test(name)) throw new Error(`git-panel: ref 非法: ${JSON.stringify(name.slice(0, 40))}`)
  return name
}

/** 剥离继承的 GIT_* 环境选择器 + 禁交互(宿主 spawn 时合并进 env)。 */
export function gitEnv(base = {}) {
  const env = { ...base }
  for (const k of Object.keys(env)) {
    if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|COMMON_DIR|NAMESPACE|CEILING_DIRECTORIES)$/.test(k)) delete env[k]
  }
  env.GIT_TERMINAL_PROMPT = '0'
  env.GIT_OPTIONAL_LOCKS = '0'
  return env
}
