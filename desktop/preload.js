/** Preload — reserved for future native bridges. */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("elowenDesktop", {
  isDesktop: true,
});
