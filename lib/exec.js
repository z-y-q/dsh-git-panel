// lib/exec.js — 把 harness 的 subprocess/sandbox 服务缝合成 createGit 需要的 exec 函数。
// ⚠️ spawn 选项名(resolveExecutable/confine/graceMs/collected.readFrom)按 worktree 包先例写,
//    M0 spike 在真实宿主上验证;失败会在面板上显示原始错误。
import { gitEnv } from './git.js'

export function createExec(services, log) {
  const { subprocess, sandbox, sandboxPolicy } = services
  if (!subprocess || typeof subprocess.spawn !== 'function') {
    throw new Error('exec: ctx.subprocess.spawn 不可用(实际: ' + describe(subprocess) + ')')
  }

  return async function exec({ argv, cwd, timeoutMs = 20000 }) {
    let finalArgv = argv
    const signal = AbortSignal.timeout(timeoutMs)

    // 1) 解析可执行文件绝对路径(worktree 先例:resolveExecutable)
    try {
      if (typeof subprocess.resolveExecutable === 'function') {
        const program = await subprocess.resolveExecutable(argv[0], undefined, signal)
        if (typeof program === 'string' && program) finalArgv = [program, ...argv.slice(1)]
      }
    } catch (e) { if (log) log.warn?.('resolveExecutable 失败,使用原始 argv: %s', e?.message || e) }

    // 2) 沙箱收拢(遵循宿主策略;danger-full-access 或不可用时按原 argv)
    try {
      const policy = sandboxPolicy
      if (sandbox && policy && policy.mode && policy.mode !== 'danger-full-access') {
        const conf = await sandbox.confine(argv, policy, signal)
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
    const stdout = child.collected?.stdout ? child.collected.stdout.readFrom(0) : ''
    const stderr = child.collected?.stderr ? child.collected.stderr.readFrom(0) : ''
    const code = outcome?.code ?? outcome?.exitCode ?? outcome?.status ?? 1
    return { code, stdout: stdout ?? '', stderr: stderr ?? '' }
  }
}

function describe(v) {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v !== 'object') return typeof v
  return '[' + Object.keys(v).slice(0, 12).join(', ') + ']'
}
