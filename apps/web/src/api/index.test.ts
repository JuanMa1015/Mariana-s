import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('loginUser', () => {
  it('should POST credentials and return JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'abc', email: 'test@example.com' }),
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
    expect(result.access_token).toBe('abc')
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
      json: () => Promise.resolve({ access_token: 'abc', email: 'new@example.com' }),
    })

    const { registerUser } = await import('./index')
    const result = await registerUser({ email: 'new@example.com', password: 'pass' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.access_token).toBe('abc')
  })
})

describe('fetchWithAuth (via getProcesos)', () => {
  it('should add Bearer token from localStorage', async () => {
    localStorage.setItem('token', 'my-token')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ total: 0, procesos: [] }),
    })

    const { getProcesos } = await import('./index')
    await getProcesos()

    const call = mockFetch.mock.calls[0]
    const headers = call[1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer my-token')
  })

  it('should remove token and redirect on 401', async () => {
    localStorage.setItem('token', 'bad-token')
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
    })

    mockFetch.mockResolvedValueOnce({
      status: 401,
      json: () => Promise.resolve({ detail: 'Unauthorized' }),
    })

    const { getProcesos } = await import('./index')
    await expect(getProcesos()).rejects.toThrow('Unauthorized')
    expect(localStorage.getItem('token')).toBeNull()
    expect(window.location.href).toBe('/login')
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
