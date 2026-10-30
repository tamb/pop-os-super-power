import {
  chooseLauncherTarget,
  desktopEntryContents,
  distLauncherBinary,
  type InstallState,
  iconThemeDirectory,
  installState,
  type LauncherPaths,
  launcherPaths,
  launcherSearchRoots,
  linuxBinarySuffix,
  parentDirectory,
  procExecutableCommand,
} from "../lib/desktop-entry.ts";
import { formatExecFailure, shellQuote } from "../lib/shell.ts";
import { execCommand } from "./neutralino-runtime.ts";

type FilesystemApi = {
  writeFile(path: string, data: string): Promise<void>;
  writeBinaryFile(path: string, data: ArrayBuffer): Promise<void>;
  remove(path: string): Promise<void>;
  getStats(path: string): Promise<unknown>;
};

function filesystem(): FilesystemApi {
  return (Neutralino as typeof Neutralino & { filesystem: FilesystemApi })
    .filesystem;
}

async function runChecked(command: string): Promise<string> {
  const result = await execCommand(command);
  if (result.exitCode !== 0) {
    throw new Error(
      formatExecFailure(result.exitCode, result.stdOut, result.stdErr, command),
    );
  }
  return result.stdOut.trim();
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await filesystem().getStats(filePath);
    return true;
  } catch {
    return false;
  }
}

async function homeDirectory(): Promise<string> {
  const home = (await Neutralino.os.getEnv("HOME")).trim();
  if (!home.startsWith("/")) {
    throw new Error("Could not find the home directory.");
  }
  return home;
}

async function ensureDirectory(dir: string): Promise<void> {
  await runChecked(`mkdir -p ${shellQuote(dir)}`);
}

export async function readLauncherState(): Promise<{
  state: InstallState;
  paths: LauncherPaths;
}> {
  const paths = launcherPaths(await homeDirectory());
  const [menuEntry, desktopEntry, icon] = await Promise.all([
    pathExists(paths.menuEntry),
    pathExists(paths.desktopEntry),
    pathExists(paths.icon),
  ]);
  return {
    state: installState({ menuEntry, desktopEntry, icon }),
    paths,
  };
}

async function launcherTarget(): Promise<{
  execPath: string;
  workingDirectory: string;
}> {
  const runningExecutable = await runChecked(procExecutableCommand(NL_PID));
  if (!runningExecutable.startsWith("/")) {
    throw new Error("Could not find the running application binary.");
  }

  const runningBundleReady = await pathExists(
    `${parentDirectory(runningExecutable)}/resources.neu`,
  );
  let distExecutable: string | null = null;
  if (!runningBundleReady) {
    const suffix = linuxBinarySuffix(await runChecked("uname -m"));
    if (suffix) {
      for (const root of launcherSearchRoots(
        runningExecutable,
        NL_CWD,
        NL_PATH,
      )) {
        const candidate = distLauncherBinary(root, suffix);
        const bundleReady = await pathExists(
          `${parentDirectory(candidate)}/resources.neu`,
        );
        if ((await pathExists(candidate)) && bundleReady) {
          distExecutable = candidate;
          break;
        }
      }
    }
  }

  const target = chooseLauncherTarget({
    runningExecutable,
    runningBundleReady,
    distExecutable,
  });
  if (!target) {
    throw new Error(
      "Could not find the application binary. Build the app, then install the launcher again.",
    );
  }
  return target;
}

export async function installLaunchers(): Promise<LauncherPaths> {
  const paths = launcherPaths(await homeDirectory());
  const target = await launcherTarget();
  const iconResponse = await fetch("/icons/appIcon.png");
  if (!iconResponse.ok) {
    throw new Error("Could not read the application icon.");
  }
  const iconBytes = await iconResponse.arrayBuffer();

  await ensureDirectory(parentDirectory(paths.menuEntry));
  await ensureDirectory(parentDirectory(paths.desktopEntry));
  await ensureDirectory(parentDirectory(paths.icon));

  const files = filesystem();
  await files.writeBinaryFile(paths.icon, iconBytes);
  const contents = desktopEntryContents({
    execPath: target.execPath,
    workingDirectory: target.workingDirectory,
    iconPath: paths.icon,
  });
  await files.writeFile(paths.menuEntry, contents);
  await files.writeFile(paths.desktopEntry, contents);
  await runChecked(
    `chmod 755 ${shellQuote(paths.menuEntry)} ${shellQuote(paths.desktopEntry)}`,
  );

  await execCommand(
    `gio set ${shellQuote(paths.desktopEntry)} metadata::trusted true`,
  );
  await execCommand(
    `update-desktop-database ${shellQuote(parentDirectory(paths.menuEntry))}`,
  );
  await execCommand(
    `gtk-update-icon-cache -f -t ${shellQuote(iconThemeDirectory(paths.icon))}`,
  );

  return paths;
}

export async function uninstallLaunchers(): Promise<void> {
  const paths = launcherPaths(await homeDirectory());
  const files = filesystem();
  for (const filePath of [paths.menuEntry, paths.desktopEntry, paths.icon]) {
    if (await pathExists(filePath)) {
      await files.remove(filePath);
    }
  }
  await execCommand(
    `update-desktop-database ${shellQuote(parentDirectory(paths.menuEntry))}`,
  );
  await execCommand(
    `gtk-update-icon-cache -f -t ${shellQuote(iconThemeDirectory(paths.icon))}`,
  );
}
