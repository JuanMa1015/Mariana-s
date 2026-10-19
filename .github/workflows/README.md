Sync workflow

- Se ejecuta cada hora via cron (`0 * * * *`).
- Llama a `POST /procesos/sync-lote` del backend (Render).
- Requiere `API_URL` y `API_TOKEN` como secrets del repositorio.
- Wake-up: hasta 18 intentos (3 min) para esperar cold start de Render.
- Sync: `--retry 3 --retry-delay 30` para tolerar errores transitorios.
- Si Rama Judicial está caída, el API responde 200 con mensaje claro.
- El workflow NO falla cuando Rama está caída (es externo).


Release Android

- Workflow `release-android.yml`: al empujar un tag `vX.Y.Z` compila el APK y publica un GitHub Release con notas del `CHANGELOG.md`.
- Requiere la variable de repositorio `VITE_API_URL`. Opcional (APK firmado): secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
