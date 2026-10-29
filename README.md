# Pop!_OS Super Power

A small [NeutralinoJS](https://neutralino.js.org/) desktop app for Pop!_OS that controls:

- **Power profiles** — Battery, Balanced, Performance (`system76-power profile`)
- **GPU mode** — Integrated, Discrete (NVIDIA), Hybrid (`system76-power graphics`)

GPU mode changes show a **Reboot now** button because Pop!_OS requires a restart after switching graphics modes.

## Requirements

- Pop!_OS (or Linux with `system76-power` and switchable graphics)
- Node.js 22+ (native TypeScript tests use `--experimental-strip-types`)
- [Neutralinojs CLI](https://neutralino.js.org/docs/getting-started/installation) (`npm i` in this repo)

## Development

```bash
npm install
npm test              # node:test (native TypeScript)
npm run lint          # Biome on src/ only
npm run format        # Biome format + lint fixes on src/
npm run typecheck     # tsc (app + lib, no emit)
npm run build:app     # esbuild → resources/js/main.js
npm start             # build UI + neu run
```

Pull requests to `main` run lint, typecheck, tests, and a Linux-only app build.

## Build a portable app

`neu build` copies every Neutralino binary in `bin/`. `npm run build` removes Windows and macOS binaries before and after that step, so `dist/` contains Linux builds only (`x64`, `arm64`, and `armhf`).

```bash
npm run build
./dist/pop-os-super-power/pop-os-super-power-linux_x64
```

## Project layout

| Path | Role |
|------|------|
| `src/lib/` | Pure TypeScript (parsing, shell helpers, command flow) — covered by `npm test` |
| `src/app/` | Neutralino UI. Calls into `src/lib` |
| `resources/js/main.js` | Bundled UI (`esbuild`; generated, not committed) |

## Notes

- Power profiles apply immediately.
- Some systems may prompt for authentication (`pkexec`) when changing GPU mode.
- Reboot uses `loginctl reboot` (with `pkexec` fallback).

## License

MIT — see [LICENSE](LICENSE).
