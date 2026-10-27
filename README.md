# @deepseek-ai/dsh-git-panel

Zed 风格的 Git 面板,DeepSeek Harness 右栏页签。双端插件、零构建:

- **宿主半边** `lib/index.js` — `TypertRemoteService` 子类(网关 SRC 模式),白名单 git 原子操作:
  `status / stage / unstage / stageAll / unstageAll / commit / checkout`
- **客户端半边** `lib/client.js` — 右栏页签(官方两阶段注册)+ M1 面板:三分组变更列表、
  按文件勾选暂存、提交(⌘/Ctrl+Enter)、分支切换、5s 自动刷新
- `lib/git.js` — porcelain v2 解析与白名单命令封装(21 个单测,含真实仓库端到端)

## 安装

```sh
# 在插件目录安装宿主依赖(link 安装靠本目录 node_modules 解析)
pnpm add -P "@deepseek-ai/dsh-typert-protocol@next" "@deepseek-ai/cordis@~4.0.5" react
# 装进当前 profile(官方链路)
dsh plugin --profile <name> add "$(pwd)"   # 或在会话内用 plugin_manager install_bundle
```

刷新 GUI 页面,右栏引导页会出现「Git」入口。

## 路线图

M2:diff 视图、undo commit、fetch/pull/push、建删分支、discard。M3:stash、file history、AI commit message。

## 演示
本文件被暂存用于面板演示。
