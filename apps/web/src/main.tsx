/* eslint-disable react-refresh/only-export-components */
import { StrictMode, lazy, Suspense, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import Login from './components/Login.tsx'
import Register from './components/Register.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

import { getMe } from './api'
import { initSentry } from './sentry'

const App = lazy(() => import('./App.tsx'))
const NovedadesPage = lazy(() => import('./components/NovedadesPage.tsx'))

initSentry()

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    getMe().then(() => setOk(true)).catch(() => setOk(false))
  }, [])

  if (ok === null) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Verificando sesión...</div>
  }

  if (!ok) {
    return <Navigate to="/login" replace />
  }

  return children
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: '#f5f3ff', color: '#5b21b6', border: '1px solid #ddd6fe', fontWeight: '500' } }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/novedades" element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Cargando...</div>}>
                <NovedadesPage />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/procesos/:llaveProceso" element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Cargando...</div>}>
                <App />
              </Suspense>
            </ProtectedRoute>
          } />
          <Route path="/*" element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Cargando...</div>}>
                <App />
              </Suspense>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
