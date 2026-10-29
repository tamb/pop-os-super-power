import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] ?? "dist";

/** Neutralino names Windows and macOS binaries with mac/win (or .exe/.dll). */
function isNonLinuxBinary(name) {
  return /(?:^|-)(?:mac|win)(?:_|\.)|neutralino-(?:mac|win)|\.exe$|\.dll$/i.test(
    name,
  );
}

async function prune(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await prune(full);
      continue;
    }
    if (isNonLinuxBinary(entry.name)) {
      await rm(full);
      console.log(`removed ${path.relative(root, full)}`);
    }
  }
}

const dir = target === "bin" ? path.join(root, "bin") : path.join(root, "dist");
await prune(dir);

if (target !== "dist") {
  process.exit(0);
}

const appDir = path.join(root, "dist", "pop-os-super-power");
const names = await readdir(appDir);
const linuxBins = names.filter((name) => name.includes("-linux_"));
const foreign = names.filter((name) => isNonLinuxBinary(name));

if (foreign.length > 0) {
  console.error(`Non-Linux binaries remain: ${foreign.join(", ")}`);
  process.exit(1);
}

if (linuxBins.length === 0) {
  console.error("No Linux Neutralino binaries were produced.");
  process.exit(1);
}

console.log(`Linux binaries: ${linuxBins.join(", ")}`);
