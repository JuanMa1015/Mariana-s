# Mariana's — Frontend (apps/web)

Aplicación web del **Monitor Judicial Mariana's**. Permite registrar radicados
de la Rama Judicial, ver novedades/actuaciones y sincronizar manualmente.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- react-window (lista virtualizada de radicados)
- Vitest + Testing Library (tests)
- Sentry + Vercel Analytics

## Scripts

```bash
npm install
npm run dev      # servidor de desarrollo
npm run lint     # eslint
npm run test     # vitest
npm run build    # build de producción (tsc + vite)
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL del backend (por defecto `http://localhost:8000`) |
| `VITE_SENTRY_DSN` | (opcional) DSN de Sentry |
