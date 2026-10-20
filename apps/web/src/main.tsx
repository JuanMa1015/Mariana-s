/* eslint-disable react-refresh/only-export-components */
import { StrictMode, lazy, Suspense, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
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
import { iniciarTema } from './theme'
import { OlvidePage, RestablecerPage } from './components/RecuperarPassword.tsx'

const App = lazy(() => import('./App.tsx'))
const NovedadesPage = lazy(() => import('./components/NovedadesPage.tsx'))
const AjustesPage = lazy(() => import('./components/AjustesPage.tsx'))

initSentry()

iniciarTema()

// App móvil: el botón atrás de Android navega hacia atrás y sale de la app solo desde la raíz.
const BackButton = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const h = CapApp.addListener('backButton', () => {
      if (pathname === '/procesos' || pathname === '/login') void CapApp.exitApp()
      else navigate(-1)
    })
    return () => { void h.then((x) => x.remove()) }
  }, [pathname, navigate])
  return null
}

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
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { background: 'var(--toast-bg)', color: 'var(--toast-fg)', border: '1px solid var(--toast-border)', fontWeight: '500' } }} />
        <BackButton />
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={Capacitor.isNativePlatform() ? <Navigate to="/procesos" replace /> : <LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/olvide" element={<OlvidePage />} />
          <Route path="/restablecer" element={<RestablecerPage />} />
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
          <Route path="/ajustes" element={
            <ProtectedRoute>
              <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Cargando...</div>}>
                <AjustesPage />
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
