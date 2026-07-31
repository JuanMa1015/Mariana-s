const DSN = import.meta.env.VITE_SENTRY_DSN
let initialized = false

function loadSentry() {
  return import("@sentry/react")
}

export function initSentry() {
  if (!DSN || initialized) return
  initialized = true
  void loadSentry().then((Sentry) => {
    Sentry.init({ dsn: DSN, tracesSampleRate: 0.1 })
  })
}

export function captureException(error: unknown, context?: { extra?: Record<string, unknown> }) {
  if (!DSN) return
  void loadSentry().then((Sentry) => {
    if (context) {
      Sentry.captureException(error, context)
    } else {
      Sentry.captureException(error)
    }
  })
}
