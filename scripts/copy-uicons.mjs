import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssDir = path.join(
  root,
  "node_modules/@flaticon/flaticon-uicons/css/regular",
);
const outDir = path.join(root, "resources/vendor/flaticon-uicons");

const source = await readFile(path.join(cssDir, "rounded.css"), "utf8");
const match = source.match(
  /url\(\.\.\/(uicons-regular-rounded-[^)]+\.woff2)\)/,
);
if (!match) {
  throw new Error("Could not find the UIcons woff2 in rounded.css");
}

const fontFile = match[1];
await mkdir(outDir, { recursive: true });
await copyFile(
  path.join(cssDir, "..", fontFile),
  path.join(outDir, fontFile),
);

const face = source.match(/@font-face\{[^}]+\}/);
if (!face) {
  throw new Error("Could not find the UIcons @font-face rule");
}

const css = source.replace(
  face[0],
  `@font-face{font-family:uicons-regular-rounded;src:url("${fontFile}") format("woff2");font-display:swap}`,
);
await writeFile(path.join(outDir, "rounded.css"), css);
