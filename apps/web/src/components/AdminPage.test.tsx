import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const api = vi.hoisted(() => ({
  getMe: vi.fn(),
  apiJson: vi.fn(),
}))
vi.mock("../api", () => api)
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => "t") }) }))

import AdminPage from "./AdminPage"

const USUARIO = {
  id: 2, email: "ana@example.com", username: "ana", activo: true, es_admin: false, admin_por_correo: false,
  telegram_chat_id: null, creado_en: "2026-10-01T10:00:00", ultimo_acceso: null, procesos: 3, dispositivos: 1,
}
const PRUEBA_OK = { id: "bd", nombre: "Base de datos", estado: "ok", resumen: "2/2 comprobaciones correctas", ms: 12, pasos: [{ estado: "ok", nombre: "Conexión a la base de datos", detalle: "sqlite" }, { estado: "ok", nombre: "Lectura de tablas", detalle: "usuarios: 2" }] }

function abrir() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/procesos" element={<p>Pantalla de procesos</p>} />
        <Route path="/ajustes" element={<p>Ajustes</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getMe.mockResolvedValue({ id: 1, es_admin: true })
  api.apiJson.mockImplementation(async (ruta: string, op?: { method?: string }) => {
    if (ruta.startsWith("/panel/resumen")) return { usuarios: { total: 2, activos: 2, admins: 1, nuevos_7d: 1 }, procesos: { total: 5, con_novedad: 2, sin_sincronizar_24h: 0, con_fallos: 0, aviso_pendiente: 0 }, dispositivos: 1, ultima_sincronizacion: null, integraciones: { correo: ["brevo"], telegram: false, push: true, api_token: true, admins_por_correo: 1 } }
    if (ruta.startsWith("/panel/usuarios") && !op?.method) return { total: 1, usuarios: [USUARIO] }
    if (ruta === "/panel/pruebas") return { pruebas: [{ id: "bd", nombre: "Base de datos", descripcion: "Conexión y migraciones.", parametros: [] }, { id: "correo", nombre: "Correo", descripcion: "Envío de prueba.", parametros: [{ nombre: "destino", tipo: "email", etiqueta: "Enviar a", defecto: "yo@example.com" }] }] }
    if (ruta === "/panel/pruebas/bd") return PRUEBA_OK
    if (ruta === "/panel/pruebas/correo") return { ...PRUEBA_OK, id: "correo", nombre: "Correo" }
    if (ruta === "/panel/pruebas/todas") return { estado: "ok", resultados: [PRUEBA_OK] }
    return { ok: true }
  })
})

describe("AdminPage", () => {
  it("un usuario sin rol de administrador vuelve a la pantalla de procesos", async () => {
    api.getMe.mockResolvedValue({ id: 3, es_admin: false })
    abrir()
    expect(await screen.findByText("Pantalla de procesos")).toBeInTheDocument()
  })

  it("el administrador ve el resumen y navega por las secciones", async () => {
    abrir()
    expect(await screen.findByText("Integraciones")).toBeInTheDocument()
    expect(screen.getByText(/Correo: brevo/)).toBeInTheDocument()
    for (const s of ["Usuarios", "Procesos", "Dispositivos", "Pruebas", "Auditoría"]) {
      expect(screen.getByRole("button", { name: s })).toBeInTheDocument()
    }
  })

  it("lista usuarios y pide confirmación antes de eliminar", async () => {
    abrir()
    fireEvent.click(await screen.findByRole("button", { name: "Usuarios" }))
    const fila = (await screen.findByText("ana@example.com")).closest("tr")!
    fireEvent.click(within(fila).getByRole("button", { name: "Eliminar" }))
    expect(screen.getByRole("alertdialog", { name: "¿Eliminar este usuario?" })).toBeInTheDocument()
    expect(api.apiJson).not.toHaveBeenCalledWith("/panel/usuarios/2", expect.objectContaining({ method: "DELETE" }))
    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }))
    await waitFor(() => expect(api.apiJson).toHaveBeenCalledWith("/panel/usuarios/2", { method: "DELETE" }))
  })

  it("suspende un usuario desde la fila", async () => {
    abrir()
    fireEvent.click(await screen.findByRole("button", { name: "Usuarios" }))
    const fila = (await screen.findByText("ana@example.com")).closest("tr")!
    fireEvent.click(within(fila).getByRole("button", { name: "Suspender" }))
    await waitFor(() => expect(api.apiJson).toHaveBeenCalledWith("/panel/usuarios/2", { method: "PATCH", body: { activo: false } }))
  })

  it("ejecuta una prueba con sus parámetros y muestra los pasos", async () => {
    abrir()
    fireEvent.click(await screen.findByRole("button", { name: "Pruebas" }))
    fireEvent.click(await screen.findByRole("button", { name: "Ejecutar «Correo»" }))
    await waitFor(() => expect(api.apiJson).toHaveBeenCalledWith("/panel/pruebas/correo", { method: "POST", body: { parametros: { destino: "yo@example.com" } } }))

    fireEvent.click(screen.getByRole("button", { name: "Ejecutar «Base de datos»" }))
    const resultado = await screen.findByRole("status", { name: "Resultado de Base de datos" })
    expect(within(resultado).getByText("Conexión a la base de datos")).toBeInTheDocument()
  })

  it("«Ejecutar todas» corre el diagnóstico en modo seguro", async () => {
    abrir()
    fireEvent.click(await screen.findByRole("button", { name: "Pruebas" }))
    fireEvent.click(await screen.findByRole("button", { name: "Ejecutar todas" }))
    await waitFor(() => expect(api.apiJson).toHaveBeenCalledWith("/panel/pruebas/todas", { method: "POST" }))
    expect(await screen.findByText(/Resultado general: correcta/)).toBeInTheDocument()
  })
})
