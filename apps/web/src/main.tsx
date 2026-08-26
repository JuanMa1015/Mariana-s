/* eslint-disable react-refresh/only-export-components */
import { StrictMode, lazy, Suspense, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import Login from './components/Login.tsx'
import Register from './components/Register.tsx'
import LandingPage from './components/LandingPage.tsx'
import NotFoundPage from './components/NotFoundPage.tsx'
import ThanksPage from './components/ThanksPage.tsx'
import { PrivacyPage, TermsPage } from './components/LegalPages.tsx'
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
          {/* Rutas públicas */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/terminos" element={<TermsPage />} />
          <Route path="/gracias" element={<ThanksPage />} />
          {/* Rutas privadas */}
          <Route path="/procesos" element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Cargando...</div>}>
                <App />
              </Suspense>
            </ProtectedRoute>
          } />
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
        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
        {/* Analítica sin cookies de Vercel */}
        <Analytics />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
