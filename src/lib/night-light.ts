/** Night Light (`cosmic-nightlight`) settings, stored as COSMIC config. */

export const NIGHT_LIGHT_APP_ID = "io.github.cosmic_nightlight";
export const NIGHT_LIGHT_MIN_KELVIN = 2500;
export const NIGHT_LIGHT_MAX_KELVIN = 6500;
export const NIGHT_LIGHT_DEFAULT_KELVIN = 4500;
export const NIGHT_LIGHT_DEFAULT_SUNRISE_MINUTES = 6 * 60;
export const NIGHT_LIGHT_DEFAULT_SUNSET_MINUTES = 18 * 60;
const MINUTES_PER_DAY = 24 * 60;

export type NightLightOverride = "auto" | "on" | "off";
export type NightLightSchedule = "manual" | "solar" | "custom";

export type NightLightSettings = {
  override: NightLightOverride;
  temperature: number;
  schedule: NightLightSchedule;
  sunriseMinutes: number;
  sunsetMinutes: number;
};

export function defaultNightLightSettings(): NightLightSettings {
  return {
    override: "auto",
    temperature: NIGHT_LIGHT_DEFAULT_KELVIN,
    schedule: "manual",
    sunriseMinutes: NIGHT_LIGHT_DEFAULT_SUNRISE_MINUTES,
    sunsetMinutes: NIGHT_LIGHT_DEFAULT_SUNSET_MINUTES,
  };
}

export function nightLightConfigDir(home: string): string {
  const root = home.replace(/\/+$/, "");
  return `${root}/.config/cosmic/${NIGHT_LIGHT_APP_ID}/v1`;
}

/** `true`/`false` when the tint state is known. `null` follows the real sun. */
export function nightLightTintOn(
  settings: NightLightSettings,
  minuteOfDay: number,
): boolean | null {
  if (settings.override === "on") {
    return true;
  }
  if (settings.override === "off") {
    return false;
  }
  if (settings.schedule === "manual") {
    return false;
  }
  if (settings.schedule === "solar") {
    return null;
  }
  return isNightAt(
    minuteOfDay,
    settings.sunriseMinutes,
    settings.sunsetMinutes,
  );
}

export function nightLightScheduleNote(
  settings: NightLightSettings,
): string | null {
  if (settings.override !== "auto") {
    return null;
  }
  if (settings.schedule === "custom") {
    return "A custom schedule is set. On and Off override it until the next change.";
  }
  if (settings.schedule === "solar") {
    return "Night Light is following sunrise and sunset. On and Off override that until the next change.";
  }
  return null;
}

export function parseNightLightOverride(
  raw: string | null,
): NightLightOverride {
  const value = ronString(raw);
  if (value === "on" || value === "off" || value === "auto") {
    return value;
  }
  return "auto";
}

export function parseNightLightSchedule(
  raw: string | null,
): NightLightSchedule {
  const value = ronString(raw);
  if (value === "solar") {
    return "solar";
  }
  if (value === "custom" || value === "sunset") {
    return "custom";
  }
  return "manual";
}

export function parseNightLightTemperature(raw: string | null): number {
  const value = parseU32(raw);
  if (
    value === null ||
    value < NIGHT_LIGHT_MIN_KELVIN ||
    value > NIGHT_LIGHT_MAX_KELVIN
  ) {
    return NIGHT_LIGHT_DEFAULT_KELVIN;
  }
  return value;
}

export function parseNightLightMinutes(
  raw: string | null,
  fallback: number,
): number {
  const value = parseU32(raw);
  if (value === null || value >= MINUTES_PER_DAY) {
    return fallback;
  }
  return value;
}

export function encodeNightLightString(value: string): string {
  return `"${value}"`;
}

/** Color temperature the Reset button writes. Night Light's own default. */
export function nightLightResetKelvin(): number {
  return NIGHT_LIGHT_DEFAULT_KELVIN;
}

/** Reset is available only while Night Light is usable and the slider has moved. */
export function nightLightResetEnabled(
  kelvin: number,
  available: boolean,
): boolean {
  return available && kelvin !== nightLightResetKelvin();
}

export function encodeNightLightTemperature(kelvin: number): string {
  const clamped = Math.min(
    NIGHT_LIGHT_MAX_KELVIN,
    Math.max(NIGHT_LIGHT_MIN_KELVIN, Math.round(kelvin)),
  );
  return String(clamped);
}

export function nightLightDaemonLaunch(): string {
  return "nohup cosmic-nightlight --daemon >/dev/null 2>&1 &";
}

function ronString(raw: string | null): string {
  if (raw === null) {
    return "";
  }
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseU32(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

function isNightAt(
  minuteOfDay: number,
  sunriseMinutes: number,
  sunsetMinutes: number,
): boolean {
  const minute =
    ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (sunsetMinutes < sunriseMinutes) {
    return minute >= sunsetMinutes && minute < sunriseMinutes;
  }
  if (sunsetMinutes > sunriseMinutes) {
    return minute >= sunsetMinutes || minute < sunriseMinutes;
  }
  return true;
}
