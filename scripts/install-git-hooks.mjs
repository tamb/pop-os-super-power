import { chmod, lstat, mkdir, readlink, symlink, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "scripts/git-hooks/pre-push");
const hooksDir = path.join(root, ".git/hooks");
const dest = path.join(hooksDir, "pre-push");

await chmod(source, 0o755);

try {
  await lstat(path.join(root, ".git"));
} catch {
  process.exit(0);
}

await mkdir(hooksDir, { recursive: true });

try {
  const current = await lstat(dest);
  if (current.isSymbolicLink() && (await readlink(dest)) === source) {
    process.exit(0);
  }
  await unlink(dest);
} catch (error) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
    throw error;
  }
}

await symlink(source, dest);
console.log("Installed pre-push hook -> scripts/git-hooks/pre-push");
