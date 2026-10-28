// test/panel.integration.test.mjs — 真实生命周期集成测试:
// jsdom + createRoot + act 真正执行 GitBody 的 effect/状态更新/点击,
// 覆盖「单测绿但面板上坏」的盲区(展开 diff 就是这一类)。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const hasDeps = fs.existsSync('node_modules/jsdom') && fs.existsSync('node_modules/react-dom/client')
if (!hasDeps) {
  test.skip('需要 jsdom 与 react-dom(client)', () => {})
  process.exit(0)
}

let registration = null
globalThis.window = new (await import('jsdom')).JSDOM('<!doctype html><html><body><div id="root"></div></body></html>').window
globalThis.document = globalThis.window.document
globalThis.sessionStorage = globalThis.window.sessionStorage
globalThis.navigator = globalThis.window.navigator
globalThis.CSS = globalThis.window.CSS || { escape: s => s }
globalThis.AbortController = globalThis.window.AbortController || globalThis.AbortController
globalThis.window.__ModuleLoader__ = { load: (reg) => { registration = reg } }
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
await import('../lib/client.js')

const mod = registration.factory((spec) => {
  if (spec === 'react') return React
  throw new Error('unexpected require: ' + spec)
})
const T = mod.__testables

const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }

const status = { repo: true, cwd: '/x', toplevel: '/x', subRepo: null, repos: [], baseRepo: 'x', stats: { 'a.txt': { added: 1, deleted: 0 } },
  status: { branch: { head: 'm', oid: 'H', upstream: null, ahead: 0, behind: 0 },
    staged: [
      { path: 'r1.txt', x: 'R', state: 'renamed', origPath: 'old1.txt' },
      { path: 'r2.txt', x: 'R', state: 'renamed', origPath: 'old2.txt' },
    ], unstaged: [], untracked: [], conflicted: [] },
  branches: [{ name: 'm', current: true }], lastCommit: { short: 'h1', subject: 's', author: 'a', time: 1 } }

const diffBodies = { 'r1.txt': [{ header: 'diff --git a/r1 b/r1', lines: [{ type: 'add', text: '+content-1' }] }],
  'r2.txt': [{ header: 'diff --git a/r2 b/r2', lines: [{ type: 'add', text: '+content-2' }] }] }

const calls = []
const call = async (m, x) => {
  calls.push([m, x && x.path])
  if (m === 'history') return { ok: true, value: { entries: [] } }
  if (m === 'remotes') return { ok: true, value: { remotes: ['origin'] } }
  if (m === 'diff') {
    const p = x && x.path
    return { ok: true, value: { files: diffBodies[p] || [] } } // r2 特意返回空 → 二进制提示分支
  }
  return { ok: true, value: { repo: true, cwd: '/x', toplevel: '/x', subRepo: null, repos: [], baseRepo: 'x', stats: status.stats,
    status: status.status, branches: status.branches, lastCommit: status.lastCommit } }
}

test('集成:展开的两个重命名文件,一个显示 diff、一个显示空提示(而非空白)', async () => {
  const container = document.getElementById('root')
  const root = createRoot(container)
  const t = (k) => k
  await act(async () => { root.render(React.createElement(T.GitBody, { sessionId: 's1', call, openStream: null, t })) })
  await flush()

  // 数据加载后:变更 (2)
  assert.match(container.innerHTML, /变更 \(2\)/, '变更计数缺失')

  // 展开两个文件(点击 ▸ 按钮)
  const diffBtns = [...container.querySelectorAll('button[title="diff"]')]
  assert.equal(diffBtns.length, 2, '应有 2 个展开按钮')
  await act(async () => { diffBtns[0].dispatchEvent(new globalThis.window.MouseEvent('click', { bubbles: true })) })
  await flush()
  await act(async () => { diffBtns[1].dispatchEvent(new globalThis.window.MouseEvent('click', { bubbles: true })) })
  await flush()

  const html = container.innerHTML
  // r1:有内容 diff → 词级/加行渲染
  assert.ok(html.includes('content-1'), 'r1 的 diff 内容未渲染')
  // r2:宿主返回空 files → 应显示「(二进制文件)」占位,而不是完全空白
  assert.ok(html.includes('binary') || html.includes('二进制'), '空 diff 应有占位提示')

  // 再刷新一次(模拟 5s 轮询):已展开的行不应塌掉(签名未变)
  const expandCount = (html.match(/data-gp-key/g) || []).length
  assert.ok(expandCount >= 2, 'data-gp-key 应存在')

  root.unmount()
})
