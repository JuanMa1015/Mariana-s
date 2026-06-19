import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'
import Login from './components/Login.tsx'
import Register from './components/Register.tsx'
import NovedadesPage from './components/NovedadesPage.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    tracesSampleRate: 0.1,
  })
}

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const token = localStorage.getItem("token")
  if (!token) {
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
              <NovedadesPage />
            </ProtectedRoute>
          } />
          <Route path="/*" element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
