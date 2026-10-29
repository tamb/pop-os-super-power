import {
  type GraphicsMode,
  isGraphicsMode,
  isPowerProfile,
} from "../lib/constants.ts";
import { shouldShowRebootBanner } from "../lib/system76-output.ts";
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

type StatusKind = "idle" | "busy" | "error";

let graphicsBaseline: GraphicsMode | null = null;
let busy = false;

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
  el.textContent = message;
  el.classList.remove("is-busy", "is-error");
  if (kind === "busy") {
    el.classList.add("is-busy");
  }
  if (kind === "error") {
    el.classList.add("is-error");
  }
}

function setLoadError(message: string): void {
  const el = $("load-error");
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
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
  setStatus(label, "busy");
  try {
    await fn();
  } finally {
    busy = false;
  }
}

async function refreshState(): Promise<void> {
  const profile = await fetchProfile();
  setActiveToggle("profile-toggles", profile);

  const switchable = await fetchSwitchable();
  const panel = $("graphics-panel");
  if (!switchable) {
    panel.classList.add("is-disabled");
    setLoadError(
      "This system does not report switchable graphics. GPU controls are disabled.",
    );
    return;
  }

  panel.classList.remove("is-disabled");
  const graphics = await fetchGraphicsMode();
  graphicsBaseline = graphics;
  setActiveToggle("graphics-toggles", graphics);
  updateRebootBanner(graphics);
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

      void withBusy(`Setting profile to ${profile}…`, async () => {
        try {
          await applyProfile(profile);
          setActiveToggle("profile-toggles", profile);
          setStatus(`Power profile set to ${profile}.`);
          await Neutralino.os.showNotification(
            APP_TITLE,
            `Power profile: ${profile}`,
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
      });
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

      void withBusy(`Setting GPU mode to ${mode}…`, async () => {
        try {
          await applyGraphics(mode);
          setActiveToggle("graphics-toggles", mode);
          updateRebootBanner(mode);
          setStatus(`GPU mode set to ${mode}. Reboot when ready.`);
          await Neutralino.os.showNotification(
            APP_TITLE,
            `GPU mode: ${mode}. Reboot to apply.`,
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
        }
      });
    });
  });
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

      setStatus("Rebooting…", "busy");
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

  void (async () => {
    wireProfileToggles();
    wireGraphicsToggles();
    wireReboot();

    if (!(await commandExists("system76-power"))) {
      setLoadError(
        "system76-power was not found. Install Pop!_OS system76-power or run on a supported laptop.",
      );
      document.querySelectorAll(".toggle").forEach((node) => {
        (node as HTMLButtonElement).disabled = true;
      });
      return;
    }

    try {
      await refreshState();
    } catch (err) {
      const message = messageFromError(err);
      setLoadError(message);
      setStatus(message, "error");
    }
  })();
}

bootApp();
