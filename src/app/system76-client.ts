import {
  type GraphicsMode,
  type PowerProfile,
} from "../lib/constants.ts";
import {
  execResultLooksLikePermissionDenied,
  formatExecFailure,
  pkexecSystem76PowerCommand,
  system76PowerCommand,
} from "../lib/shell.ts";
import {
  graphicsModeForUi,
  parseGraphicsOutput,
  parseProfileOutput,
  parseSwitchableOutput,
} from "../lib/system76-output.ts";
import {
  execCommand,
  getSessionEnv,
} from "./neutralino-runtime.ts";

export async function runSystem76Power(args: string): Promise<string> {
  const env = await getSessionEnv();
  let cmd = system76PowerCommand(args, env);
  let result = await execCommand(cmd);

  if (
    result.exitCode !== 0 &&
    execResultLooksLikePermissionDenied(result.stdOut, result.stdErr)
  ) {
    cmd = pkexecSystem76PowerCommand(args, env);
    result = await execCommand(cmd);
  }

  if (result.exitCode !== 0) {
    throw new Error(
      formatExecFailure(result.exitCode, result.stdOut, result.stdErr),
    );
  }

  return (result.stdOut || "").trim();
}

export async function commandExists(name: string): Promise<boolean> {
  const result = await execCommand(
    `command -v ${name} >/dev/null 2>&1; echo $?`,
  );
  return result.stdOut.trim() === "0";
}

export async function rebootSystem(): Promise<void> {
  const result = await execCommand("loginctl reboot");
  if (result.exitCode !== 0) {
    const pk = await execCommand("pkexec loginctl reboot");
    if (pk.exitCode !== 0) {
      throw new Error(
        formatExecFailure(
          pk.exitCode,
          pk.stdOut || result.stdOut,
          pk.stdErr || result.stdErr,
        ) || "Could not start reboot.",
      );
    }
  }
}

export async function fetchProfile(): Promise<PowerProfile> {
  return parseProfileOutput(await runSystem76Power("profile"));
}

export async function fetchGraphicsMode(): Promise<GraphicsMode> {
  const raw = parseGraphicsOutput(await runSystem76Power("graphics"));
  return graphicsModeForUi(raw);
}

export async function fetchSwitchable(): Promise<boolean> {
  return parseSwitchableOutput(await runSystem76Power("graphics switchable"));
}

export async function applyProfile(profile: PowerProfile): Promise<void> {
  await runSystem76Power(`profile ${profile}`);
}

export async function applyGraphics(mode: GraphicsMode): Promise<void> {
  await runSystem76Power(`graphics ${mode}`);
}

export { messageFromError } from "../lib/errors.ts";
