// lib/client-logic.js — client 侧纯逻辑:视图模型组装、时间格式化。与传输层无关,可独立单测。
// client.js(React 组件)只做渲染;数据→视图模型的全部分叉都在这里,便于 node 单测。

/** 相对时间:刚刚/N 分钟前/N 小时前/N 天前/M月D日(继承 branch-manager 的 UX 约定)。 */
export function relTime(ts, now = Date.now()) {
  if (!ts) return ''
  let diff = now - ts
  if (diff < 0) diff = 0
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return m + ' 分钟前'
  const hh = Math.floor(m / 60)
  if (hh < 24) return hh + ' 小时前'
  const d = Math.floor(hh / 24)
  if (d < 30) return d + ' 天前'
  const dt = new Date(ts)
  return (dt.getMonth() + 1) + '月' + dt.getDate() + '日'
}

export function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n) + '…' : (s || '')
}

/** numstat 数组 → { path: { added, deleted } } 索引。 */
export function numstatIndex(list) {
  const idx = {}
  for (const it of list || []) idx[it.path] = { added: it.added, deleted: it.deleted, binary: it.binary }
  return idx
}

/**
 * 组装面板视图模型。
 * @param status  git.js parseStatusV2 的结果
 * @param stagedNumstat / unstagedNumstat  git.js numstat({staged}) 的结果
 */
export function buildViewModel(status, stagedNumstat, unstagedNumstat) {
  const s = status || {}
  const br = s.branch || {}
  const stg = numstatIndex(stagedNumstat)
  const uns = numstatIndex(unstagedNumstat)

  const decorate = (e, idx) => ({
    path: e.path,
    state: e.state,
    x: e.x, y: e.y,
    origPath: e.origPath || null,
    renamed: !!e.renamed,
    added: idx[e.path] ? idx[e.path].added : null,
    deleted: idx[e.path] ? idx[e.path].deleted : null,
    binary: idx[e.path] ? !!idx[e.path].binary : false,
    conflicted: e.y === 'U' || e.x === 'U',
  })

  const sections = []
  if (s.staged && s.staged.length) sections.push({ id: 'staged', title: '已暂存', entries: s.staged.map(e => decorate(e, stg)) })
  if (s.unstaged && s.unstaged.length) sections.push({ id: 'unstaged', title: '未暂存', entries: s.unstaged.map(e => decorate(e, uns)) })
  if (s.untracked && s.untracked.length) sections.push({ id: 'untracked', title: '未跟踪', entries: s.untracked.map(e => decorate(e, {})) })

  return {
    branch: {
      head: br.head,
      oid: br.oid,
      upstream: br.upstream || null,
      ahead: br.ahead ?? null,
      behind: br.behind ?? null,
      detached: br.head == null,
    },
    sections,
    conflicted: (s.conflicted || []).map(c => c.path),
    total: sections.reduce((n, sec) => n + sec.entries.length, 0),
  }
}

/** ahead/behind 角标文本:'↑1 ↓2' / '↑1' / '↓2' / ''(无 upstream 时)。 */
export function aheadBehindLabel(b) {
  if (!b || b.upstream == null) return ''
  const parts = []
  if (b.ahead > 0) parts.push('↑' + b.ahead)
  if (b.behind > 0) parts.push('↓' + b.behind)
  return parts.join(' ')
}

/** 状态单字母 → 展示记号(带语义色由 UI 决定,这里只给字符)。 */
export function stateMark(entry) {
  const m = { added: 'A', modified: 'M', deleted: 'D', renamed: 'R', copied: 'C', typechange: 'T', unmerged: 'U' }
  return m[entry.state] || (entry.conflicted ? 'U' : 'M')
}

/**
 * 提交校验:非空、不以 # 开头的注释行(允许但会剔除后为空则拒绝)。
 * 返回 null 或错误消息。
 */
export function validateCommitMessage(msg) {
  const t = (msg || '').replace(/^#.*$/gm, '').trim()
  if (!t) return '提交信息不能为空'
  return null
}
