import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
const guardarDocumento = vi.hoisted(() => vi.fn())
vi.mock("../utils/documentos", () => ({ guardarDocumento }))
globalThis.fetch = mockFetch

it("consulta novedades y el estado de sincronización antes de confirmar su revisión", async () => {
  const api = await import("./index")
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ total: 2, marcados: 2, en_curso: false }) })
  await api.getNovedades()
  await api.getNovedadesDetalle(25, 25)
  await api.postSync()
  await api.getSyncEstado()
  await expect(api.marcarTodoLeido()).resolves.toMatchObject({ marcados: 2 })
  expect(mockFetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
    "/procesos/novedades", "/procesos/novedades-detalle", "/procesos/sync", "/procesos/sync/estado", "/procesos/marcar-todo-leido",
  ])
  expect(new URL(mockFetch.mock.calls[1][0]).searchParams.get("skip")).toBe("25")
  expect(mockFetch.mock.calls[4][1].method).toBe("POST")
})

it("descarga el documento autenticado antes de enviarlo al sistema de archivos", async () => {
  const documento = new Blob(["%PDF-documento"], { type: "application/pdf" })
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, blob: async () => documento })
  guardarDocumento.mockResolvedValueOnce("descargas")
  const api = await import("./index")
  await expect(api.descargarDocumento(42, "auto.pdf")).resolves.toBe("descargas")
  expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/procesos/documento/42"), expect.objectContaining({ credentials: "include" }))
  expect(guardarDocumento).toHaveBeenCalledWith(documento, "auto.pdf")
})

it("no guarda una respuesta de error como si fuera un documento", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ detail: "Documento no disponible" }) })
  const api = await import("./index")
  await expect(api.descargarDocumento(42, "auto.pdf")).rejects.toMatchObject({ status: 404, message: "Documento no disponible" })
  expect(guardarDocumento).not.toHaveBeenCalled()
})

it("presenta los errores de validación del servidor como texto legible", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ detail: [{ msg: "Correo inválido" }, { msg: "Contraseña demasiado corta" }] }) })
  const api = await import("./index")
  await expect(api.registerUser({ email: "mal", password: "1" })).rejects.toThrow("Correo inválido; Contraseña demasiado corta")
})

it("ofrece un error comprensible cuando el servidor no devuelve JSON", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => { throw new SyntaxError("HTML") } })
  const api = await import("./index")
  await expect(api.getProceso("123")).rejects.toMatchObject({ status: 400, message: "No se pudo cargar el expediente." })
})

it("consulta las siguientes actuaciones y actualiza su revisión sin perder el identificador", async () => {
  const api = await import("./index")
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ actuaciones: [] }) })
  await api.getProceso("123", 50, 25)
  expect(mockFetch).toHaveBeenLastCalledWith(expect.stringContaining("/procesos/123?skip=50&limit=25"), expect.any(Object))
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ notificado: true }) })
  await expect(api.updateProceso("123", { notificado: true })).resolves.toEqual({ notificado: true })
  expect(mockFetch).toHaveBeenLastCalledWith(expect.stringContaining("/procesos/123"), expect.objectContaining({ method: "PATCH", body: JSON.stringify({ notificado: true }) }))
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('loginUser', () => {
  it('should POST credentials and return JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'test@example.com' }),
    })

    const { loginUser } = await import('./index')
    const result = await loginUser({ credential: 'test@example.com', password: 'pass' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ credential: 'test@example.com', password: 'pass' }),
      }),
    )
    expect(result.email).toBe('test@example.com')
  })

  it('should throw on error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: 'Credenciales inválidas' }),
    })

    const { loginUser } = await import('./index')
    await expect(loginUser({ credential: 'bad', password: 'bad' })).rejects.toThrow('Credenciales inválidas')
  })
})

describe('registerUser', () => {
  it('should POST registration and return JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: 'new@example.com' }),
    })

    const { registerUser } = await import('./index')
    const result = await registerUser({ email: 'new@example.com', password: 'pass' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.email).toBe('new@example.com')
  })
})

describe('fetchWithAuth (via getProcesos)', () => {
  it('should send credentials include', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ total: 0, procesos: [] }),
    })

    const { getProcesos } = await import('./index')
    await getProcesos()

    const call = mockFetch.mock.calls[0]
    expect(call[1]?.credentials).toBe('include')
  })

  it('notifica la sesión vencida sin tratar el error como datos de procesos', async () => {
    const expirar = vi.fn()
    window.addEventListener('session-expired', expirar)
    mockFetch.mockResolvedValueOnce({ status: 401, json: async () => ({ detail: 'Unauthorized' }) })
    const { getProcesos } = await import('./index')
    await expect(getProcesos()).rejects.toMatchObject({ status: 401 })
    expect(expirar).toHaveBeenCalledTimes(1)
    window.removeEventListener('session-expired', expirar)
  })

  it('rechaza respuestas HTTP fallidas de sesión', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ detail: 'Cuenta inactiva' }) })
    const { getMe } = await import('./index')
    await expect(getMe()).rejects.toMatchObject({ status: 403, message: 'Cuenta inactiva' })
  })

  it('should retry on 5xx errors', async () => {
    mockFetch
      .mockResolvedValueOnce({ status: 503, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ total: 0, procesos: [] }),
      })

    const { getProcesos } = await import('./index')
    await getProcesos()

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('postAddRadicado', () => {
  it('no repite automáticamente una escritura si falla la conexión', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    const { postAddRadicado } = await import('./index')
    await expect(postAddRadicado({ llave_proceso: '123' })).rejects.toThrow('Error de conexión')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
  it('should POST and return created response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ created: true, llave_proceso: '123' }),
    })

    const { postAddRadicado } = await import('./index')
    const result = await postAddRadicado({ llave_proceso: '123', despacho: 'Juzgado' })

    expect(result.created).toBe(true)
    expect(result.llave_proceso).toBe('123')
  })

  it('should return error object on non-ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: 'Ya existe' }),
    })

    const { postAddRadicado } = await import('./index')
    const result = await postAddRadicado({ llave_proceso: '123' })

    expect(result.created).toBe(false)
    expect(result.detail).toBe('Ya existe')
  })
})

describe('deleteProceso', () => {
  it('should DELETE and return JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ deleted: true, llave_proceso: '123' }),
    })

    const { deleteProceso } = await import('./index')
    const result = await deleteProceso('123')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/procesos/123'),
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(result.deleted).toBe(true)
  })

  it('should throw on error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: 'No encontrado' }),
    })

    const { deleteProceso } = await import('./index')
    await expect(deleteProceso('999')).rejects.toThrow('No encontrado')
  })
})
