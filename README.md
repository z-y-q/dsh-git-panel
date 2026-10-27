# @deepseek-ai/dsh-git-panel

Zed 风格的 Git 面板,DeepSeek Harness 右栏页签。双端插件、零构建、纯 JS。

## 功能(v0.3.x)

- **变更页签**:三分组列表(已暂存/变更/未跟踪,可折叠)、按文件勾选暂存、每文件 ±n 统计、
  行内 diff、✨ AI 生成提交信息(宿主侧一次性 LLM 调用,用会话默认模型)、提交(⌘/Ctrl+Enter)
- **历史页签**:Git Graph 泳道图(彩色泳道、贝塞尔分叉/合并、HEAD 圆环、tag/分支徽章、作者头像)、
  提交搜索(n/m 计数)、点选节点下钻变更文件与单文件 diff(含提交正文)
- **分支**:切换、新建(创建即切换)、删除(两击确认,当前分支不可删)
- **远端**:Fetch / Pull / Push(无上游自动 `-u origin HEAD`;结构性无强推通道,有测试断言)
- **底部**:上次提交 + ↩ 撤销(两击确认,soft reset)
- **工程质量**:轮询页面隐藏暂停 + 错误指数退避;status 每次 5 次 git spawn;diff 缓存按统计签名
  失效;SafePanel 渲染错误边界(崩溃显示可重试错误卡);泳道数上限;中英文案跟随界面语言

## 架构

- **宿主半边** `lib/index.js` — `TypertRemoteService` 子类(网关 SRC 模式,`static inject`),
  20 个白名单原子操作;AI 走 `ctx.llm.prepareCall → stream`(官方 session-title-llm 同款)
- **客户端半边** `lib/client.js` — 右栏页签两阶段注册;直连 `connection.rpc.call('/api', 'gitPanel/…')`;
  `__graphLayout` / `__testables` 导出供 node 直测出货代码
- `lib/git.js` — porcelain v2 解析与白名单命令封装(26 个单测,含真实仓库端到端)

## 开发

```sh
pnpm install            # 依赖(typert-protocol / cordis / react / react-dom,供宿主导入与无头测试)
pnpm test               # 26 测试
./package.sh            # 打检查点压缩包(只归档已提交内容;先 commit 再打包)
```

安装:在会话内用 plugin_manager `install_bundle` 指向本目录,或
`dsh plugin --profile <name> add "$(pwd)"`。刷新 GUI,右栏引导页点「Git」。

## 路线图

多仓库切换、blame、stash、rebase/cherry-pick 等重操作属独立立项量级。
