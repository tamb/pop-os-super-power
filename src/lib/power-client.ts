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
  isUnsupportedScsiHostProfileFailure,
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

export type System76RunOptions = {
  /** Called once, before the pkexec retry, when the first attempt is denied. */
  onPermissionPrompt?: () => void;
};

export async function runSystem76Power(
  args: string,
  env: SessionEnv,
  run: CommandRunner,
  options: System76RunOptions = {},
): Promise<string> {
  let result = await run(system76PowerCommand(args, env));

  if (
    result.exitCode !== 0 &&
    execResultLooksLikePermissionDenied(result.stdOut, result.stdErr)
  ) {
    options.onPermissionPrompt?.();
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

export type ProfileApplyResult = {
  /** True when a SCSI host rejected link power management but the profile was set. */
  scsiLinkPmSkipped: boolean;
};

export async function applyProfile(
  profile: PowerProfile,
  env: SessionEnv,
  run: CommandRunner,
): Promise<ProfileApplyResult> {
  try {
    await runSystem76Power(`profile ${profile}`, env, run);
    return { scsiLinkPmSkipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isUnsupportedScsiHostProfileFailure(message)) {
      throw err;
    }

    // The daemon records the profile, returns this D-Bus error, and skips the
    // desktop profile-changed signal. A second call sees the profile as
    // already set, succeeds, and emits the signal.
    try {
      await runSystem76Power(`profile ${profile}`, env, run);
      return { scsiLinkPmSkipped: true };
    } catch (retryErr) {
      const retryMessage =
        retryErr instanceof Error ? retryErr.message : String(retryErr);
      if (!isUnsupportedScsiHostProfileFailure(retryMessage)) {
        throw retryErr;
      }

      let active: PowerProfile;
      try {
        active = await fetchProfile(env, run);
      } catch {
        throw err;
      }
      if (active !== profile) {
        throw err;
      }
      return { scsiLinkPmSkipped: true };
    }
  }
}

export async function applyGraphics(
  mode: GraphicsMode,
  env: SessionEnv,
  run: CommandRunner,
  options: System76RunOptions = {},
): Promise<void> {
  await runSystem76Power(`graphics ${mode}`, env, run, options);
}
