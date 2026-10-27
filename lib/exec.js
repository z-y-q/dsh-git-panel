// lib/exec.js — 把 harness 的 subprocess/sandbox 服务缝合成 createGit 需要的 exec 函数。
//
// 契约:git.js 传来的 argv 是「git 子命令参数」(不含 git 本体),
// 本函数负责补上 git 可执行文件并 spawn(与 test/git-parse.test.mjs 的 realExec 同约定)。
// spawn 选项名(resolveExecutable/confine/graceMs/collected.readFrom)按官方
// terminal-controller/worktree 包先例;解析失败按原 argv 兜底,错误直达面板。
import { gitEnv } from './git.js'

export function createExec(services, log) {
	const { subprocess, sandbox, sandboxPolicy } = services
	if (!subprocess || typeof subprocess.spawn !== 'function') {
		throw new Error('exec: ctx.subprocess.spawn 不可用(实际: ' + describe(subprocess) + ')')
	}

	return async function exec({ argv, cwd, timeoutMs = 20000 }) {
		// git.js 的 argv 是子命令参数;这里拼上 git 本体
		const full = ['git', ...argv]
		let finalArgv = full
		const signal = AbortSignal.timeout(timeoutMs)

		// 1) 解析可执行文件绝对路径(terminal-controller 先例)
		try {
			if (typeof subprocess.resolveExecutable === 'function') {
				const program = await subprocess.resolveExecutable(full[0], undefined, signal)
				if (typeof program === 'string' && program) finalArgv = [program, ...full.slice(1)]
			}
		} catch (e) { if (log) log.warn?.('resolveExecutable 失败,使用原始 argv: %s', e?.message || e) }

		// 2) 沙箱收拢(遵循宿主策略;danger-full-access 或不可用时按原 argv)
		try {
			const policy = sandboxPolicy
			if (sandbox && policy && policy.mode && policy.mode !== 'danger-full-access') {
				const conf = await sandbox.confine(full, policy, signal)
				if (conf && Array.isArray(conf.argv)) finalArgv = conf.argv
			}
		} catch (e) { if (log) log.warn?.('sandbox.confine 失败,按原 argv 执行: %s', e?.message || e) }

		// 3) collect 模式 spawn(stdout/stderr 截断上限)
		const child = subprocess.spawn({
			argv: finalArgv,
			cwd,
			env: gitEnv({ ...process.env }),
			signal,
			graceMs: 500,
			stdio: { stdin: 'ignore', stdout: { maxBytes: 8 * 1024 * 1024 }, stderr: { maxBytes: 512 * 1024 } },
		})
		const outcome = await child.done
		// readFrom 返回 { text, nextOffset, lossy, spillPath? }(官方 output.ts 契约)
		const out = child.collected?.stdout?.readFrom(0)
		const err = child.collected?.stderr?.readFrom(0)
		const stdout = typeof out === 'string' ? out : (out?.text ?? '')
		const stderr = typeof err === 'string' ? err : (err?.text ?? '')
		const code = outcome?.code ?? outcome?.exitCode ?? outcome?.status ?? 1
		return { code, stdout, stderr }
	}
}

function describe(v) {
	if (v === null) return 'null'
	if (v === undefined) return 'undefined'
	if (typeof v !== 'object') return typeof v
	return '[' + Object.keys(v).slice(0, 12).join(', ') + ']'
}
