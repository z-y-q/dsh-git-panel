> ⚠️ **历史文档**:本文是 M0 时期的规划与设计(M1 之前),部分机制已被实现过程中的
> 真实结论取代(如 Typert 通道、版本化部署、渲染矩阵测试等)。
> **当前架构与机制请以 [ARCHITECTURE.md](ARCHITECTURE.md) 为准**;变更记录见 [CHANGELOG.md](CHANGELOG.md)。

# dsh-git-panel 设计方案

> 在 DSH Web UI 里做一个 Zed Git Panel 式的仓库管理面板。
> 状态:**v1.0 定稿待确认**。源码调研基于本机 `dsh-v0.2.1-rc.2`(安装运行版 0.2.1-rc.3,装载机制一致)。
> 结论均有源码出处,调研报告要点已并入各节。

---

## 0. 结论先行

- DSH 内置(0.2.1-rc.3)**没有**任何 Git 管理 UI;git 相关只有实验性 worktree Agent 工具、内部快照(`dsh-workspace-changes`)和终端侧栏。
- 官方已有"服务端跑 git"的完整先例:`packages/experimental/worktree`(subprocess + sandbox + git 环境净化),git.js 直接照抄其 `runCommand` 模式。
- 刷新推送有现成链路:`workspaceFiles.changes` stream 型 Remote(fs/observed 事件驱动),**无需自建 WebSocket/SSE**。
- UI 入口有 Zed 式方案:右侧栏页签(`sidebar.right.pane.tab`,内置终端同款)。
- 唯一不确定点:**第三方插件能否自挂 TypertRemoteService**(官方 remote 在 `dsh-api-remotes` 里静态 $mount,外挂无先例)→ 用 **M0 spike** 半天验证,失败则走 HTTP 兜底。

---

## 1. 与 Zed Git 功能的映射(范围裁剪)

| Zed 功能 | 本插件 | 说明 |
|---|---|---|
| Git Panel(变更列表 + 暂存区 + 提交) | **M1 核心** | staged / unstaged / untracked 三分组,勾选即 stage/unstage |
| Commit(Cmd+Enter + 展开编辑器) | **M1 核心** | |
| Branch 切换 / 新建 | **M1 核心**(轻量) | 下拉切换 + 新建;删除带确认放 M2 |
| Undo commit(reset HEAD^ --soft) | M2 | 一个按钮 |
| Project Diff | M2 | 只读 unified diff;Zed 的多 buffer 编辑不做 |
| Fetch / Push / Pull | M2 | 尊重 pushRemote(git 原生行为) |
| Stash 系列 | M3 | |
| File History | M3 | |
| AI commit message | M3(天然优势) | 一键把 diff 塞给当前会话 Agent —— Zed 要配 provider,这里就是当前会话本身 |
| Merge conflict 三选一 | M3+ | 依赖 diff 视图成熟 |
| Gutter / inline blame | **不做** | DSH 无编辑器 gutter 概念 |
| Worktree 管理 UI | **不做** | 内置 experimental-worktree 已覆盖 |

---

## 2. 插件形态(单包双面,零构建)

```
git-panel/
├── package.json          # name: @deepseek-ai/dsh-git-panel
│                         #   main → lib/index.js(宿主服务)
│                         #   exports: { ".": lib/index.js, "./client": lib/client.js }
│                         #   dsh.bundle.patch → ./cordis.patch.yml
│                         #   dsh.client: { platform: "web", inject: [包名...] }  ← 仅信息性,决定脚本到达顺序
├── cordis.patch.yml      # - insert: [{ id: git-panel, name: @deepseek-ai/dsh-git-panel }]
├── lib/
│   ├── index.js          # 宿主:GitPanelController(cordis Service)
│   ├── git.js            # git 命令封装(零依赖,解析函数独立导出)
│   └── client.js         # 浏览器:__ModuleLoader__.load 包装,右栏页签 UI
├── test/
│   ├── git-parse.test.mjs
│   └── client-logic.test.cjs
└── README.md
```

装载(与你现有插件同一条工作流,无需新知识):
1. 插件目录放本处,profile `package.json` 加 `"@deepseek-ai/dsh-git-panel": "link:<本目录>"`;
2. `dsh.profile.bundles` 加包名(或直接在 profile 的 `cordis.patch.yml` insert);
3. 重启 profile 生效。

⚠️ 注意:你 branch-manager 的 inject 里 `@deepseek-ai/dsh-client-runtime` 是 0.1.0 时代陈旧包名(0.1.5 起已拆分为 `dsh-client-web` / `dsh-client-modules` / `dsh-cordis-client-runner`),信息性引用不报错,新插件不再带它。

---

## 3. Host 侧设计

### 3.1 跑 git 的标准姿势(照抄 worktree 包)

```js
// git.js 核心:一律 spawn 参数数组,不经 shell,无注入面
static inject = ['workingDirectory', 'subprocess', 'sandbox', 'sandboxPolicy', 'typert']

async run(cwd, argv, { timeoutMs = 15000 } = {}) {
  const program  = await ctx.subprocess.resolveExecutable('git', undefined, signal)
  const confine  = await ctx.sandbox.confine(['git', ...argv], policy, signal)   // 遵循沙箱策略
  const child    = ctx.subprocess.spawn({
    argv: confine.argv, cwd,
    env: { ...GIT_ENV, GIT_TERMINAL_PROMPT: '0' },   // 剥 GIT_DIR/GIT_WORK_TREE 等继承选择器,禁交互提示
    stdio: { stdin: 'ignore', stdout: { maxBytes }, stderr: { maxBytes } },
    signal, graceMs,
  })
  const outcome = await child.done
  return { code: outcome.code, stdout: child.collected.stdout.readFrom(0), stderr: ... }
}
```

### 3.2 原子操作白名单(不提供任意命令透传)

`status` / `stage` / `unstage` / `commit` / `branchList` / `branchCreate` / `switch` / `branchDelete` / `diffFile` / `log` / `fetch` / `push` / `pull` / `stashList` / `stashApply` / `stashPop` / `stashDrop` / `undoCommit` / `discardFile`
- 危险操作(force push、删分支、discard)要求显式 `confirm: true` 参数,UI 二次确认;
- 机器可读输出:`status --porcelain=v2 --branch`、`log --pretty=%H%x1f%h%x1f%an%x1f%at%x1f%s%x1e`,解析为纯函数便于单测。

### 3.3 cwd 与多仓

- 会话级:`ctx.workingDirectory.get(agent.session)`(terminal-controller 的 `environment()` 同款;Typert 方法首参 `agent` 由网关按 sessionId 注入);
- v1 单仓:面板头显示 `rev-parse --show-toplevel` 的仓库根;非 git 目录显示提示 + `git init` 按钮;多仓列 M3。

### 3.4 暴露给客户端 —— 关键架构决策

**首选:自建 `TypertRemoteService`(仿 terminal-controller)**

```js
export class GitPanelController extends TypertRemoteService {
  static inject = ['workingDirectory', 'subprocess', 'sandbox', 'sandboxPolicy', 'typert']
  constructor(ctx, config) { super(ctx, 'gitPanelController', { namespace: 'gitPanel' }) }
  @Remote status(agent, signal)            { return this.gitSnapshot(this.cwdOf(agent, signal)) }
  @Remote stage(agent, paths, signal)      { ... }
  @Remote commit(agent, message, signal)   { ... }
  ...
}
```

客户端:
```js
export const inject = ['remote', 'slots', 'connection']
export function apply(ctx) {
  ctx.remote.$mount(gitPanelRemote)                       // ← M0 要验证的一步
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: 'git-panel', inject: (sessionId) => ({ sessionId }) },
    GitPanelTab))
}
```

**兜底:插件自带 loopback HTTP 端点**(terminal-command-log 有先例)
- 仅绑 `127.0.0.1` + 随机端口;校验 `Host` 头 = 本端口、`Origin` ∈ {GUI 来源, 空},防 DNS rebinding / CSRF;
- 局限:GUI 若经远程访问(dsh-api-remote-access 场景)此路不通,必须回首选方案。

已否决:借官方 `remote.terminal` PTY 跑 git 再解析 —— PTY 无干净结束信号,输出解析脆弱。

---

## 4. Client 侧设计

### 4.1 入口:**右侧栏页签**(Zed 式常驻面板)

照抄内置终端的组合拳(`ui-sidebar-terminal/src/client/index.ts:71-101`):
```js
ctx.sidebarRightTabs.register({ id: 'git-panel', kind: 'git', multiple: false,
                                priority: 'plugin', title: () => 'Git' })
ctx.slots.inject('sidebar.right.pane.tab', ...)   // 页签体
ctx.slots.inject('sidebar.right.pane.tab.title', ...) // 可选:标题角标(变更数)
```
- 免费获得 `useWorkspaces` 等标准 props(slot 组件 GlobalStandardProps 自带);
- `ctx.slots.inject(key, cb)` 是"等槽声明存在再注册",加载时序安全;
- ⚠️ 永不注册 `sidebar` 本体(会整栏替换左栏);`shell.overlay` FAB 留作备选。

### 4.2 自动刷新(对标 Zed "instantly reflected")

现成链路,零自建:
```js
remote.$stream({ open: (after, signal) =>
  remote.workspaceFiles.changes(sessionId, workspaceRoot, signal) })   // fs/observed 驱动的 stream
  → 防抖 300ms → 重取 git status
```
叠加:面板内任何写操作成功后立即重取;页签从隐藏→显示时重取。

### 4.3 面板布局

```
┌──────────────────────────────────────┐
│ ⎇ main [▾]      ↑1 ↓2   [fetch][⋯]  │  分支切换 / ahead-behind / 同步
├──────────────────────────────────────┤
│ ▾ 已暂存 (2)                          │
│   ☑ M lib/client.js        +42 −8    │  勾选=unstage;点文件名展开 diff
│   ☑ A README.md            +18 −0    │
│ ▾ 未暂存 (1)                          │
│   ☐ M lib/git.js            +5 −2    │
│ ▾ 未跟踪 (1)                          │
│   ☐ notes/design.md                  │
├──────────────────────────────────────┤
│ [commit 输入框………………]  ⌘⏎ 提交 (2)  │
├──────────────────────────────────────┤
│ a1b2c3d feat: porcelain v2  · 3 分钟前│  最近提交(M1 只读)
└──────────────────────────────────────┘
```

- 主题:一律 `var(--dsw-alias-*)` + fallback(branch-manager v5 的 67 处教训直接继承);
- RPC 双信封复用 branch-manager 的 `unwrap()`;
- diff 展示:M1 文件行下内嵌 unified diff(等宽 + ±行着色),M2 升独立视图。

---

## 5. 决策点回填(调研结论)

| # | 问题 | 结论 |
|---|---|---|
| 1 | client→host 通道 | 首选自建 TypertRemoteService + `ctx.remote.$mount`(M0 验证);兜底 loopback HTTP(§3.4) |
| 2 | 面板入口 | `sidebar.right.pane.tab` 右栏页签(终端同款,模式有源码样例);FAB 备选 |
| 3 | cwd 获取 | 服务端 `ctx.workingDirectory.get(agent.session)`;客户端槽组件自带 `useWorkspaces` |
| 4 | 变更推送 | `remote.workspaceFiles.changes` 现成 stream,防抖后刷新,无需自建推送 |

---

## 6. 里程碑

- **M0 —— 技术验证 spike(半天)**:双端骨架 + `ping()` echo:验证 ①第三方 remote 能否 $mount 并经 Gateway mux 调通;②右栏页签能注册显示;③`workspaceFiles.changes` 流能收到。任一失败 → 切兜底方案(只影响 ①)。
- **M1 (v0.1) —— 面板闭环**:status 三分组 + 勾选 stage/unstage + commit + 分支显示/切换 + 自动刷新。做完即"天天能用"。
- **M2 (v0.2)**:diff 视图、undo commit、fetch/push/pull、新建/删除分支、非 git 目录提示。
- **M3 (v0.3)**:stash、file history、AI commit message、多仓工作区。

## 7. 风险清单

1. **第三方 remote 挂载无先例**(唯一真风险)→ M0 首验;失败退 HTTP,体验损失仅限远程访问 GUI 场景。
2. **typert 生成工件跨版本稳定性** → M0 顺带确认 `./typert`/`./remote` 工件格式能否手写/是否必须跑官方 generator;若必须 generator,则插件引入最小构建步(仅生成工件,UI 仍零构建)。
3. git 输出解析 → 只依赖 porcelain v2 与固定分隔符,解析函数 100% 单测。
4. 大仓库性能 → status/diff 有 maxBytes 截断 + 防抖;不够再 lazy。
5. 与内置 `dsh-workspace-changes` 完全独立,不依赖其内部接口。

### v0.1.1(修复)
- exec.js 补 git 前缀(spawn rev-parse ENOENT 修复)
