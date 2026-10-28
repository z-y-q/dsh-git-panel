// lib/index.js — 宿主半边:GitPanelService(TypertRemoteService,SRC 模式)。
//
// 架构(与 dsh-mcp-auth 同款,全部经真实源码验证):
//  - extends TypertRemoteService,super(ctx, 'gitPanel', { namespace: 'gitPanel' });
//    构造即注册到 ctx.reflect.props,Gateway 的 source-mode discovery 扫描
//    typertRemote 绑定 + 原型上的 Remote 方法标记,自动暴露 /api RPC 端点。
//  - 方法参数名即 wire 契约:首参 `agent` 命中全局 agent lookup
//    (wire 键 agentId,由 agents.get(sessionId) 解析成 Agent 实例),
//    其余参数按参数名以 src-json 透传。参数名不可随意改。
//  - 纯 JS 无装饰器语法:用真实 Remote() 装饰器函数 + 手工 stage-3 上下文
//    走原代码路径(remoteDecorate)。
//  - 浏览器半边不 mount 生成工件,直接 connection.rpc.call('/api',
//    'gitPanel/<method>', { args: { agentId, ... } })。
import path from 'node:path'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { createGit } from './git.js'
import { createExec } from './exec.js'

/** 服务级服务声明(loader 实例化默认导出类;缺失时本条目停泊而非报错)。 */
export const name = '@deepseek-ai/dsh-git-panel'

export class GitPanelService extends TypertRemoteService {
  static inject = ['subprocess', 'workingDirectory', 'llm', 'agentDefaultModel']

  constructor(ctx) {
    super(ctx, 'gitPanel', { namespace: 'gitPanel' })
    this.log = ctx.logger ?? console
    // 会话级子仓库选择(agentId → 相对工作区的仓库根),仅内存,不落盘
    this.repoOverride = new Map()
    this.exec = createExec({
      subprocess: ctx.subprocess,
      sandbox: ctx.get('sandbox'),
      sandboxPolicy: ctx.get('sandboxPolicy'),
    }, this.log)
    this.git = createGit(this.exec)
  }

  /** 基准工作区目录(workingDirectory.ensure 兼顾未初始化的会话)。 */
  async baseCwd(agent) {
    return await this.ctx.workingDirectory.ensure(agent)
  }

  /** 生效目录 = 基准 + 会话选择的子仓库(若有)。所有 git 操作经此收口。 */
  async cwd(agent) {
    const base = await this.baseCwd(agent)
    const override = this.repoOverride.get(agent.id)
    return override ? path.resolve(base, override) : base
  }

  /** 子仓库发现:基准目录下 5 层内的 .git(目录或 worktree 文件);
   *  剪枝 node_modules/dist/build/vendor 等重目录,保证大工作区也快。 */
  async discoverSubRepos(agent) {
    const base = await this.baseCwd(agent)
    const argv = [
      'find', '.', '-maxdepth', '5',
      '(', '-name', 'node_modules', '-o', '-name', 'dist', '-o', '-name', 'build',
      '-o', '-name', 'vendor', '-o', '-name', '.venv', '-o', '-name', 'venv',
      '-o', '-name', 'target', ')', '-prune',
      '-o', '-name', '.git', '-print',
    ]
    const r = await this.exec({ argv, cwd: base, timeoutMs: 15000, raw: true })
    if (r.code !== 0) return []
    return r.stdout.split('\n').map(l => l.trim())
      .map(l => l.replace(/\/\.git$/, '').replace(/^\.\//, ''))
      .filter(d => d && d !== '.')
  }

  /** 选择会话的子仓库(root 为空清除选择)。选择后所有方法以该仓库为根。 */
  async selectRepo(agent, root) {
    const base = await this.baseCwd(agent)
    if (root) {
      if (typeof root !== 'string' || root.startsWith('/') || root.includes('..')) {
        throw new Error('非法仓库路径: ' + String(root).slice(0, 80))
      }
      const target = path.resolve(base, root)
      const top = await this.git.toplevel(target)
      if (!top) throw new Error('该目录不是 Git 仓库: ' + root)
      this.repoOverride.set(agent.id, root)
    } else {
      this.repoOverride.delete(agent.id)
    }
    return { selected: root || '' }
  }

  // ── 查询 ──

  async status(agent) {
    const override = this.repoOverride.get(agent.id) || null
    const base = await this.baseCwd(agent)
    const cwd = override ? path.resolve(base, override) : base
    // 三层信息:基准目录是否仓库(baseRepo)/ 发现的子仓库 / 生效仓库(override 优先)
    const [baseTop, repos, toplevel] = await Promise.all([
      this.git.toplevel(base).catch(() => null),
      this.discoverSubRepos(agent).catch(() => []),
      this.git.toplevel(cwd),
    ])
    const baseRepo = baseTop ? path.basename(baseTop) : null
    if (!toplevel) {
      return { repo: false, cwd, toplevel: null, status: null, branches: null, stats: null, lastCommit: null,
        repos, baseRepo, subRepo: override }
    }
    const [status, branches, combined, last] = await Promise.all([
      this.git.status(cwd),
      this.git.branches(cwd).catch(() => []),
      // 暂存+未暂存合并统计:单次 spawn(unborn HEAD 容错为空)
      this.git.numstatCombined(cwd).catch(() => []),
      this.git.log(cwd, { limit: 1 }).then(l => l[0] ?? null).catch(() => null),
    ])
    // 按路径合并 +/- 行数统计(rename 的 numstat 路径含 '=>' 暂不计)
    const stats = {}
    for (const r of combined) {
      if (r.path.includes('=>')) continue
      stats[r.path] = { added: r.added ?? 0, deleted: r.deleted ?? 0 }
    }
    return {
      repo: true, cwd, toplevel, subRepo: override, repos, baseRepo,
      status: {
        branch: status.branch,
        staged: status.staged,
        unstaged: status.unstaged,
        untracked: status.untracked,
        conflicted: status.conflicted,
      },
      branches,
      stats,
      lastCommit: last ? { short: last.short, subject: last.subject, author: last.author, time: last.time } : null,
    }
  }

  // ── diff / 历史 ──

  /** 单文件 diff(staged=false 为工作区对比;未跟踪文件走 diffUntracked)。 */
  async diff(agent, path, staged) {
    const cwd = await this.cwd(agent)
    const files = await this.git.diffFile(cwd, path, { staged: staged === true })
    return { path, staged: staged === true, files }
  }

  /** 未跟踪文件的全「+」视图(no-index 对空设备)。 */
  async diffUntracked(agent, path) {
    const cwd = await this.cwd(agent)
    const files = await this.git.diffUntracked(cwd, path)
    return { path, staged: false, files }
  }

  /** 提交历史(最新在前;path 可选=单文件历史)。 */
  async history(agent, limit, path) {
    const cwd = await this.cwd(agent)
    const entries = await this.git.log(cwd, {
      limit: typeof limit === 'number' ? limit : 50,
      path: typeof path === 'string' && path ? path : undefined,
    })
    return { entries }
  }

  // ── 暂存 ──

  async stage(agent, paths) {
    const cwd = await this.cwd(agent)
    await this.git.stage(cwd, paths)
    return { staged: paths.length }
  }

  async unstage(agent, paths) {
    const cwd = await this.cwd(agent)
    await this.git.unstage(cwd, paths)
    return { unstaged: paths.length }
  }

  async stageAll(agent) {
    const cwd = await this.cwd(agent)
    await this.git.stageAll(cwd)
    return { ok: true }
  }

  async unstageAll(agent) {
    const cwd = await this.cwd(agent)
    await this.git.unstageAll(cwd)
    return { ok: true }
  }

  // ── 提交 ──

  async commit(agent, message) {
    const cwd = await this.cwd(agent)
    const r = await this.git.commit(cwd, message)
    const summary = (r.stdout || '').split('\n').find(l => l.trim()) || ''
    return { summary: summary.slice(0, 300) }
  }

  // ── 分支 ──

  async checkout(agent, name) {
    const cwd = await this.cwd(agent)
    await this.git.switchBranch(cwd, name)
    return { switched: name }
  }

  async createBranch(agent, name, startPoint) {
    const cwd = await this.cwd(agent)
    await this.git.createBranch(cwd, name, { startPoint: startPoint || undefined })
    return { created: name }
  }

  async deleteBranch(agent, name, confirm) {
    const cwd = await this.cwd(agent)
    await this.git.deleteBranch(cwd, name, { force: false, confirm: confirm === true })
    return { deleted: name }
  }

  // ── 提交撤销 / 远端同步 ──

  async undoCommit(agent, confirm) {
    const cwd = await this.cwd(agent)
    await this.git.undoCommit(cwd, { confirm: confirm === true })
    return { undone: true }
  }

  /** 丢弃工作区改动(restore --worktree)。 */
  async discard(agent, paths, confirm) {
    const cwd = await this.cwd(agent)
    await this.git.discardFiles(cwd, paths, { confirm: confirm === true })
    return { discarded: paths.length }
  }

  /** 提交所有已跟踪文件(commit -a)。 */
  async commitTracked(agent, message) {
    const cwd = await this.cwd(agent)
    const r = await this.git.commitTracked(cwd, message)
    const summary = (r.stdout || '').split('\n').find(l => l.trim()) || ''
    return { summary: summary.slice(0, 300) }
  }

  /** 冲突解决:按侧取版。 */
  async resolveConflict(agent, path, side) {
    const cwd = await this.cwd(agent)
    await this.git.resolveConflict(cwd, path, side)
    await this.git.stage(cwd, [path])
    return { resolved: path, side }
  }

  /** 在 HEAD 创建轻量标签。 */
  async tag(agent, name) {
    const cwd = await this.cwd(agent)
    await this.git.tagCreate(cwd, name)
    return { tagged: name }
  }

  // ── stash ──

  async stashSave(agent, mode) {
    const cwd = await this.cwd(agent)
    await this.git.stashSave(cwd, { mode: ['all', 'tracked', 'staged'].includes(mode) ? mode : 'all' })
    return { stashed: true, mode: mode || 'all' }
  }

  /** 贮藏内容 diff。 */
  async stashDiff(agent, ref) {
    const cwd = await this.cwd(agent)
    const files = await this.git.stashShow(cwd, ref)
    return { ref, files }
  }

  async stashList(agent) {
    const cwd = await this.cwd(agent)
    return { entries: await this.git.stashList(cwd) }
  }

  async stashApply(agent, ref) {
    const cwd = await this.cwd(agent)
    await this.git.stashApply(cwd, ref)
    return { applied: ref }
  }

  async stashPop(agent, ref) {
    const cwd = await this.cwd(agent)
    await this.git.stashPop(cwd, ref)
    return { popped: ref }
  }

  async stashDrop(agent, ref, confirm) {
    const cwd = await this.cwd(agent)
    await this.git.stashDrop(cwd, ref, { confirm: confirm === true })
    return { dropped: ref }
  }

  async fetch(agent) {
    const cwd = await this.cwd(agent)
    await this.git.fetch(cwd)
    return { fetched: true }
  }

  async pull(agent, rebase) {
    const cwd = await this.cwd(agent)
    await this.git.pull(cwd, { rebase: rebase === true })
    return { pulled: true, rebase: rebase === true }
  }

  /** 强推(仅 --force-with-lease;必须显式 confirm)。 */
  async pushForce(agent, confirm) {
    const cwd = await this.cwd(agent)
    await this.git.pushForce(cwd, { confirm: confirm === true })
    return { pushed: true, forceWithLease: true }
  }

  async push(agent) {
    const cwd = await this.cwd(agent)
    const st = await this.git.status(cwd)
    // 无 upstream 时首推建立追踪(分支级强推通道不存在,见 git.js)
    const setUpstream = !(st.branch && st.branch.upstream)
    await this.git.push(cwd, { setUpstream })
    return { pushed: true, setUpstream }
  }

  // ── 提交下钻(graph 节点详情) ──

  async showCommit(agent, hash) {
    const cwd = await this.cwd(agent)
    const entries = await this.git.log(cwd, { limit: 1, ref: hash })
    const e = entries[0]
    if (!e) throw new Error('提交不存在: ' + hash)
    const files = await this.git.commitNumstat(cwd, hash).catch(() => [])
    return { hash: e.hash, short: e.short, subject: e.subject, body: e.body || '', author: e.author, time: e.time, refs: e.refs, files }
  }

  async commitFileDiff(agent, hash, path) {
    const cwd = await this.cwd(agent)
    const files = await this.git.commitFileDiff(cwd, hash, path)
    return { path, files }
  }

  /** 全部变更 diff(工作区 vs HEAD;未跟踪文件不含)。 */
  async diffAll(agent) {
    const cwd = await this.cwd(agent)
    const files = await this.git.diffAllRaw(cwd)
    return { files }
  }

  // ── AI 提交信息(宿主侧一次性 LLM 调用,官方 session-title-llm 同款姿势) ──

  async aiMessage(agent, signal) {
    const cwd = await this.cwd(agent)
    const st = await this.git.status(cwd)
    if (!st.staged.length) throw new Error('没有已暂存的变更:先勾选文件再生成')
    const [diffText, num] = await Promise.all([
      this.git.stagedDiffRaw(cwd),
      this.git.numstat(cwd, { staged: true }).catch(() => []),
    ])
    const summary = num.map(n => (n.binary ? '(binary) ' : `+${n.added ?? '?'} -${n.deleted ?? '?'} `) + n.path).join('\n')
    const sel = this.ctx.agentDefaultModel.currentSelection()
    if (!sel || !sel.provider || !sel.model) throw new Error('未配置默认模型(设置 → 模型)')
    const call = await this.ctx.llm.prepareCall(
      { provider: sel.provider, model: sel.model, maxTokens: 400, temperature: 0.2 },
      signal,
    )
    const options = {
      ...call.config,
      messages: [{ role: 'user', content: [{ type: 'text', text: '变更文件统计:\n' + summary + '\n\nStaged diff:\n' + diffText }] }],
      system: AI_MESSAGE_SYSTEM,
      sessionId: agent.id,
      ...(signal ? { signal } : {}),
    }
    let text = ''
    for await (const chunk of call.stream(options)) {
      if (chunk.type === 'text-delta') text += chunk.text
      else if (chunk.type === 'finish') {
        if (chunk.reason === 'error' || chunk.reason === 'aborted') {
          throw new Error('模型调用失败: ' + (chunk.failure?.message || chunk.reason))
        }
        break
      }
    }
    const message = cleanupAiMessage(text)
    if (!message) throw new Error('模型没有返回有效内容')
    return { message }
  }
}

const AI_MESSAGE_SYSTEM = [
  '你是 commit message 生成器。根据 staged diff 写一条符合 Conventional Commit 风格的中文提交信息:',
  '- 第一行:`类型: 摘要`(类型用 feat/fix/docs/refactor/test/chore,摘要 ≤50 字符,不加句号)',
  '- 空一行后可用 `- ` 要点列出关键改动(最多 5 条,没有就省略)',
  '- 只输出提交信息本身:不要引号、不要 markdown 代码块、不要任何解释',
].join('\n')

function cleanupAiMessage(text) {
  let s = String(text || '').trim()
  // 剥掉模型偶尔加的 ``` 代码围栏与成对引号
  s = s.replace(/^```[a-z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

// ── 手动应用 @Remote 装饰器(纯 JS,走真实装饰器代码路径) ──
// 方法实现名 → wire 端点名(默认同名;此处显式列出便于审计)。
const REMOTE_METHODS = [
  'status', 'stage', 'unstage', 'stageAll', 'unstageAll', 'commit', 'commitTracked', 'checkout',
  'diff', 'diffUntracked', 'diffAll', 'history', 'showCommit', 'commitFileDiff',
  'createBranch', 'deleteBranch', 'undoCommit', 'discard', 'resolveConflict', 'tag',
  'stashSave', 'stashList', 'stashApply', 'stashPop', 'stashDrop', 'stashDiff',
  'fetch', 'pull', 'push', 'aiMessage',
  'discoverSubRepos', 'selectRepo',
]

for (const method of REMOTE_METHODS) {
  const initializers = []
  Remote(method)(GitPanelService.prototype[method], {
    kind: 'method', name: method, static: false, private: false,
    access: {}, addInitializer: f => initializers.push(f),
  })
  // stage-3 初始化器以实例为 this 运行;mark() 写原型且幂等,
  // 用一个原型正确的哑对象触发一次即可。
  const dummy = Object.create(GitPanelService.prototype)
  for (const f of initializers) f.call(dummy)
}

export default GitPanelService
