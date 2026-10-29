# Pop!_OS Super Power

A small [NeutralinoJS](https://neutralino.js.org/) desktop app for Pop!_OS that controls:

- **Power profiles** — Battery, Balanced, Performance (`system76-power profile`)
- **GPU mode** — Integrated, Discrete (NVIDIA), Hybrid (`system76-power graphics`)

GPU mode changes show a **Reboot now** button because Pop!_OS requires a restart after switching graphics modes.

## Requirements

- Pop!_OS (or another Linux install with `system76-power` and switchable graphics)
- [Neutralinojs CLI](https://neutralino.js.org/docs/getting-started/installation) (`npm i -g @neutralinojs/neu`) for development builds

## Run from source

```bash
cd pop-os-super-power
neu run
```

## Build a portable app

```bash
neu build
```

The Linux binary and bundled resources are written to `dist/pop-os-super-power/`. Run:

```bash
./dist/pop-os-super-power/pop-os-super-power
```

## Optional desktop entry

After building, you can add a launcher that runs the binary from `dist/pop-os-super-power/`.

## Notes

- Power profiles apply immediately.
- Some systems may prompt for authentication (`pkexec`) when changing GPU mode.
- Reboot uses `loginctl reboot` (with `pkexec` fallback).

## License

MIT — see [LICENSE](LICENSE).
