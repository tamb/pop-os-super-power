// src/lib/constants.ts
var PROFILES = ["battery", "balanced", "performance"];
var GRAPHICS_MODES = [
  "integrated",
  "nvidia",
  "hybrid"
];
function isPowerProfile(value) {
  return PROFILES.includes(value);
}
function isGraphicsMode(value) {
  return GRAPHICS_MODES.includes(value);
}

// src/lib/system76-output.ts
function parseProfileOutput(output) {
  const match = output.match(/Power Profile:\s*(\w+)/i);
  if (!match || !isPowerProfile(match[1].toLowerCase())) {
    throw new Error("Could not read power profile from system76-power.");
  }
  return match[1].toLowerCase();
}
function parseGraphicsOutput(output) {
  const mode = output.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (mode === "compute") {
    return "compute";
  }
  if (!GRAPHICS_MODES.includes(mode)) {
    throw new Error(`Unexpected graphics mode: ${output.trim()}`);
  }
  return mode;
}
function graphicsModeForUi(raw) {
  return raw === "compute" ? "integrated" : raw;
}
function parseSwitchableOutput(output) {
  const firstLine = output.trim().split(/\n/)[0]?.trim().toLowerCase() ?? "";
  return firstLine === "switchable";
}
function shouldShowRebootBanner(baseline, selected) {
  return baseline !== null && selected !== baseline;
}

// src/lib/shell.ts
function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function sessionEnvPrefix(env) {
  const parts = [];
  if (env.display) {
    parts.push(`DISPLAY=${shellQuote(env.display)}`);
  }
  if (env.xauthority) {
    parts.push(`XAUTHORITY=${shellQuote(env.xauthority)}`);
  }
  if (parts.length === 0) {
    return "";
  }
  return `env ${parts.join(" ")} `;
}
function system76PowerCommand(args, env = {}) {
  return `${sessionEnvPrefix(env)}system76-power ${args}`;
}
function pkexecSystem76PowerCommand(args, env = {}) {
  return `${sessionEnvPrefix(env)}pkexec system76-power ${args}`;
}
var PERMISSION_DENIED = /permission|polkit|not permitted|Operation not permitted/i;
function execResultLooksLikePermissionDenied(stdout, stderr) {
  return PERMISSION_DENIED.test(`${stderr}
${stdout}`);
}
function formatExecFailure(exitCode, stdout, stderr) {
  const detail = (stderr || stdout).trim();
  return detail || `system76-power failed (exit ${exitCode})`;
}

// src/app/neutralino-runtime.ts
async function execCommand(command) {
  return Neutralino.os.execCommand(command);
}
async function getSessionEnv() {
  const [display, xauthority] = await Promise.all([
    Neutralino.os.getEnv("DISPLAY"),
    Neutralino.os.getEnv("XAUTHORITY")
  ]);
  return { display, xauthority };
}

// src/lib/errors.ts
function messageFromError(err) {
  return err instanceof Error ? err.message : String(err);
}

// src/app/system76-client.ts
async function runSystem76Power(args) {
  const env = await getSessionEnv();
  let cmd = system76PowerCommand(args, env);
  let result = await execCommand(cmd);
  if (result.exitCode !== 0 && execResultLooksLikePermissionDenied(result.stdOut, result.stdErr)) {
    cmd = pkexecSystem76PowerCommand(args, env);
    result = await execCommand(cmd);
  }
  if (result.exitCode !== 0) {
    throw new Error(
      formatExecFailure(result.exitCode, result.stdOut, result.stdErr)
    );
  }
  return (result.stdOut || "").trim();
}
async function commandExists(name) {
  const result = await execCommand(
    `command -v ${name} >/dev/null 2>&1; echo $?`
  );
  return result.stdOut.trim() === "0";
}
async function rebootSystem() {
  const result = await execCommand("loginctl reboot");
  if (result.exitCode !== 0) {
    const pk = await execCommand("pkexec loginctl reboot");
    if (pk.exitCode !== 0) {
      throw new Error(
        formatExecFailure(
          pk.exitCode,
          pk.stdOut || result.stdOut,
          pk.stdErr || result.stdErr
        ) || "Could not start reboot."
      );
    }
  }
}
async function fetchProfile() {
  return parseProfileOutput(await runSystem76Power("profile"));
}
async function fetchGraphicsMode() {
  const raw = parseGraphicsOutput(await runSystem76Power("graphics"));
  return graphicsModeForUi(raw);
}
async function fetchSwitchable() {
  return parseSwitchableOutput(await runSystem76Power("graphics switchable"));
}
async function applyProfile(profile) {
  await runSystem76Power(`profile ${profile}`);
}
async function applyGraphics(mode) {
  await runSystem76Power(`graphics ${mode}`);
}

// src/app/main.ts
var graphicsBaseline = null;
var busy = false;
var APP_TITLE = "Pop!_OS Super Power";
function $(id) {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}`);
  }
  return el;
}
function setStatus(message, kind = "idle") {
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
  document.querySelectorAll(`#${groupId} .toggle`).forEach((node) => {
    const btn = node;
    btn.classList.toggle("is-active", btn.dataset.value === value);
  });
}
function updateRebootBanner(selected) {
  $("reboot-banner").classList.toggle(
    "hidden",
    !shouldShowRebootBanner(graphicsBaseline, selected)
  );
}
async function withBusy(label, fn) {
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
async function refreshState() {
  const profile = await fetchProfile();
  setActiveToggle("profile-toggles", profile);
  const switchable = await fetchSwitchable();
  const panel = $("graphics-panel");
  if (!switchable) {
    panel.classList.add("is-disabled");
    setLoadError(
      "This system does not report switchable graphics. GPU controls are disabled."
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
function wireProfileToggles() {
  document.querySelectorAll("#profile-toggles .toggle").forEach((node) => {
    const btn = node;
    btn.addEventListener("click", () => {
      const profile = btn.dataset.value ?? "";
      if (!isPowerProfile(profile)) {
        return;
      }
      void withBusy(`Setting profile to ${profile}\u2026`, async () => {
        try {
          await applyProfile(profile);
          setActiveToggle("profile-toggles", profile);
          setStatus(`Power profile set to ${profile}.`);
          await Neutralino.os.showNotification(
            APP_TITLE,
            `Power profile: ${profile}`
          );
        } catch (err) {
          const message = messageFromError(err);
          setStatus(message, "error");
          await Neutralino.os.showMessageBox(
            "Profile error",
            message,
            "OK",
            "ERROR"
          );
        }
      });
    });
  });
}
function wireGraphicsToggles() {
  document.querySelectorAll("#graphics-toggles .toggle").forEach((node) => {
    const btn = node;
    btn.addEventListener("click", () => {
      const mode = btn.dataset.value ?? "";
      if (!isGraphicsMode(mode)) {
        return;
      }
      void withBusy(`Setting GPU mode to ${mode}\u2026`, async () => {
        try {
          await applyGraphics(mode);
          setActiveToggle("graphics-toggles", mode);
          updateRebootBanner(mode);
          setStatus(`GPU mode set to ${mode}. Reboot when ready.`);
          await Neutralino.os.showNotification(
            APP_TITLE,
            `GPU mode: ${mode}. Reboot to apply.`
          );
        } catch (err) {
          const message = messageFromError(err);
          setStatus(message, "error");
          await Neutralino.os.showMessageBox(
            "GPU mode error",
            message,
            "OK",
            "ERROR"
          );
        }
      });
    });
  });
}
function wireReboot() {
  $("reboot-btn").addEventListener("click", () => {
    void (async () => {
      const choice = await Neutralino.os.showMessageBox(
        "Reboot now?",
        "Your computer will restart to apply the new GPU mode.",
        "YES_NO",
        "QUESTION"
      );
      if (choice !== "YES") {
        return;
      }
      setStatus("Rebooting\u2026", "busy");
      try {
        await rebootSystem();
      } catch (err) {
        const message = messageFromError(err);
        setStatus(message, "error");
        await Neutralino.os.showMessageBox(
          "Reboot failed",
          message,
          "OK",
          "ERROR"
        );
      }
    })();
  });
}
function onWindowClose() {
  Neutralino.app.exit();
}
function bootApp() {
  Neutralino.init();
  Neutralino.events.on("windowClose", onWindowClose);
  void (async () => {
    wireProfileToggles();
    wireGraphicsToggles();
    wireReboot();
    if (!await commandExists("system76-power")) {
      setLoadError(
        "system76-power was not found. Install Pop!_OS system76-power or run on a supported laptop."
      );
      document.querySelectorAll(".toggle").forEach((node) => {
        node.disabled = true;
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
