import { registerPlugin } from "@capacitor/core"

interface DownloadNotificationsPlugin {
  showDownload(options: { uri: string; filename: string }): Promise<{ posted: boolean }>
}

export async function notificarDescarga(uri: string, filename: string): Promise<boolean> {
  try {
    const DownloadNotifications = registerPlugin<DownloadNotificationsPlugin>("DownloadNotifications")
    return (await DownloadNotifications.showDownload({ uri, filename })).posted
  } catch {
    return false
  }
}
