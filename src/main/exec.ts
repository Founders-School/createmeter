import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function runCommand(
  file: string,
  args: string[],
  timeoutMs = 2000
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout: timeoutMs,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    })
    return { stdout: stdout ?? '', stderr: stderr ?? '', ok: true }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? String(error),
      ok: false
    }
  }
}

export function escapeAppleScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
