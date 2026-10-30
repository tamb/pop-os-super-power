import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chooseLauncherTarget,
  desktopEntryContents,
  desktopExecValue,
  distLauncherBinary,
  iconThemeDirectory,
  installState,
  isAppBinary,
  launcherPaths,
  launcherSearchRoots,
  legacyMenuEntry,
  linuxBinarySuffix,
  parentDirectory,
  procExecutableCommand,
} from "./desktop-entry.ts";

const HOME = "/home/user";

describe("launcherPaths", () => {
  it("names the menu entry after the running binary", () => {
    assert.deepEqual(
      launcherPaths(`${HOME}/`, "pop-os-super-power-linux_x64"),
      {
        menuEntry: `${HOME}/.local/share/applications/pop-os-super-power-linux_x64.desktop`,
        desktopEntry: `${HOME}/Desktop/Pop!_OS Super Power.desktop`,
        icon: `${HOME}/.local/share/icons/hicolor/256x256/apps/pop-os-super-power.png`,
      },
    );
  });
});

describe("legacyMenuEntry", () => {
  it("points at the older application-id launcher", () => {
    assert.equal(
      legacyMenuEntry(HOME),
      `${HOME}/.local/share/applications/com.opensource.pop-os-super-power.desktop`,
    );
  });
});

describe("parentDirectory", () => {
  it("drops the last path segment", () => {
    assert.equal(parentDirectory("/usr/bin/app"), "/usr/bin");
    assert.equal(parentDirectory("/usr"), "/");
  });
});

describe("iconThemeDirectory", () => {
  it("returns the hicolor root for an apps icon", () => {
    const { icon } = launcherPaths(HOME);
    assert.equal(
      iconThemeDirectory(icon),
      `${HOME}/.local/share/icons/hicolor`,
    );
  });
});

describe("installState", () => {
  it("reports installed, partial, and absent", () => {
    assert.equal(
      installState({ menuEntry: true, desktopEntry: true, icon: true }),
      "installed",
    );
    assert.equal(
      installState({ menuEntry: true, desktopEntry: false, icon: true }),
      "partial",
    );
    assert.equal(
      installState({ menuEntry: false, desktopEntry: false, icon: false }),
      "absent",
    );
  });
});

describe("desktopEntryContents", () => {
  it("points Exec, Path, and Icon at the installed files", () => {
    const text = desktopEntryContents({
      execPath: "/opt/app/pop-os-super-power-linux_x64",
      workingDirectory: "/opt/app",
      icon: "pop-os-super-power",
    });
    assert.match(text, /^Type=Application$/m);
    assert.match(text, /^Exec=\/opt\/app\/pop-os-super-power-linux_x64$/m);
    assert.match(text, /^Path=\/opt\/app$/m);
    assert.match(text, /^Icon=pop-os-super-power$/m);
    assert.match(text, /^Categories=Settings;$/m);
    assert.match(text, /^StartupWMClass=pop-os-super-power-linux_x64$/m);
  });

  it("quotes an executable path that contains spaces", () => {
    assert.equal(
      desktopExecValue("/home/user/My Apps/app"),
      '"/home/user/My Apps/app"',
    );
  });
});

describe("linuxBinarySuffix", () => {
  it("maps uname machines to Neutralino binary names", () => {
    assert.equal(linuxBinarySuffix("x86_64"), "linux_x64");
    assert.equal(linuxBinarySuffix("aarch64"), "linux_arm64");
    assert.equal(linuxBinarySuffix("armv7l"), "linux_armhf");
    assert.equal(linuxBinarySuffix("riscv64"), null);
  });
});

describe("distLauncherBinary", () => {
  it("builds the dist binary path for the machine", () => {
    assert.equal(
      distLauncherBinary("/src/pop-os-super-power/", "linux_x64"),
      "/src/pop-os-super-power/dist/pop-os-super-power/pop-os-super-power-linux_x64",
    );
  });
});

describe("launcherSearchRoots", () => {
  it("includes the project root when the binary lives in bin", () => {
    assert.deepEqual(
      launcherSearchRoots(
        "/src/app/bin/neutralino-linux_x64",
        "/src/app",
        "/src/app",
      ),
      ["/src/app"],
    );
  });
});

describe("chooseLauncherTarget", () => {
  it("uses the running binary when its resource bundle is present", () => {
    assert.deepEqual(
      chooseLauncherTarget({
        runningExecutable: "/opt/app/pop-os-super-power-linux_x64",
        runningBundleReady: true,
        distExecutable:
          "/src/dist/pop-os-super-power/pop-os-super-power-linux_x64",
      }),
      {
        execPath: "/opt/app/pop-os-super-power-linux_x64",
        workingDirectory: "/opt/app",
      },
    );
  });

  it("uses the dist binary when the running process has no bundle", () => {
    assert.deepEqual(
      chooseLauncherTarget({
        runningExecutable: "/src/bin/neutralino-linux_x64",
        runningBundleReady: false,
        distExecutable:
          "/src/dist/pop-os-super-power/pop-os-super-power-linux_x64",
      }),
      {
        execPath: "/src/dist/pop-os-super-power/pop-os-super-power-linux_x64",
        workingDirectory: "/src/dist/pop-os-super-power",
      },
    );
  });

  it("refuses to launch a helper binary when no app bundle exists", () => {
    assert.equal(
      chooseLauncherTarget({
        runningExecutable: "/usr/bin/readlink",
        runningBundleReady: false,
        distExecutable: null,
      }),
      null,
    );
  });

  it("ignores a non-app path even if a bundle flag is set", () => {
    assert.equal(isAppBinary("/usr/bin/readlink"), false);
    assert.equal(
      chooseLauncherTarget({
        runningExecutable: "/usr/bin/readlink",
        runningBundleReady: true,
        distExecutable: null,
      }),
      null,
    );
  });
});

describe("procExecutableCommand", () => {
  it("reads the Neutralino process, not readlink", () => {
    assert.equal(procExecutableCommand("4242"), "readlink -f /proc/4242/exe");
    assert.equal(procExecutableCommand(4242), "readlink -f /proc/4242/exe");
  });

  it("rejects a pid that is not digits", () => {
    assert.throws(
      () => procExecutableCommand("1;rm"),
      /running application process/,
    );
  });
});
