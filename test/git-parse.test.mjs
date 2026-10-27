// test/git-parse.test.mjs — git.js 解析与白名单操作的单测(纯函数 + 假 exec + 真实临时仓库)
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

import {
  parseStatusV2, parseLog, parseNumstat, parseBranches, parseStashList,
  parseUnifiedDiff, checkPath, checkRef, gitEnv, createGit,
} from '../lib/git.js'

// ── parseStatusV2 ──

test('parseStatusV2: 分支头 + 三分组 + 未合并', () => {
  const out = [
    '# branch.oid abc1234',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +2 -1',
    // 完整 v2 格式:1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
    '1 .M N... 000000 000000 111111 aaaa1111 bbbb2222 pathB.txt',
    '1 A. N... 000000 111111 000000 cccc3333 dddd4444 pathA.txt',
    '? notes/设计.md',
    // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
    'u UU N... 100644 100644 100644 100644 e1 e2 e3 conflict.txt',
    '1 D. N... 000000 111111 000000 ffff5555 66667777 gone.txt',
  ].join('\x00') + '\x00'
  const s = parseStatusV2(out)
  assert.equal(s.branch.head, 'main')
  assert.equal(s.branch.upstream, 'origin/main')
  assert.equal(s.branch.ahead, 2)
  assert.equal(s.branch.behind, 1)
  assert.deepEqual(s.staged.map(e => [e.path, e.state]), [
    ['pathA.txt', 'added'], ['gone.txt', 'deleted'],
  ])
  assert.deepEqual(s.unstaged.map(e => e.path), ['pathB.txt'])
  assert.deepEqual(s.untracked.map(e => e.path), ['notes/设计.md'])
  assert.equal(s.conflicted.length, 1)
})

test('parseStatusV2: rename(-z 下 origPath 是紧随的 NUL 字段)', () => {
  const out = '2 R. N... 000000 000000 111111 aaaa1111 bbbb2222 R100 new.txt\x00old.txt\x00'
  const s = parseStatusV2(out)
  assert.equal(s.staged.length, 1)
  assert.equal(s.staged[0].path, 'new.txt')
  assert.equal(s.staged[0].origPath, 'old.txt')
  assert.equal(s.staged[0].renamed, true)
})

test('parseStatusV2: detached HEAD 与空输出', () => {
  const s = parseStatusV2('# branch.oid x\x00# branch.head (detached)\x00')
  assert.equal(s.branch.head, null)
  assert.deepEqual(parseStatusV2(''), { branch: { oid: null, head: null, upstream: null, ahead: null, behind: null }, staged: [], unstaged: [], untracked: [], conflicted: [] })
})

// ── parseLog ──

test('parseLog: \x1e/\x1f 分隔 + refs + parents', () => {
  const out = 'hash1\x00h1\x00Alice\x001700000000\x00feat: a\x00main\x00p1 p2\x00\x1ehash2\x00h2\x00Bob\x001700000001\x00fix: b\x00\x00\x1e'
    .replaceAll('\x00', '\x1f')
  const l = parseLog(out)
  assert.equal(l.length, 2)
  assert.deepEqual(l[0], { hash: 'hash1', short: 'h1', author: 'Alice', time: 1700000000, subject: 'feat: a', refs: 'main', parents: ['p1', 'p2'] })
  assert.equal(l[1].refs, '')
  assert.deepEqual(l[1].parents, [])
})

// ── parseNumstat ──

test('parseNumstat: 增删行数与 binary', () => {
  const out = '12\t3\tsrc/a.js\n-\t-\timg.png\n0\t0\tsrc/中文 b.js'
  const n = parseNumstat(out)
  assert.deepEqual(n[0], { path: 'src/a.js', added: 12, deleted: 3, binary: false })
  assert.deepEqual(n[1], { path: 'img.png', added: null, deleted: null, binary: true })
  assert.equal(n[2].path, 'src/中文 b.js')
})

// ── parseBranches ──

test('parseBranches: 当前分支与 upstream', () => {
  const out = 'main\x00a1b2c3d\x00*\x00origin/main\nfeature/x\x00e4f5a6b\x00 \x00\n'
  const b = parseBranches(out)
  assert.equal(b.length, 2)
  assert.equal(b[0].current, true)
  assert.equal(b[0].upstream, 'origin/main')
  assert.equal(b[1].current, false)
})

test('parseStashList', () => {
  const l = parseStashList('stash@{0}\x1f1700000000\x1fWIP on main: a1b2c x\n')
  assert.equal(l[0].ref, 'stash@{0}')
  assert.equal(l[0].subject, 'WIP on main: a1b2c x')
})

test('parseUnifiedDiff: 行类型', () => {
  const d = parseUnifiedDiff([
    'diff --git a/f b/f',
    'index 111..222 100644',
    '--- a/f', '+++ b/f',
    '@@ -1,2 +1,2 @@',
    ' context',
    '-old line',
    '+new line',
  ].join('\n'))
  assert.equal(d.length, 1)
  const types = d[0].lines.map(l => l.type)
  assert.deepEqual(types, ['meta', 'meta', 'meta', 'hunk', 'ctx', 'del', 'add'])
})

// ── 校验器 ──

test('checkPath / checkRef 拒绝非法输入', () => {
  assert.throws(() => checkPath(''))
  assert.throws(() => checkPath('a\x00b'))
  assert.throws(() => checkRef('-c'))
  assert.throws(() => checkRef('a b'))
  assert.throws(() => checkRef(''))
  assert.equal(checkRef('feature/x'), 'feature/x')
})

test('gitEnv 剥离 GIT_* 选择器并禁交互', () => {
  const env = gitEnv({ GIT_DIR: '/x', GIT_WORK_TREE: '/y', PATH: '/bin', HOME: '/u' })
  assert.equal(env.GIT_DIR, undefined)
  assert.equal(env.GIT_WORK_TREE, undefined)
  assert.equal(env.GIT_TERMINAL_PROMPT, '0')
  assert.equal(env.GIT_OPTIONAL_LOCKS, '0')
  assert.equal(env.PATH, '/bin')
})

// ── createGit:argv 正确性(假 exec)+ 危险操作确认门 ──

test('createGit:argv 与结果解析(假 exec)', async () => {
  const calls = []
  const git = createGit(async ({ argv }) => {
    calls.push(argv)
    if (argv[0] === 'status') return { code: 0, stdout: '# branch.head dev\x00? a.txt\x00', stderr: '' }
    if (argv[0] === 'diff') return { code: 0, stdout: '1\t2\ta.txt\n', stderr: '' }
    return { code: 0, stdout: '', stderr: '' }
  })
  const st = await git.status('/repo')
  assert.equal(st.branch.head, 'dev')
  assert.deepEqual(calls.at(-1), ['status', '--porcelain=v2', '--branch', '-z', '-uall'])
  await git.stage('/repo', ['a.txt', 'b c.txt'])
  assert.deepEqual(calls.at(-1), ['add', '--', 'a.txt', 'b c.txt'])
  await git.unstage('/repo', ['a.txt'])
  assert.deepEqual(calls.at(-1), ['restore', '--staged', '--', 'a.txt'])
  await git.commit('/repo', 'feat: x')
  assert.deepEqual(calls.at(-1), ['commit', '-m', 'feat: x'])
  const n = await git.numstat('/repo')
  assert.equal(n[0].added, 1)
  await git.push('/repo', { force: true, confirm: true })
  assert.deepEqual(calls.at(-1), ['push', '--force-with-lease'])
})

test('createGit:危险操作必须 confirm,空 commit message 拒绝', async () => {
  const git = createGit(async () => ({ code: 0, stdout: '', stderr: '' }))
  await assert.rejects(() => git.undoCommit('/r'), /confirm/)
  await assert.rejects(() => git.deleteBranch('/r', 'x'), /confirm/)
  await assert.rejects(() => git.push('/r', { force: true }), /confirm/)
  await assert.rejects(() => git.commit('/r', '   '), /不能为空/)
  await assert.rejects(() => git.stage('/r', []), /paths/)
})

test('createGit:失败命令抛出含 stderr 的错误', async () => {
  const git = createGit(async () => ({ code: 128, stdout: '', stderr: 'fatal: not a git repository' }))
  await assert.rejects(() => git.status('/r'), /not a git repository/)
})

// ── 真实 git 仓库集成测试(本机有 git 即跑) ──

test('createGit:真实临时仓库端到端', async t => {
  let gitBin
  try { gitBin = execFileSync('git', ['--version'], { encoding: 'utf8' }) } catch { t.skip('本机无 git'); return }
  assert.match(gitBin, /git version/)

  const dir = mkdtempSync(join(tmpdir(), 'git-panel-test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const sh = (argv, opts = {}) => execFileSync('git', argv, { cwd: dir, encoding: 'utf8', ...opts })
  // exec 环境(模拟宿主注入的 gitEnv)
  const realExec = async ({ argv, cwd }) => {
    try { return { code: 0, stdout: sh(argv, { env: gitEnv({ ...process.env }) }), stderr: '' } }
    catch (e) { return { code: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? String(e) } }
  }
  const git = createGit(realExec)

  assert.equal(await git.isRepo(dir), false)
  sh(['init', '-b', 'main'])
  sh(['config', 'user.email', 't@t']); sh(['config', 'user.name', 'T'])
  assert.equal(await git.isRepo(dir), true)
  assert.match(await git.toplevel(dir), /git-panel-test-/)

  mkdirSync(join(dir, 'src'))
  writeFileSync(join(dir, 'src/a.js'), 'let a = 1\n')
  writeFileSync(join(dir, '中文 目录.md'), '# hi\n')
  let st = await git.status(dir)
  assert.deepEqual(st.untracked.map(e => e.path).sort(), ['src/a.js', '中文 目录.md'])
  assert.equal(st.branch.head, 'main')

  await git.stage(dir, ['src/a.js', '中文 目录.md'])
  st = await git.status(dir)
  assert.equal(st.staged.length, 2)
  assert.deepEqual(st.staged.map(e => e.path).sort(), ['src/a.js', '中文 目录.md'])

  await git.commit(dir, 'feat: 初始提交')
  st = await git.status(dir)
  assert.equal(st.staged.length, 0)
  assert.deepEqual(st.untracked, [])

  await git.createBranch(dir, 'feature/面板')
  let bs = await git.branches(dir)
  assert.ok(bs.find(b => b.name === 'feature/面板' && b.current))
  await git.switchBranch(dir, 'main')
  bs = await git.branches(dir)
  assert.ok(bs.find(b => b.name === 'main' && b.current))

  // 第二个提交:undoCommit(HEAD~1) 需要至少 2 个提交(root commit 无法 undo,与 git 行为一致)
  writeFileSync(join(dir, 'src/b.js'), 'let b = 1\n')
  await git.stage(dir, ['src/b.js'])
  await git.commit(dir, 'chore: 第二次提交')

  writeFileSync(join(dir, 'src/a.js'), 'let a = 2\n')
  st = await git.status(dir)
  assert.equal(st.unstaged[0].path, 'src/a.js')
  const diff = await git.diffFile(dir, 'src/a.js')
  assert.equal(diff[0].lines.some(l => l.type === 'add' && l.text === 'let a = 2'), true)
  const num = await git.numstat(dir)
  assert.equal(num[0].added, 1)

  const lg = await git.log(dir)
  assert.equal(lg.length, 2)
  assert.equal(lg[0].subject, 'chore: 第二次提交')

  await git.stage(dir, ['src/a.js'])
  await git.undoCommit(dir, { confirm: true })
  st = await git.status(dir)
  assert.equal(st.staged.length, 2) // a.js(提交前暂存) + b.js(随软重置回到暂存区)
  assert.equal((await git.log(dir)).length, 1)

  await git.discardFile(dir, 'src/a.js', { confirm: true })
  await git.unstage(dir, ['src/b.js'])
  st = await git.status(dir)
  assert.equal(st.staged.length, 1)
})
