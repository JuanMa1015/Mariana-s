import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'co.mariana.monitor',
  appName: "Mariana's",
  webDir: 'dist',
  backgroundColor: '#ffffff',
  // Peticiones HTTP nativas: no dependen de CORS ni de cookies de terceros del WebView
  plugins: { CapacitorHttp: { enabled: true } },
}

export default config
