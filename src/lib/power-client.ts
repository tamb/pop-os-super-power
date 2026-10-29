import type { GraphicsMode, PowerProfile } from "./constants.ts";
import {
  execResultLooksLikePermissionDenied,
  formatExecFailure,
  pkexecSystem76PowerCommand,
  type SessionEnv,
  shellQuote,
  system76PowerCommand,
} from "./shell.ts";
import {
  graphicsModeForUi,
  parseGraphicsOutput,
  parseProfileOutput,
  parseSwitchableOutput,
} from "./system76-output.ts";

export type ExecResult = {
  exitCode: number;
  stdOut: string;
  stdErr: string;
};

export type CommandRunner = (command: string) => Promise<ExecResult>;

export async function runSystem76Power(
  args: string,
  env: SessionEnv,
  run: CommandRunner,
): Promise<string> {
  let result = await run(system76PowerCommand(args, env));

  if (
    result.exitCode !== 0 &&
    execResultLooksLikePermissionDenied(result.stdOut, result.stdErr)
  ) {
    result = await run(pkexecSystem76PowerCommand(args, env));
  }

  if (result.exitCode !== 0) {
    throw new Error(
      formatExecFailure(result.exitCode, result.stdOut, result.stdErr),
    );
  }

  return result.stdOut.trim();
}

export async function commandExists(
  name: string,
  run: CommandRunner,
): Promise<boolean> {
  const result = await run(
    `command -v ${shellQuote(name)} >/dev/null 2>&1; echo $?`,
  );
  return result.stdOut.trim() === "0";
}

export async function rebootSystem(run: CommandRunner): Promise<void> {
  const result = await run("loginctl reboot");
  if (result.exitCode === 0) {
    return;
  }

  const elevated = await run("pkexec loginctl reboot");
  if (elevated.exitCode !== 0) {
    throw new Error(
      formatExecFailure(
        elevated.exitCode,
        elevated.stdOut,
        elevated.stdErr,
        "loginctl reboot",
      ),
    );
  }
}

export async function fetchProfile(
  env: SessionEnv,
  run: CommandRunner,
): Promise<PowerProfile> {
  return parseProfileOutput(await runSystem76Power("profile", env, run));
}

export async function fetchGraphicsMode(
  env: SessionEnv,
  run: CommandRunner,
): Promise<GraphicsMode> {
  const raw = parseGraphicsOutput(await runSystem76Power("graphics", env, run));
  return graphicsModeForUi(raw);
}

export async function fetchSwitchable(
  env: SessionEnv,
  run: CommandRunner,
): Promise<boolean> {
  return parseSwitchableOutput(
    await runSystem76Power("graphics switchable", env, run),
  );
}

export async function applyProfile(
  profile: PowerProfile,
  env: SessionEnv,
  run: CommandRunner,
): Promise<void> {
  await runSystem76Power(`profile ${profile}`, env, run);
}

export async function applyGraphics(
  mode: GraphicsMode,
  env: SessionEnv,
  run: CommandRunner,
): Promise<void> {
  await runSystem76Power(`graphics ${mode}`, env, run);
}
