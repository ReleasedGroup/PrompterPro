const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("prompterDesktop", {
  loadScripts: () => ipcRenderer.invoke("prompter:scripts:load"),
  saveScripts: (scripts) => ipcRenderer.invoke("prompter:scripts:save", scripts),
});
