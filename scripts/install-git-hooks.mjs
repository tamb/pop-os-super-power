import { chmod, lstat, mkdir, readlink, symlink, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "scripts/git-hooks/pre-commit");
const hooksDir = path.join(root, ".git/hooks");
const dest = path.join(hooksDir, "pre-commit");
const oldPrePush = path.join(hooksDir, "pre-push");
const oldPrePushSource = path.join(root, "scripts/git-hooks/pre-push");

await chmod(source, 0o755);

try {
  await lstat(path.join(root, ".git"));
} catch {
  process.exit(0);
}

await mkdir(hooksDir, { recursive: true });

try {
  if ((await lstat(oldPrePush)).isSymbolicLink()) {
    const target = await readlink(oldPrePush);
    if (target === oldPrePushSource || target.endsWith("/scripts/git-hooks/pre-push")) {
      await unlink(oldPrePush);
      console.log("Removed pre-push hook");
    }
  }
} catch (error) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
    throw error;
  }
}

try {
  const current = await lstat(dest);
  if (current.isSymbolicLink() && (await readlink(dest)) === source) {
    console.log("pre-commit hook already installed");
    process.exit(0);
  }
  await unlink(dest);
} catch (error) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
    throw error;
  }
}

await symlink(source, dest);
console.log("Installed pre-commit hook -> scripts/git-hooks/pre-commit");
