import {
  type GraphicsMode,
  isGraphicsMode,
  isPowerProfile,
  type PowerProfile,
} from "../lib/constants.ts";
import type { InstallState } from "../lib/desktop-entry.ts";
import { shouldShowRebootBanner } from "../lib/system76-output.ts";
import {
  installLaunchers,
  readLauncherState,
  uninstallLaunchers,
} from "./launcher-client.ts";
import {
  applyGraphics,
  applyProfile,
  commandExists,
  fetchGraphicsMode,
  fetchProfile,
  fetchSwitchable,
  messageFromError,
  rebootSystem,
} from "./system76-client.ts";

declare const __APP_VERSION__: string;

type StatusKind = "idle" | "busy" | "error";

const PROFILE_LABEL: Record<PowerProfile, string> = {
  battery: "Battery",
  balanced: "Balanced",
  performance: "Performance",
};

const GRAPHICS_LABEL: Record<GraphicsMode, string> = {
  integrated: "Integrated",
  nvidia: "Discrete",
  hybrid: "Hybrid",
};

const LAUNCHER_STATUS: Record<InstallState, string> = {
  installed: "Desktop and application menu launchers are installed.",
  partial:
    "Only some launcher files are installed. Install again to repair them, or uninstall to remove them.",
  absent: "No desktop or application menu launcher is installed.",
};

let graphicsBaseline: GraphicsMode | null = null;
let busy = false;
let inputsEnabled = false;
let launcherBusy = false;

const APP_TITLE = "Pop!_OS Super Power";

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}`);
  }
  return el;
}

function setStatus(message: string, kind: StatusKind = "idle"): void {
  const el = $("status");
  $("status-text").textContent = message;
  el.classList.remove("is-busy", "is-error");
  if (kind === "busy") {
    el.classList.add("is-busy");
  }
  if (kind === "error") {
    el.classList.add("is-error");
  }
  $("status-dots").classList.toggle("hidden", kind !== "busy");
  setCopyButton("status-copy", kind === "error" ? message : "");
}

function setGraphicsProgress(message: string | null): void {
  const bar = $("graphics-progress");
  const text = $("graphics-progress-text");
  const active = message !== null && message.length > 0;
  bar.classList.toggle("hidden", !active);
  text.classList.toggle("hidden", !active);
  text.textContent = message ?? "";
  $("graphics-panel").setAttribute("aria-busy", active ? "true" : "false");
  if (active && message) {
    bar.setAttribute("aria-valuetext", message);
  } else {
    bar.removeAttribute("aria-valuetext");
  }
}

function applyInputState(): void {
  const disabled = !inputsEnabled || busy;
  const graphicsOff = $("graphics-panel").classList.contains("is-disabled");
  ($("refresh-btn") as HTMLButtonElement).disabled = disabled;
  ($("reboot-btn") as HTMLButtonElement).disabled = disabled;
  document.querySelectorAll("#profile-toggles .toggle").forEach((node) => {
    (node as HTMLButtonElement).disabled = disabled;
  });
  document.querySelectorAll("#graphics-toggles .toggle").forEach((node) => {
    (node as HTMLButtonElement).disabled = disabled || graphicsOff;
  });
}

function setLoadError(message: string): void {
  const el = $("load-error");
  const text = $("load-error-text");
  text.textContent = message;
  setCopyButton("load-error-copy", message);
  el.classList.toggle("hidden", message.length === 0);
}

function setCopyButton(id: string, message: string): void {
  const button = $(id) as HTMLButtonElement;
  const existing = copyResetTimers.get(button);
  if (existing !== undefined) {
    window.clearTimeout(existing);
    copyResetTimers.delete(button);
  }
  button.dataset.copy = message;
  button.classList.toggle("hidden", message.length === 0);
  setButtonLabel(button, "Copy");
}

const copyResetTimers = new WeakMap<HTMLButtonElement, number>();

async function copyMessage(button: HTMLButtonElement): Promise<void> {
  const text = button.dataset.copy ?? "";
  if (!text) {
    return;
  }
  try {
    await writeClipboard(text);
    flashCopyLabel(button, "Copied");
  } catch {
    flashCopyLabel(button, "Copy failed");
  }
}

async function writeClipboard(text: string): Promise<void> {
  try {
    const api = Neutralino as typeof Neutralino & {
      clipboard: { writeText(data: string): Promise<void> };
    };
    await api.clipboard.writeText(text);
  } catch {
    copyWithTextarea(text);
  }
}

function copyWithTextarea(text: string): void {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.focus();
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) {
    throw new Error("Could not copy the error message.");
  }
}

function setButtonLabel(button: HTMLButtonElement, label: string): void {
  const text = button.querySelector(".btn-label");
  if (text) {
    text.textContent = label;
    return;
  }
  button.textContent = label;
}

function flashCopyLabel(button: HTMLButtonElement, label: string): void {
  const existing = copyResetTimers.get(button);
  if (existing !== undefined) {
    window.clearTimeout(existing);
  }
  setButtonLabel(button, label);
  const timer = window.setTimeout(() => {
    setButtonLabel(button, "Copy");
    copyResetTimers.delete(button);
  }, 1500);
  copyResetTimers.set(button, timer);
}

function wireExternalLinks(): void {
  document.querySelectorAll("a[data-external]").forEach((node) => {
    const link = node as HTMLAnchorElement;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      void (async () => {
        try {
          await Neutralino.os.open(link.href);
        } catch (err) {
          setStatus(messageFromError(err), "error");
        }
      })();
    });
  });
}

function wireCopyButtons(): void {
  for (const id of ["status-copy", "load-error-copy"]) {
    const button = $(id) as HTMLButtonElement;
    button.addEventListener("click", () => {
      void copyMessage(button);
    });
  }
}

function setActiveToggle(groupId: string, value: string): void {
  document.querySelectorAll(`#${groupId} .toggle`).forEach((node) => {
    const btn = node as HTMLButtonElement;
    btn.classList.toggle("is-active", btn.dataset.value === value);
  });
}

function updateRebootBanner(selected: GraphicsMode): void {
  $("reboot-banner").classList.toggle(
    "hidden",
    !shouldShowRebootBanner(graphicsBaseline, selected),
  );
}

async function withBusy(label: string, fn: () => Promise<void>): Promise<void> {
  if (busy) {
    return;
  }
  busy = true;
  applyInputState();
  setStatus(label, "busy");
  try {
    await fn();
  } finally {
    busy = false;
    applyInputState();
  }
}

async function refreshState(options?: { announce?: boolean }): Promise<void> {
  const profile = await fetchProfile();
  setActiveToggle("profile-toggles", profile);

  const switchable = await fetchSwitchable();
  const panel = $("graphics-panel");
  if (!switchable) {
    panel.classList.add("is-disabled");
    applyInputState();
    setLoadError(
      "This system does not report switchable graphics. GPU controls are disabled.",
    );
    setStatus(
      options?.announce
        ? `Power profile: ${PROFILE_LABEL[profile]}. Switchable graphics are not available.`
        : "Ready.",
    );
    return;
  }

  panel.classList.remove("is-disabled");
  setLoadError("");
  const graphics = await fetchGraphicsMode();
  if (graphicsBaseline === null) {
    graphicsBaseline = graphics;
  }
  setActiveToggle("graphics-toggles", graphics);
  updateRebootBanner(graphics);
  applyInputState();
  if (options?.announce) {
    const pending = shouldShowRebootBanner(graphicsBaseline, graphics)
      ? " Reboot to apply the GPU mode."
      : "";
    setStatus(
      `Power profile: ${PROFILE_LABEL[profile]}. GPU mode: ${GRAPHICS_LABEL[graphics]}.${pending}`,
    );
    return;
  }
  setStatus("Ready.");
}

function wireProfileToggles(): void {
  document.querySelectorAll("#profile-toggles .toggle").forEach((node) => {
    const btn = node as HTMLButtonElement;
    btn.addEventListener("click", () => {
      const profile = btn.dataset.value ?? "";
      if (!isPowerProfile(profile)) {
        return;
      }

      void withBusy(
        `Setting power profile to ${PROFILE_LABEL[profile]}`,
        async () => {
          try {
            const applied = await applyProfile(profile);
            setActiveToggle("profile-toggles", profile);
            const scsiNote = applied.scsiLinkPmSkipped
              ? " Link power management was skipped on an unsupported disk controller."
              : "";
            setStatus(
              `Power profile set to ${PROFILE_LABEL[profile]}.${scsiNote}`,
            );
            await Neutralino.os.showNotification(
              APP_TITLE,
              `Power profile: ${PROFILE_LABEL[profile]}`,
            );
          } catch (err) {
            const message = messageFromError(err);
            setStatus(message, "error");
            await Neutralino.os.showMessageBox(
              "Profile error",
              message,
              "OK",
              "ERROR",
            );
          }
        },
      );
    });
  });
}

function wireGraphicsToggles(): void {
  document.querySelectorAll("#graphics-toggles .toggle").forEach((node) => {
    const btn = node as HTMLButtonElement;
    btn.addEventListener("click", () => {
      const mode = btn.dataset.value ?? "";
      if (!isGraphicsMode(mode)) {
        return;
      }

      const label = GRAPHICS_LABEL[mode];
      void withBusy(`Switching GPU to ${label}`, async () => {
        setGraphicsProgress(
          `Applying the ${label} GPU mode. Approve the password prompt if one appears.`,
        );
        try {
          await applyGraphics(mode, {
            onPermissionPrompt: () => {
              setStatus("Waiting for authentication", "busy");
              setGraphicsProgress(
                "Waiting for authentication. Enter your password in the system dialog.",
              );
            },
          });
          setActiveToggle("graphics-toggles", mode);
          updateRebootBanner(mode);
          setStatus(`GPU mode set to ${label}. Reboot when ready.`);
          await Neutralino.os.showNotification(
            APP_TITLE,
            `GPU mode: ${label}. Reboot to apply.`,
          );
        } catch (err) {
          const message = messageFromError(err);
          setStatus(message, "error");
          await Neutralino.os.showMessageBox(
            "GPU mode error",
            message,
            "OK",
            "ERROR",
          );
        } finally {
          setGraphicsProgress(null);
        }
      });
    });
  });
}

function wireRefresh(): void {
  const button = $("refresh-btn");
  button.addEventListener("click", () => {
    void (async () => {
      button.classList.add("is-spinning");
      try {
        await withBusy("Refreshing power and GPU status", async () => {
          try {
            await refreshState({ announce: true });
          } catch (err) {
            const message = messageFromError(err);
            setLoadError(message);
            setStatus(message, "error");
          }
        });
      } finally {
        button.classList.remove("is-spinning");
      }
    })();
  });
}

function setLauncherMessage(
  message: string,
  kind: "ok" | "busy" | "error" = "ok",
): void {
  const el = $("launcher-message");
  el.textContent = message;
  el.classList.remove("is-busy", "is-error");
  el.classList.toggle("hidden", message.length === 0);
  if (kind === "busy") {
    el.classList.add("is-busy");
  }
  if (kind === "error") {
    el.classList.add("is-error");
  }
}

function applyLauncherButtons(state: InstallState | null): void {
  ($("install-launcher-btn") as HTMLButtonElement).disabled = launcherBusy;
  ($("uninstall-launcher-btn") as HTMLButtonElement).disabled =
    launcherBusy || state === "absent" || state === null;
}

async function refreshLauncherStatus(options?: {
  quiet?: boolean;
}): Promise<void> {
  if (!options?.quiet) {
    $("launcher-status").textContent = "Checking launchers…";
    applyLauncherButtons(null);
  }
  try {
    const { state } = await readLauncherState();
    $("launcher-status").textContent = LAUNCHER_STATUS[state];
    applyLauncherButtons(state);
  } catch (err) {
    $("launcher-status").textContent = messageFromError(err);
    applyLauncherButtons(null);
  }
}

function wireSettings(): void {
  const dialog = $("settings-dialog") as HTMLDialogElement;
  $("settings-btn").addEventListener("click", () => {
    setLauncherMessage("");
    if (!dialog.open) {
      dialog.showModal();
    }
    void refreshLauncherStatus();
  });
  $("settings-close").addEventListener("click", () => {
    dialog.close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  $("install-launcher-btn").addEventListener("click", () => {
    void runLauncherAction("install");
  });
  $("uninstall-launcher-btn").addEventListener("click", () => {
    void runLauncherAction("uninstall");
  });
}

async function runLauncherAction(
  action: "install" | "uninstall",
): Promise<void> {
  if (launcherBusy) {
    return;
  }
  launcherBusy = true;
  applyLauncherButtons(null);
  try {
    if (action === "uninstall") {
      const choice = await Neutralino.os.showMessageBox(
        "Remove launchers?",
        "This removes the Desktop icon and the application menu entry. The app stays installed.",
        "YES_NO",
        "QUESTION",
      );
      if (choice !== "YES") {
        return;
      }
    }

    setLauncherMessage(
      action === "install" ? "Installing launchers…" : "Removing launchers…",
      "busy",
    );
    if (action === "install") {
      await installLaunchers();
      setLauncherMessage("Launchers installed.");
    } else {
      await uninstallLaunchers();
      setLauncherMessage("Launchers removed.");
    }
  } catch (err) {
    setLauncherMessage(messageFromError(err), "error");
  } finally {
    launcherBusy = false;
    await refreshLauncherStatus({ quiet: true });
  }
}

function wireReboot(): void {
  $("reboot-btn").addEventListener("click", () => {
    void (async () => {
      const choice = await Neutralino.os.showMessageBox(
        "Reboot now?",
        "Your computer will restart to apply the new GPU mode.",
        "YES_NO",
        "QUESTION",
      );
      if (choice !== "YES") {
        return;
      }

      setStatus("Rebooting", "busy");
      try {
        await rebootSystem();
      } catch (err) {
        const message = messageFromError(err);
        setStatus(message, "error");
        await Neutralino.os.showMessageBox(
          "Reboot failed",
          message,
          "OK",
          "ERROR",
        );
      }
    })();
  });
}

function onWindowClose(): void {
  Neutralino.app.exit();
}

function bootApp(): void {
  Neutralino.init();
  Neutralino.events.on("windowClose", onWindowClose);
  $("app-version").textContent = __APP_VERSION__;

  void (async () => {
    wireProfileToggles();
    wireGraphicsToggles();
    wireRefresh();
    wireReboot();
    wireSettings();
    wireCopyButtons();
    wireExternalLinks();
    applyInputState();

    if (!(await commandExists("system76-power"))) {
      setLoadError(
        "system76-power was not found. Install Pop!_OS system76-power or run on a supported laptop.",
      );
      return;
    }

    inputsEnabled = true;
    try {
      await refreshState();
    } catch (err) {
      const message = messageFromError(err);
      setLoadError(message);
      setStatus(message, "error");
    } finally {
      applyInputState();
    }
  })();
}

bootApp();
