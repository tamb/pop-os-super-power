import { spawn } from "node:child_process";
import { access, chmod, copyFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appId = "com.opensource.pop-os-super-power";
const iconName = "pop-os-super-power";

const binarySuffix = {
  x64: "linux_x64",
  arm64: "linux_arm64",
  arm: "linux_armhf",
}[os.arch()];

if (!binarySuffix) {
  throw new Error(`No Pop!_OS Super Power binary is built for ${os.arch()}.`);
}

const binDir = path.join(root, "dist", "pop-os-super-power");
const execPath = path.join(binDir, `pop-os-super-power-${binarySuffix}`);
const iconSrc = path.join(root, "resources", "icons", "appIcon.png");

await access(execPath);
await access(iconSrc);

const iconDir = path.join(
  os.homedir(),
  ".local",
  "share",
  "icons",
  "hicolor",
  "256x256",
  "apps",
);
const iconDest = path.join(iconDir, `${iconName}.png`);
const applicationsDir = path.join(os.homedir(), ".local", "share", "applications");
const desktopDir = path.join(os.homedir(), "Desktop");
const menuEntry = path.join(applicationsDir, `${appId}.desktop`);
const desktopEntry = path.join(desktopDir, "Pop!_OS Super Power.desktop");

await mkdir(iconDir, { recursive: true });
await mkdir(applicationsDir, { recursive: true });
await mkdir(desktopDir, { recursive: true });
await copyFile(iconSrc, iconDest);

function desktopFile() {
  return `[Desktop Entry]
Type=Application
Version=1.0
Name=Pop!_OS Super Power
Comment=Power profiles and GPU mode for Pop!_OS
Exec=${execPath}
Path=${binDir}
Icon=${iconDest}
Terminal=false
Categories=Settings;
StartupNotify=true
StartupWMClass=pop-os-super-power
`;
}

const contents = desktopFile();
await writeFile(menuEntry, contents);
await writeFile(desktopEntry, contents);
await chmod(menuEntry, 0o755);
await chmod(desktopEntry, 0o755);

await run("gio", ["set", desktopEntry, "metadata::trusted", "true"]);
await run("update-desktop-database", [applicationsDir]);
await run("gtk-update-icon-cache", [
  "-f",
  "-t",
  path.join(os.homedir(), ".local", "share", "icons", "hicolor"),
]);

console.log(menuEntry);
console.log(desktopEntry);
console.log(iconDest);

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}
