import { app, BrowserWindow, Menu, ipcMain, session } from "electron";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { workspaceUrl, workspaceRequestAllowed } from "./policy.mjs";
import { resolveFeature } from "./features/resolve.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const setupUrl = pathToFileURL(path.join(directory, "connect.html")).href;
app.setName("OpenWork Remote");
// Separate storage from the upstream desktop and its updater.
app.setPath("userData", path.join(app.getPath("appData"), "OpenWork Remote"));
const configPath = path.join(app.getPath("userData"), "connection.json");
let config = { url: "", enabled: true };
let error = "";
let window;
let settings;
const enabled = () => resolveFeature("selfHostedDesktop", {
  deployment: "self_hosted", locks: { selfHostedDesktop: config.enabled !== false },
  overrides: {}, rollouts: {},
}).enabled;

async function save() {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}

function openSettings() {
  if (settings && !settings.isDestroyed()) { settings.focus(); return; }
  settings = new BrowserWindow({ width: 640, height: 440, title: "Connect to your workspace", webPreferences: {
    preload: path.join(directory, "preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false,
  } });
  settings.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  settings.webContents.on("will-navigate", (event) => event.preventDefault());
  settings.loadURL(setupUrl);
}

async function connect() {
  if (!enabled()) { error = "Remote connections are disabled in connection.json. Enable them and restart the app."; openSettings(); return; }
  if (!config.url) { openSettings(); return; }
  if (!window || window.isDestroyed()) {
    window = new BrowserWindow({ width: 1280, height: 850, title: "OpenWork Remote", webPreferences: {
      partition: "persist:workspace", sandbox: true, contextIsolation: true, nodeIntegration: false,
      // No native preload or IPC capabilities are ever given to VM content.
    } });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    for (const name of ["will-navigate", "will-redirect"]) {
      window.webContents.on(name, (event, url) => {
        if (!workspaceRequestAllowed(url, config.url)) event.preventDefault();
      });
    }
  }
  try {
    await window.loadURL(config.url);
    error = "";
    settings?.close();
  } catch {
    error = "Workspace unavailable. Check your VPN and server, then reconnect.";
    openSettings();
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => (settings || window)?.focus());
  app.whenReady().then(async () => {
    try {
      const saved = JSON.parse(await readFile(configPath, "utf8"));
      config = { url: saved.url ? workspaceUrl(saved.url) : "", enabled: saved.enabled !== false };
    } catch (failure) {
      if (failure.code !== "ENOENT") error = "Saved connection is invalid. Enter your workspace address again.";
    }
    const workspace = session.fromPartition("persist:workspace");
    workspace.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    workspace.setPermissionCheckHandler(() => false);
    // Includes fetch, subframes, images and websocket upgrades. No cloud services,
    // telemetry, model credentials, or update requests leave this desktop shell.
    workspace.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, callback) => {
      callback({ cancel: !enabled() || !workspaceRequestAllowed(details.url, config.url) });
    });
    function requireSetup(event) {
      if (!settings || event.sender !== settings.webContents || event.senderFrame !== settings.webContents.mainFrame || event.senderFrame.url !== setupUrl) {
        throw new Error("Connection settings are only available in the local settings window.");
      }
    }
    ipcMain.handle("remote:read", (event) => { requireSetup(event); return { url: config.url, error, disabled: !enabled() }; });
    ipcMain.handle("remote:connect", async (event, value) => {
      requireSetup(event);
      if (!enabled()) return { error: "Remote connections are disabled. Enable them and restart the app." };
      try {
        if (typeof value !== "string") throw new Error("Enter a workspace address.");
        config.url = workspaceUrl(value);
        await save();
        await connect();
        return { error };
      } catch (failure) { return { error: failure.message }; }
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: "OpenWork Remote", submenu: [
        { label: "Connect to workspace…", accelerator: "CmdOrCtrl+,", click: openSettings },
        { label: "Reconnect", accelerator: "CmdOrCtrl+R", click: () => void connect() },
        { type: "separator" }, { role: "quit" },
      ] },
      { role: "editMenu" },
      { label: "View", submenu: [{ role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "togglefullscreen" }] },
    ]));
    await connect();
    app.on("activate", () => { if (window && !window.isDestroyed()) window.show(); else void connect(); });
  }).catch((failure) => { console.error(failure.message); app.quit(); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
