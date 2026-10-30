import {
  GRAPHICS_MODES,
  type GraphicsMode,
  isPowerProfile,
  type PowerProfile,
} from "./constants.ts";

export function parseProfileOutput(output: string): PowerProfile {
  const match = output.match(/Power Profile:\s*(\w+)/i);
  if (!match || !isPowerProfile(match[1].toLowerCase())) {
    throw new Error("Could not read power profile from system76-power.");
  }
  return match[1].toLowerCase() as PowerProfile;
}

export type RawGraphicsMode = GraphicsMode | "compute";

export function parseGraphicsOutput(output: string): RawGraphicsMode {
  const mode = output.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (mode === "compute") {
    return "compute";
  }
  if (!(GRAPHICS_MODES as readonly string[]).includes(mode)) {
    throw new Error(`Unexpected graphics mode: ${output.trim()}`);
  }
  return mode as GraphicsMode;
}

/** Map compute mode to integrated for UI toggles. */
export function graphicsModeForUi(raw: RawGraphicsMode): GraphicsMode {
  return raw === "compute" ? "integrated" : raw;
}

export function parseSwitchableOutput(output: string): boolean {
  const firstLine = output.trim().split(/\n/)[0]?.trim().toLowerCase() ?? "";
  return firstLine === "switchable";
}

export function shouldShowRebootBanner(
  baseline: GraphicsMode | null,
  selected: GraphicsMode,
): boolean {
  return baseline !== null && selected !== baseline;
}

/**
 * system76-power fails the whole profile switch when any SCSI host rejects
 * link power management. Empty or firmware-locked AHCI ports return
 * EOPNOTSUPP (os error 95, often `keep_firmware_settings`) or ENOENT
 * (os error 2) when the policy file is missing. Other profile settings
 * still apply.
 */
export function isUnsupportedScsiHostProfileFailure(message: string): boolean {
  const marker = /errors found when setting profile:?/i.exec(message);
  if (!marker) {
    return false;
  }

  const body = message.slice(marker.index + marker[0].length);
  const bullets = body
    .split(/\s+-\s+(?=failed to )/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return bullets.length > 0 && bullets.every(isUnsupportedScsiLinkPmBullet);
}

function isUnsupportedScsiLinkPmBullet(bullet: string): boolean {
  return (
    /failed to set scsi host profiles/i.test(bullet) &&
    /link time power management policy/i.test(bullet) &&
    /operation not supported|no such file or directory|os error 95\b|os error 2\b/i.test(
      bullet,
    )
  );
}
