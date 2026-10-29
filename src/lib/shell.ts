/** Shell-quote a value for POSIX `sh` (single-quoted string). */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export type SessionEnv = {
  display?: string;
  xauthority?: string;
};

/** Prefix for running GUI/polkit commands from a desktop session. */
export function sessionEnvPrefix(env: SessionEnv): string {
  const parts: string[] = [];
  if (env.display) {
    parts.push(`DISPLAY=${shellQuote(env.display)}`);
  }
  if (env.xauthority) {
    parts.push(`XAUTHORITY=${shellQuote(env.xauthority)}`);
  }
  if (parts.length === 0) {
    return "";
  }
  return `env ${parts.join(" ")} `;
}

export function system76PowerCommand(args: string, env: SessionEnv = {}): string {
  return `${sessionEnvPrefix(env)}system76-power ${args}`;
}

export function pkexecSystem76PowerCommand(
  args: string,
  env: SessionEnv = {},
): string {
  return `${sessionEnvPrefix(env)}pkexec system76-power ${args}`;
}

const PERMISSION_DENIED =
  /permission|polkit|not permitted|Operation not permitted/i;

export function execResultLooksLikePermissionDenied(
  stdout: string,
  stderr: string,
): boolean {
  return PERMISSION_DENIED.test(`${stderr}\n${stdout}`);
}

export function formatExecFailure(
  exitCode: number,
  stdout: string,
  stderr: string,
): string {
  const detail = (stderr || stdout).trim();
  return detail || `system76-power failed (exit ${exitCode})`;
}
