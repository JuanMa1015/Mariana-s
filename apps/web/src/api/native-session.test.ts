import { afterEach, expect, it, vi } from 'vitest'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}))

afterEach(() => vi.unstubAllGlobals())

it('descarta el token legado, guarda el nuevo y lo borra aunque falle el cierre remoto', async () => {
  localStorage.setItem('mariana_token', 'legado')
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const { getMe, loginUser, logoutUser } = await import('./index')
  expect(localStorage.getItem('mariana_token')).toBeNull()

  fetch.mockResolvedValueOnce(Response.json({ access_token: 'nuevo' }))
  await loginUser({ credential: 'usuario', password: 'clave' })
  expect(SecureStorage.set).toHaveBeenCalledWith('mariana_token', 'nuevo', false, false)
  expect(localStorage.getItem('mariana_token')).toBeNull()

  vi.mocked(SecureStorage.get).mockResolvedValue('nuevo')
  fetch.mockResolvedValueOnce(Response.json({ username: 'usuario' }))
  await getMe()
  expect(fetch.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer nuevo')

  fetch.mockResolvedValueOnce(new Response('respuesta inválida'))
  await expect(logoutUser()).rejects.toThrow()
  expect(SecureStorage.remove).toHaveBeenCalledWith('mariana_token', false)
})
