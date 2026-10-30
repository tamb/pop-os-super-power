import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);

await esbuild.build({
  entryPoints: [path.join(root, "src/app/main.ts")],
  bundle: true,
  outfile: path.join(root, "resources/js/main.js"),
  format: "esm",
  platform: "browser",
  target: "es2022",
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});
