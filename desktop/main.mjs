import { once } from "node:events";
import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  session,
  shell,
} from "electron";

const MODEL_DIRECTORY_NAME =
  "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17";
const BACKGROUND_COLOR = "#0b0d0f";

let mainWindow = null;
let localServer = null;
let appUrl = null;

function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

function isAppUrl(value) {
  if (!appUrl || !isLoopbackUrl(value)) return false;
  try {
    return new URL(value).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

function configurePermissions() {
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) =>
      permission === "media" && isAppUrl(requestingOrigin),
  );
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      callback(
        permission === "media" && isAppUrl(details.requestingUrl),
      );
    },
  );
}

async function startLocalServer() {
  process.env.PORT = "0";
  process.env.PROMPTER_PRODUCTION = "1";
  process.env.SHERPA_ONNX_MODEL_DIR = app.isPackaged
    ? path.join(process.resourcesPath, MODEL_DIRECTORY_NAME)
    : path.join(app.getAppPath(), ".models", MODEL_DIRECTORY_NAME);

  const serverModule = await import(
    new URL("../dist-server/index.mjs", import.meta.url)
  );
  localServer = serverModule.server;
  if (!localServer.listening) await once(localServer, "listening");

  const address = localServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Prompter could not reserve a local server port.");
  }
  appUrl = `http://127.0.0.1:${address.port}`;
}

async function createWindow() {
  if (!appUrl) throw new Error("The local Prompter server is not ready.");

  mainWindow = new BrowserWindow({
    title: "Prompter",
    width: 1440,
    height: 960,
    minWidth: 1040,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: BACKGROUND_COLOR,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(appUrl);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady()
    .then(async () => {
      app.setAppUserModelId("ReleasedGroup.Prompter");
      configurePermissions();
      await startLocalServer();
      await createWindow();
    })
    .catch((error) => {
      const message =
        error instanceof Error ? error.message : "Unknown startup error";
      dialog.showErrorBox("Prompter could not start", message);
      app.quit();
    });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && appUrl) {
      void createWindow();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    if (localServer?.listening) localServer.close();
  });
}
