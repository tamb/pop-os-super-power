export const LAUNCHER_APP_ID = "com.opensource.pop-os-super-power";
export const LAUNCHER_ICON_NAME = "pop-os-super-power";
export const LAUNCHER_DESKTOP_NAME = "Pop!_OS Super Power.desktop";

export type LauncherPaths = {
  menuEntry: string;
  desktopEntry: string;
  icon: string;
};

export type InstallState = "installed" | "partial" | "absent";

export type LauncherTarget = {
  execPath: string;
  workingDirectory: string;
};

export function parentDirectory(filePath: string): string {
  const trimmed = filePath.replace(/\/+$/, "");
  const index = trimmed.lastIndexOf("/");
  if (index < 0) {
    return "";
  }
  if (index === 0) {
    return "/";
  }
  return trimmed.slice(0, index);
}

/** Wayland app id is the executable's file name. The desktop file must use it. */
export function executableBaseName(execPath: string): string {
  const trimmed = execPath.replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  const name = slash < 0 ? trimmed : trimmed.slice(slash + 1);
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error("Could not name the application launcher.");
  }
  return name;
}

export function launcherPaths(
  home: string,
  startupWmClass: string = LAUNCHER_APP_ID,
): LauncherPaths {
  const root = home.replace(/\/+$/, "");
  const desktopId = executableBaseName(startupWmClass);
  return {
    menuEntry: `${root}/.local/share/applications/${desktopId}.desktop`,
    desktopEntry: `${root}/Desktop/${LAUNCHER_DESKTOP_NAME}`,
    icon: `${root}/.local/share/icons/hicolor/256x256/apps/${LAUNCHER_ICON_NAME}.png`,
  };
}

/** Earlier installs used the application id instead of the binary name. */
export function legacyMenuEntry(home: string): string {
  const root = home.replace(/\/+$/, "");
  return `${root}/.local/share/applications/${LAUNCHER_APP_ID}.desktop`;
}

export function iconThemeDirectory(iconPath: string): string {
  return parentDirectory(parentDirectory(parentDirectory(iconPath)));
}

export function installState(found: {
  menuEntry: boolean;
  desktopEntry: boolean;
  icon: boolean;
}): InstallState {
  const present = [found.menuEntry, found.desktopEntry, found.icon].filter(
    Boolean,
  ).length;
  if (present === 3) {
    return "installed";
  }
  if (present === 0) {
    return "absent";
  }
  return "partial";
}

/** Quote an Exec value when the binary path contains spaces. */
export function desktopExecValue(execPath: string): string {
  if (!/[\s"]/.test(execPath)) {
    return execPath;
  }
  return `"${execPath.replaceAll('"', '\\"')}"`;
}

export function desktopEntryContents(input: {
  execPath: string;
  workingDirectory: string;
  /** Theme icon name or an absolute PNG path. */
  icon: string;
  startupWmClass?: string;
}): string {
  const startupWmClass =
    input.startupWmClass ?? executableBaseName(input.execPath);
  return `[Desktop Entry]
Type=Application
Version=1.0
Name=Pop!_OS Super Power
Comment=Power profiles and GPU mode for Pop!_OS
Exec=${desktopExecValue(input.execPath)}
Path=${input.workingDirectory}
Icon=${input.icon}
Terminal=false
Categories=Settings;
StartupNotify=true
StartupWMClass=${executableBaseName(startupWmClass)}
`;
}

const LINUX_BINARY_SUFFIX: Record<string, string> = {
  x86_64: "linux_x64",
  aarch64: "linux_arm64",
  armv7l: "linux_armhf",
};

export function linuxBinarySuffix(machine: string): string | null {
  return LINUX_BINARY_SUFFIX[machine.trim()] ?? null;
}

export function distLauncherBinary(
  projectRoot: string,
  suffix: string,
): string {
  const root = projectRoot.replace(/\/+$/, "");
  return `${root}/dist/pop-os-super-power/pop-os-super-power-${suffix}`;
}

export function launcherSearchRoots(
  executablePath: string,
  cwd: string,
  appPath: string,
): string[] {
  const roots: string[] = [];
  const executableDir = parentDirectory(executablePath);
  if (executableDir.endsWith("/bin")) {
    roots.push(parentDirectory(executableDir));
  }
  for (const root of [cwd, appPath]) {
    if (root && !roots.includes(root)) {
      roots.push(root);
    }
  }
  return roots;
}

/** `readlink` of this Neutralino process. `/proc/self` would be readlink itself. */
export function procExecutableCommand(pid: string | number): string {
  const trimmed = String(pid).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Could not find the running application process.");
  }
  return `readlink -f /proc/${trimmed}/exe`;
}

export function isAppBinary(execPath: string): boolean {
  const name = execPath.slice(execPath.lastIndexOf("/") + 1);
  return (
    name.startsWith("pop-os-super-power") || name.startsWith("neutralino-linux")
  );
}

/**
 * Prefer the running app binary when resources.neu is beside it.
 * Otherwise use a built dist binary. Never point a launcher at a helper
 * such as readlink.
 */
export function chooseLauncherTarget(input: {
  runningExecutable: string;
  runningBundleReady: boolean;
  distExecutable: string | null;
}): LauncherTarget | null {
  if (input.runningBundleReady && isAppBinary(input.runningExecutable)) {
    return {
      execPath: input.runningExecutable,
      workingDirectory: parentDirectory(input.runningExecutable),
    };
  }
  if (input.distExecutable) {
    return {
      execPath: input.distExecutable,
      workingDirectory: parentDirectory(input.distExecutable),
    };
  }
  return null;
}
