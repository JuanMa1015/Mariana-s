/* eslint-disable react-refresh/only-export-components */
import { StrictMode, lazy, Suspense, useEffect } from 'react'
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

import ProtectedLayout from './components/ProtectedLayout'
import { initSentry } from './sentry'
import { iniciarTema } from './theme'
import { OlvidePage, RestablecerPage } from './components/RecuperarPassword.tsx'

const App = lazy(() => import('./App.tsx'))
const NovedadesPage = lazy(() => import('./components/NovedadesPage.tsx'))
const AjustesPage = lazy(() => import('./components/AjustesPage.tsx'))
const AdminPage = lazy(() => import('./components/AdminPage.tsx'))

initSentry()

iniciarTema()

// App móvil: el botón atrás de Android navega hacia atrás y sale de la app solo desde la raíz.
const BackButton = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const h = CapApp.addListener('backButton', () => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        return
      }
      if (pathname === '/procesos' || pathname === '/admin' || pathname === '/login') void CapApp.exitApp()
      else if (window.history.state?.idx > 0) navigate(-1)
      else navigate('/procesos', { replace: true })
    })
    return () => { void h.then((x) => x.remove()) }
  }, [pathname, navigate])
  return null
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
          <Route element={<ProtectedLayout />}>
            <Route path="/procesos" element={<Suspense fallback={<p role="status">Cargando procesos…</p>}><App /></Suspense>} />
            <Route path="/procesos/:llaveProceso" element={<Suspense fallback={<p role="status">Cargando expediente…</p>}><App /></Suspense>} />
            <Route path="/novedades" element={<Suspense fallback={<p role="status">Cargando novedades…</p>}><NovedadesPage /></Suspense>} />
            <Route path="/ajustes" element={<Suspense fallback={<p role="status">Cargando ajustes…</p>}><AjustesPage /></Suspense>} />
            <Route path="/admin" element={<Suspense fallback={<p role="status">Cargando administración…</p>}><AdminPage /></Suspense>} />
          </Route>
        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
        {/* Analítica sin cookies de Vercel */}
        <Analytics />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
