// test/insights.test.mjs — 洞察页数据解析(parseInsights)单测
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseInsights } from '../lib/git.js'

const NOW = Math.floor(Date.now() / 1000)
const Y = (n) => NOW - n * 86400

test('parseInsights:提交计数/行数/作者/文件/目录聚合', () => {
  const fixture = [
    `\x02h1\x1f${NOW}\x1falice`, '10\t2\tsrc/app.js', '5\t0\tREADME.md', '',
    `\x02h2\x1f${Y(1)}\x1fbob`, '3\t1\tsrc/util.js', '-\t-\timg.png',
    `\x02h3\x1f${Y(40)}\x1falice`, '1\t1\tdocs/guide.md', // 超出 30 天窗口:计 commits,不入日序列
  ].join('\n')
  const out = parseInsights(fixture, 30)
  assert.equal(out.totals.commits, 3)
  assert.equal(out.totals.ins, 19)
  assert.equal(out.totals.del, 4)
  assert.equal(out.totals.authors, 2)
  assert.equal(out.days.length, 30, '日序列固定 30 天')
  assert.equal(out.days.reduce((n, d2) => n + d2.commits, 0), 2, '超窗提交不入日序列')
  assert.ok(out.heat.length >= 28, '热力格至少 28 天')
  assert.deepEqual(out.authors.map(a => a.name), ['alice', 'bob'], '作者按提交数排序')
  assert.equal(out.files.find(f2 => f2.name === 'src/app.js').churn, 12, '文件 churn=ins+del')
  assert.deepEqual(out.dirs.map(d2 => d2.name), ['src', '(根目录)', 'docs'], '目录归属正确')
})

test('parseInsights:空输出不崩且日序列齐全', () => {
  const out = parseInsights('', 30)
  assert.equal(out.totals.commits, 0)
  assert.equal(out.days.length, 30)
  assert.deepEqual(out.authors, [])
  assert.deepEqual(out.files, [])
})

test('parseInsights:binary 行(-\t-)计零', () => {
  const out = parseInsights(`\x02h1\x1f${NOW}\x1fa\n-\t-\tbin.dat`, 30)
  assert.equal(out.totals.ins, 0)
  assert.equal(out.totals.del, 0)
})
