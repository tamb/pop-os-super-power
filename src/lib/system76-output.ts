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
