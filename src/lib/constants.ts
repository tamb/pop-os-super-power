export const PROFILES = ["battery", "balanced", "performance"] as const;
export type PowerProfile = (typeof PROFILES)[number];

export const GRAPHICS_MODES = ["integrated", "nvidia", "hybrid"] as const;
export type GraphicsMode = (typeof GRAPHICS_MODES)[number];

export function isPowerProfile(value: string): value is PowerProfile {
  return (PROFILES as readonly string[]).includes(value);
}

export function isGraphicsMode(value: string): value is GraphicsMode {
  return (GRAPHICS_MODES as readonly string[]).includes(value);
}
