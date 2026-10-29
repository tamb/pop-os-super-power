const PROFILES = ["battery", "balanced", "performance"];
const GRAPHICS = ["integrated", "nvidia", "hybrid"];

let graphicsBaseline = null;
let busy = false;

function $(id) {
  return document.getElementById(id);
}

function setStatus(message, kind = "idle") {
  const el = $("status");
  el.textContent = message;
  el.classList.remove("is-busy", "is-error");
  if (kind === "busy") el.classList.add("is-busy");
  if (kind === "error") el.classList.add("is-error");
}

function setLoadError(message) {
  const el = $("load-error");
  if (!message) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

function setActiveToggle(groupId, value) {
  document.querySelectorAll(`#${groupId} .toggle`).forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.value === value);
  });
}

function updateRebootBanner(selectedGraphics) {
  const show =
    graphicsBaseline !== null && selectedGraphics !== graphicsBaseline;
  $("reboot-banner").classList.toggle("hidden", !show);
}

async function execSystem76Power(args) {
  const display = await Neutralino.os.getEnv("DISPLAY");
  const xauth = await Neutralino.os.getEnv("XAUTHORITY");
  const envPrefix =
    display || xauth
      ? `env ${display ? `DISPLAY=${shellQuote(display)}` : ""}${display && xauth ? " " : ""}${xauth ? `XAUTHORITY=${shellQuote(xauth)}` : ""} `
      : "";

  let cmd = `${envPrefix}system76-power ${args}`;
  let result = await Neutralino.os.execCommand(cmd);

  if (
    result.exitCode !== 0 &&
    /permission|polkit|not permitted|Operation not permitted/i.test(
      `${result.stdErr}\n${result.stdOut}`,
    )
  ) {
    cmd = `${envPrefix}pkexec system76-power ${args}`;
    result = await Neutralino.os.execCommand(cmd);
  }

  if (result.exitCode !== 0) {
    const detail = (result.stdErr || result.stdOut || "").trim();
    throw new Error(detail || `system76-power failed (exit ${result.exitCode})`);
  }

  return (result.stdOut || "").trim();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function commandExists(name) {
  const result = await Neutralino.os.execCommand(
    `command -v ${name} >/dev/null 2>&1; echo $?`,
  );
  return result.stdOut.trim() === "0";
}

async function getProfile() {
  const out = await execSystem76Power("profile");
  const match = out.match(/Power Profile:\s*(\w+)/i);
  if (!match) {
    throw new Error("Could not read power profile from system76-power.");
  }
  return match[1].toLowerCase();
}

async function getGraphicsMode() {
  const out = await execSystem76Power("graphics");
  const mode = out.split(/\s+/)[0].toLowerCase();
  if (!GRAPHICS.includes(mode) && mode !== "compute") {
    throw new Error(`Unexpected graphics mode: ${out}`);
  }
  return mode;
}

async function isSwitchableGraphics() {
  const out = await execSystem76Power("graphics switchable");
  return out.toLowerCase().includes("switchable");
}

async function setProfile(profile) {
  await execSystem76Power(`profile ${profile}`);
}

async function setGraphics(mode) {
  await execSystem76Power(`graphics ${mode}`);
}

async function withBusy(label, fn) {
  if (busy) return;
  busy = true;
  setStatus(label, "busy");
  try {
    await fn();
  } finally {
    busy = false;
  }
}

async function refreshState() {
  const profile = await getProfile();
  setActiveToggle("profile-toggles", profile);

  const switchable = await isSwitchableGraphics();
  const panel = $("graphics-panel");
  if (!switchable) {
    panel.classList.add("is-disabled");
    setLoadError(
      "This system does not report switchable graphics. GPU controls are disabled.",
    );
    return;
  }

  panel.classList.remove("is-disabled");
  let graphics = await getGraphicsMode();
  if (graphics === "compute") {
    graphics = "integrated";
  }
  graphicsBaseline = graphics;
  setActiveToggle("graphics-toggles", graphics);
  updateRebootBanner(graphics);
  setStatus("Ready.");
}

function wireProfileToggles() {
  document.querySelectorAll("#profile-toggles .toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const profile = btn.dataset.value;
      if (!PROFILES.includes(profile)) return;

      withBusy(`Setting profile to ${profile}…`, async () => {
        try {
          await setProfile(profile);
          setActiveToggle("profile-toggles", profile);
          setStatus(`Power profile set to ${profile}.`);
          await Neutralino.os.showNotification(
            "Pop!_OS Super Power",
            `Power profile: ${profile}`,
          );
        } catch (err) {
          setStatus(err.message, "error");
          await Neutralino.os.showMessageBox(
            "Profile error",
            err.message,
            "OK",
            "ERROR",
          );
        }
      });
    });
  });
}

function wireGraphicsToggles() {
  document.querySelectorAll("#graphics-toggles .toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.value;
      if (!GRAPHICS.includes(mode)) return;

      withBusy(`Setting GPU mode to ${mode}…`, async () => {
        try {
          await setGraphics(mode);
          setActiveToggle("graphics-toggles", mode);
          updateRebootBanner(mode);
          setStatus(`GPU mode set to ${mode}. Reboot when ready.`);
          await Neutralino.os.showNotification(
            "Pop!_OS Super Power",
            `GPU mode: ${mode}. Reboot to apply.`,
          );
        } catch (err) {
          setStatus(err.message, "error");
          await Neutralino.os.showMessageBox(
            "GPU mode error",
            err.message,
            "OK",
            "ERROR",
          );
        }
      });
    });
  });
}

function wireReboot() {
  $("reboot-btn").addEventListener("click", async () => {
    const choice = await Neutralino.os.showMessageBox(
      "Reboot now?",
      "Your computer will restart to apply the new GPU mode.",
      "YES_NO",
      "QUESTION",
    );
    if (choice !== "YES") return;

    setStatus("Rebooting…", "busy");
    try {
      const result = await Neutralino.os.execCommand("loginctl reboot");
      if (result.exitCode !== 0) {
        const pk = await Neutralino.os.execCommand("pkexec loginctl reboot");
        if (pk.exitCode !== 0) {
          throw new Error(
            (pk.stdErr || pk.stdOut || result.stdErr || "").trim() ||
              "Could not start reboot.",
          );
        }
      }
    } catch (err) {
      setStatus(err.message, "error");
      await Neutralino.os.showMessageBox(
        "Reboot failed",
        err.message,
        "OK",
        "ERROR",
      );
    }
  });
}

function onWindowClose() {
  Neutralino.app.exit();
}

Neutralino.init();
Neutralino.events.on("windowClose", onWindowClose);

(async () => {
  wireProfileToggles();
  wireGraphicsToggles();
  wireReboot();

  if (!(await commandExists("system76-power"))) {
    setLoadError(
      "system76-power was not found. Install Pop!_OS system76-power or run on a supported laptop.",
    );
    document.querySelectorAll(".toggle").forEach((b) => {
      b.disabled = true;
    });
    return;
  }

  try {
    await refreshState();
  } catch (err) {
    setLoadError(err.message);
    setStatus(err.message, "error");
  }
})();
