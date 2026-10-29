import type { GraphicsMode, PowerProfile } from "../lib/constants.ts";
import {
  applyGraphics as applyGraphicsCore,
  applyProfile as applyProfileCore,
  commandExists as commandExistsCore,
  fetchGraphicsMode as fetchGraphicsModeCore,
  fetchProfile as fetchProfileCore,
  fetchSwitchable as fetchSwitchableCore,
  rebootSystem as rebootSystemCore,
  runSystem76Power as runSystem76PowerCore,
} from "../lib/power-client.ts";
import { sessionEnvFromStrings } from "../lib/shell.ts";
import { execCommand, getSessionEnv } from "./neutralino-runtime.ts";

async function sessionEnv() {
  const raw = await getSessionEnv();
  return sessionEnvFromStrings(raw.display, raw.xauthority);
}

export async function runSystem76Power(args: string): Promise<string> {
  return runSystem76PowerCore(args, await sessionEnv(), execCommand);
}

export async function commandExists(name: string): Promise<boolean> {
  return commandExistsCore(name, execCommand);
}

export async function rebootSystem(): Promise<void> {
  return rebootSystemCore(execCommand);
}

export async function fetchProfile(): Promise<PowerProfile> {
  return fetchProfileCore(await sessionEnv(), execCommand);
}

export async function fetchGraphicsMode(): Promise<GraphicsMode> {
  return fetchGraphicsModeCore(await sessionEnv(), execCommand);
}

export async function fetchSwitchable(): Promise<boolean> {
  return fetchSwitchableCore(await sessionEnv(), execCommand);
}

export async function applyProfile(profile: PowerProfile): Promise<void> {
  await applyProfileCore(profile, await sessionEnv(), execCommand);
}

export async function applyGraphics(mode: GraphicsMode): Promise<void> {
  await applyGraphicsCore(mode, await sessionEnv(), execCommand);
}

export { messageFromError } from "../lib/errors.ts";
