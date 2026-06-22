import { Component, type ErrorInfo, type ReactNode } from "react"
import * as Sentry from "@sentry/react"

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info)
    if (typeof Sentry !== "undefined") {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f5f3ff] p-8">
          <div className="max-w-md rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-rose-800">Algo salió mal</h2>
            <p className="mt-2 text-sm text-rose-600 leading-relaxed">
              Ocurrió un error inesperado. Por favor intenta recargar la página.
            </p>
            <p className="mt-1 text-xs text-rose-400 font-mono">&nbsp;</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-95"
            >
              Recargar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
