import {
  defaultNightLightSettings,
  encodeNightLightString,
  encodeNightLightTemperature,
  NIGHT_LIGHT_DEFAULT_SUNRISE_MINUTES,
  NIGHT_LIGHT_DEFAULT_SUNSET_MINUTES,
  type NightLightOverride,
  type NightLightSettings,
  nightLightConfigDir,
  nightLightDaemonLaunch,
  parseNightLightMinutes,
  parseNightLightOverride,
  parseNightLightSchedule,
  parseNightLightTemperature,
} from "../lib/night-light.ts";
import { shellQuote } from "../lib/shell.ts";
import { execCommand } from "./neutralino-runtime.ts";
import { commandExists } from "./system76-client.ts";

type FilesystemApi = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
};

function filesystem(): FilesystemApi {
  return (Neutralino as typeof Neutralino & { filesystem: FilesystemApi })
    .filesystem;
}

async function homeDirectory(): Promise<string> {
  const home = (await Neutralino.os.getEnv("HOME")).trim();
  if (!home.startsWith("/")) {
    throw new Error("Could not find the home directory.");
  }
  return home;
}

async function readConfigValue(filePath: string): Promise<string | null> {
  try {
    return await filesystem().readFile(filePath);
  } catch {
    return null;
  }
}

export async function readNightLight(): Promise<{
  installed: boolean;
  settings: NightLightSettings;
}> {
  const installed = await commandExists("cosmic-nightlight");
  if (!installed) {
    return { installed: false, settings: defaultNightLightSettings() };
  }
  const dir = nightLightConfigDir(await homeDirectory());
  const [overrideRaw, temperatureRaw, scheduleRaw, sunriseRaw, sunsetRaw] =
    await Promise.all([
      readConfigValue(`${dir}/override`),
      readConfigValue(`${dir}/temperature`),
      readConfigValue(`${dir}/schedule`),
      readConfigValue(`${dir}/sunrise_minutes`),
      readConfigValue(`${dir}/sunset_minutes`),
    ]);
  return {
    installed: true,
    settings: {
      override: parseNightLightOverride(overrideRaw),
      temperature: parseNightLightTemperature(temperatureRaw),
      schedule: parseNightLightSchedule(scheduleRaw),
      sunriseMinutes: parseNightLightMinutes(
        sunriseRaw,
        NIGHT_LIGHT_DEFAULT_SUNRISE_MINUTES,
      ),
      sunsetMinutes: parseNightLightMinutes(
        sunsetRaw,
        NIGHT_LIGHT_DEFAULT_SUNSET_MINUTES,
      ),
    },
  };
}

export async function setNightLightOverride(
  override: Exclude<NightLightOverride, "auto">,
): Promise<void> {
  await writeNightLightKey("override", encodeNightLightString(override));
  if (override === "on") {
    await ensureNightLightRunning();
  }
}

export async function setNightLightTemperature(kelvin: number): Promise<void> {
  await writeNightLightKey("temperature", encodeNightLightTemperature(kelvin));
}

async function writeNightLightKey(
  name: string,
  contents: string,
): Promise<void> {
  if (!(await commandExists("cosmic-nightlight"))) {
    throw new Error(
      "Night Light is not installed. Install the cosmic-nightlight package to change the screen color.",
    );
  }
  const dir = nightLightConfigDir(await homeDirectory());
  const mkdir = await execCommand(`mkdir -p ${shellQuote(dir)}`);
  if (mkdir.exitCode !== 0) {
    throw new Error("Could not save Night Light settings.");
  }
  const filePath = `${dir}/${name}`;
  const current = await readConfigValue(filePath);
  if (current?.trim() === contents) {
    return;
  }
  await filesystem().writeFile(filePath, contents);
}

async function ensureNightLightRunning(): Promise<void> {
  const running = await execCommand(
    "pgrep -x cosmic-nightlight >/dev/null 2>&1",
  );
  if (running.exitCode === 0) {
    return;
  }
  const started = await execCommand(nightLightDaemonLaunch());
  if (started.exitCode !== 0) {
    throw new Error(
      "Night Light is installed, but its background helper did not start.",
    );
  }
}
