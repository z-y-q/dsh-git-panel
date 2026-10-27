// test/client-logic.test.mjs — client 纯逻辑单测
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  relTime, truncate, numstatIndex, buildViewModel,
  aheadBehindLabel, stateMark, validateCommitMessage,
} from '../lib/client-logic.js'

test('relTime', () => {
  const now = Date.now()
  assert.equal(relTime(now - 30_000, now), '刚刚')
  assert.equal(relTime(now - 5 * 60_000, now), '5 分钟前')
  assert.equal(relTime(now - 3 * 3600_000, now), '3 小时前')
  assert.equal(relTime(now - 2 * 86400_000, now), '2 天前')
  assert.equal(relTime(0, now), '')
})

test('truncate', () => {
  assert.equal(truncate('abcdef', 4), 'abcd…')
  assert.equal(truncate('ab', 4), 'ab')
  assert.equal(truncate(null, 4), '')
})

test('buildViewModel: 三分组 + numstat 合并 + 分支', () => {
  const status = {
    branch: { oid: 'x', head: 'main', upstream: 'origin/main', ahead: 1, behind: 2 },
    staged: [{ path: 'a.js', x: 'A', state: 'added' }],
    unstaged: [{ path: 'a.js', y: 'M', state: 'modified' }, { path: 'b.js', y: 'D', state: 'deleted' }],
    untracked: [{ path: 'n.md' }],
    conflicted: [],
  }
  const vm = buildViewModel(status, [{ path: 'a.js', added: 3, deleted: 0 }], [{ path: 'a.js', added: 1, deleted: 2 }, { path: 'b.js', added: 0, deleted: 9 }])
  assert.equal(vm.branch.head, 'main')
  assert.equal(vm.total, 4)
  assert.deepEqual(vm.sections.map(s => s.id), ['staged', 'unstaged', 'untracked'])
  const staged = vm.sections[0].entries[0]
  assert.equal(staged.added, 3)
  const unstagedA = vm.sections[1].entries[0]
  assert.equal(unstagedA.deleted, 2)
  assert.equal(vm.sections[1].entries[1].deleted, 9)
  assert.equal(vm.sections[2].entries[0].added, null)
})

test('buildViewModel: 空仓库与 detached', () => {
  const vm = buildViewModel({ branch: { head: null }, staged: [], unstaged: [], untracked: [], conflicted: [] }, [], [])
  assert.equal(vm.branch.detached, true)
  assert.equal(vm.total, 0)
  assert.deepEqual(vm.sections, [])
})

test('aheadBehindLabel', () => {
  assert.equal(aheadBehindLabel({ upstream: 'o/m', ahead: 1, behind: 2 }), '↑1 ↓2')
  assert.equal(aheadBehindLabel({ upstream: 'o/m', ahead: 3, behind: 0 }), '↑3')
  assert.equal(aheadBehindLabel({ upstream: 'o/m', ahead: 0, behind: 0 }), '')
  assert.equal(aheadBehindLabel({ upstream: null, ahead: 1 }), '')
})

test('stateMark', () => {
  assert.equal(stateMark({ state: 'added' }), 'A')
  assert.equal(stateMark({ state: 'renamed' }), 'R')
  assert.equal(stateMark({ state: 'whatever', conflicted: true }), 'U')
})

test('validateCommitMessage', () => {
  assert.equal(validateCommitMessage('feat: x'), null)
  assert.equal(validateCommitMessage('# 注释\nfeat: x'), null)
  assert.equal(validateCommitMessage('   '), '提交信息不能为空')
  assert.equal(validateCommitMessage('# 只有注释'), '提交信息不能为空')
  assert.equal(validateCommitMessage(null), '提交信息不能为空')
})
