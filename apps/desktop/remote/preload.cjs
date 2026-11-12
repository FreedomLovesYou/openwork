const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("connection", {
  read: () => ipcRenderer.invoke("remote:read"),
  connect: (url) => ipcRenderer.invoke("remote:connect", url),
});
