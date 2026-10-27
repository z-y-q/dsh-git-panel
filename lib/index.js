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
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { createGit } from './git.js'
import { createExec } from './exec.js'

/** 服务级服务声明(loader 实例化默认导出类;缺失时本条目停泊而非报错)。 */
export const name = '@deepseek-ai/dsh-git-panel'

export class GitPanelService extends TypertRemoteService {
  static inject = ['subprocess', 'workingDirectory']

  constructor(ctx) {
    super(ctx, 'gitPanel', { namespace: 'gitPanel' })
    this.log = ctx.logger ?? console
    this.git = createGit(createExec({
      subprocess: ctx.subprocess,
      sandbox: ctx.get('sandbox'),
      sandboxPolicy: ctx.get('sandboxPolicy'),
    }, this.log))
  }

  /** 会话工作区目录(workingDirectory.ensure 兼顾未初始化的会话)。 */
  async cwd(agent) {
    const wd = this.ctx.workingDirectory
    return await wd.ensure(agent)
  }

  // ── 查询 ──

  async status(agent) {
    const cwd = await this.cwd(agent)
    // 一次 rev-parse 同时回答「是否仓库」与 toplevel(省一次 spawn)
    const toplevel = await this.git.toplevel(cwd)
    if (!toplevel) return { repo: false, cwd, toplevel: null, status: null, branches: null, stats: null, lastCommit: null }
    const [status, branches, combined, last] = await Promise.all([
      this.git.status(cwd),
      this.git.branches(cwd).catch(() => []),
      // 暂存+未暂存合并统计:单次 spawn,行数按路径展示语义正确(unborn HEAD 容错为空)
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
      repo: true, cwd, toplevel,
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

  /** 提交历史(最新在前)。 */
  async history(agent, limit) {
    const cwd = await this.cwd(agent)
    const entries = await this.git.log(cwd, { limit: typeof limit === 'number' ? limit : 50 })
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

  async fetch(agent) {
    const cwd = await this.cwd(agent)
    await this.git.fetch(cwd)
    return { fetched: true }
  }

  async pull(agent) {
    const cwd = await this.cwd(agent)
    await this.git.pull(cwd)
    return { pulled: true }
  }

  async push(agent) {
    const cwd = await this.cwd(agent)
    await this.git.push(cwd, { force: false })
    return { pushed: true }
  }
}

// ── 手动应用 @Remote 装饰器(纯 JS,走真实装饰器代码路径) ──
// 方法实现名 → wire 端点名(默认同名;此处显式列出便于审计)。
const REMOTE_METHODS = [
  'status', 'stage', 'unstage', 'stageAll', 'unstageAll', 'commit', 'checkout',
  'diff', 'diffUntracked', 'history',
  'createBranch', 'deleteBranch', 'undoCommit',
  'fetch', 'pull', 'push',
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
