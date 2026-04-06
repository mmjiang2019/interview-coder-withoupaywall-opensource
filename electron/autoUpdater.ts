import { autoUpdater } from "electron-updater"
import { BrowserWindow, ipcMain, app } from "electron"
import log from "electron-log"
import { safeLogger } from "./SafeLogger"

export function initAutoUpdater() {
  safeLogger.mainLog("Initializing auto-updater...")

  // Skip update checks in development
  if (!app.isPackaged) {
    safeLogger.mainLog("Skipping auto-updater in development mode")
    return
  }

  if (!process.env.GH_TOKEN) {
    safeLogger.mainError("GH_TOKEN environment variable is not set")
    return
  }

  // Configure auto updater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = true
  autoUpdater.allowPrerelease = true

  // Enable more verbose logging
  autoUpdater.logger = log
  log.transports.file.level = "debug"
  safeLogger.mainLog(
    "Auto-updater logger configured with level:",
    log.transports.file.level
  )

  // Log all update events
  autoUpdater.on("checking-for-update", () => {
    safeLogger.mainLog("Checking for updates...")
  })

  autoUpdater.on("update-available", (info) => {
    safeLogger.mainLog("Update available:", info)
    // Notify renderer process about available update
    BrowserWindow.getAllWindows().forEach((window) => {
      safeLogger.mainLog("Sending update-available to window")
      window.webContents.send("update-available", info)
    })
  })

  autoUpdater.on("update-not-available", (info) => {
    safeLogger.mainLog("Update not available:", info)
  })

  autoUpdater.on("download-progress", (progressObj) => {
    safeLogger.mainLog("Download progress:", progressObj)
  })

  autoUpdater.on("update-downloaded", (info) => {
    safeLogger.mainLog("Update downloaded:", info)
    // Notify renderer process that update is ready to install
    BrowserWindow.getAllWindows().forEach((window) => {
      safeLogger.mainLog("Sending update-downloaded to window")
      window.webContents.send("update-downloaded", info)
    })
  })

  autoUpdater.on("error", (err) => {
    safeLogger.mainError("Auto updater error:", err)
  })

  // Check for updates immediately
  safeLogger.mainLog("Checking for updates...")
  autoUpdater
    .checkForUpdates()
    .then((result) => {
      safeLogger.mainLog("Update check result:", result)
    })
    .catch((err) => {
      safeLogger.mainError("Error checking for updates:", err)
    })

  // Set up update checking interval (every 1 hour)
  setInterval(() => {
    safeLogger.mainLog("Checking for updates (interval)...")
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        safeLogger.mainLog("Update check result (interval):", result)
      })
      .catch((err) => {
        safeLogger.mainError("Error checking for updates (interval):", err)
      })
  }, 60 * 60 * 1000)

  // Handle IPC messages from renderer
  ipcMain.handle("start-update", async () => {
    safeLogger.mainLog("Start update requested")
    try {
      await autoUpdater.downloadUpdate()
      safeLogger.mainLog("Update download completed")
      return { success: true }
    } catch (error) {
      safeLogger.mainError("Failed to start update:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("install-update", () => {
    safeLogger.mainLog("Install update requested")
    autoUpdater.quitAndInstall()
  })
}
