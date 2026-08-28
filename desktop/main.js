/**
 * Electron main process: start elowen-api sidecar, open local UI, stop on quit.
 */
const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");
const net = require("net");

const DEFAULT_PORT = 17832;
let apiProcess = null;
let mainWindow = null;
let apiPort = DEFAULT_PORT;

function isDev() {
  return !app.isPackaged;
}

function resourcesDir() {
  if (isDev()) {
    // Prefer a locally built sidecar under backend/dist
    return path.join(__dirname, "..", "backend", "dist");
  }
  return process.resourcesPath;
}

function apiBinaryPath() {
  const base = resourcesDir();
  const name = process.platform === "win32" ? "elowen-api.exe" : "elowen-api";
  // onedir layout: elowen-api/elowen-api
  const onedir = path.join(base, "elowen-api", name);
  if (fs.existsSync(onedir)) return onedir;
  // fallback flat
  const flat = path.join(base, name);
  if (fs.existsSync(flat)) return flat;
  return onedir;
}

function findFreePort(start) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.unref();
      server.on("error", () => tryPort(port + 1));
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve(port));
      });
    };
    tryPort(start);
  });
}

function waitForHealth(port, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(
        { host: "127.0.0.1", port, path: "/api/health", timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve();
            return;
          }
          retry();
        }
      );
      req.on("error", retry);
      req.on("timeout", () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("API health check timed out"));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function startApi() {
  apiPort = await findFreePort(DEFAULT_PORT);
  const bin = apiBinaryPath();
  if (!fs.existsSync(bin)) {
    throw new Error(
      `Missing API binary at:\n${bin}\n\nRun ./scripts/build-desktop.sh first.`
    );
  }

  const userData = app.getPath("userData");
  const env = {
    ...process.env,
    ELOWEN_API_HOST: "127.0.0.1",
    ELOWEN_API_PORT: String(apiPort),
    ELOWEN_DATA_DIR: userData,
    ELOWEN_DB_PATH: path.join(userData, "elowen.sqlite3"),
    ELOWEN_IMAGES_DIR: path.join(userData, "images"),
    ELOWEN_AUTO_SEED: "1",
  };

  // Seed: prefer bundled seed next to binary or under _internal
  const seedCandidates = [
    path.join(path.dirname(bin), "seed"),
    path.join(path.dirname(bin), "_internal", "seed"),
  ];
  for (const seedCandidate of seedCandidates) {
    if (fs.existsSync(seedCandidate)) {
      env.ELOWEN_SEED_DIR = seedCandidate;
      break;
    }
  }

  apiProcess = spawn(bin, [], {
    env,
    cwd: path.dirname(bin),
    stdio: ["ignore", "pipe", "pipe"],
  });

  apiProcess.stdout.on("data", (d) => console.log(`[api] ${d}`));
  apiProcess.stderr.on("data", (d) => console.error(`[api] ${d}`));
  apiProcess.on("exit", (code) => {
    console.log(`[api] exited code=${code}`);
    apiProcess = null;
  });

  await waitForHealth(apiPort);
}

function stopApi() {
  if (!apiProcess) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(apiProcess.pid), "/f", "/t"]);
    } else {
      apiProcess.kill("SIGTERM");
    }
  } catch (e) {
    console.error("Failed to stop API", e);
  }
  apiProcess = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Elowen",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${apiPort}/`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  try {
    await startApi();
    createWindow();
  } catch (e) {
    dialog.showErrorBox("Elowen failed to start", String(e.message || e));
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopApi();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopApi();
});
