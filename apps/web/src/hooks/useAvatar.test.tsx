import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { bajarAvatar } from "../api"
import { limpiarAvatar, recargarAvatar, useAvatar } from "./useAvatar"

vi.mock("../api", () => ({ bajarAvatar: vi.fn() }))
beforeEach(() => { vi.resetAllMocks(); limpiarAvatar() })

it("descarta la foto de la cuenta anterior si llega después de cambiar de sesión", async () => {
  let terminar!: (foto: string) => void
  vi.mocked(bajarAvatar).mockReturnValueOnce(new Promise((resolve) => { terminar = resolve }))
    .mockResolvedValueOnce("data:image/png;base64,nueva")
  const anterior = renderHook(() => useAvatar())
  anterior.unmount()
  act(() => limpiarAvatar())
  const nueva = renderHook(() => useAvatar())
  await waitFor(() => expect(nueva.result.current).toBe("data:image/png;base64,nueva"))
  await act(async () => terminar("data:image/png;base64,anterior"))
  expect(nueva.result.current).toBe("data:image/png;base64,nueva")
})

it("retira la foto visible si su recarga falla", async () => {
  vi.mocked(bajarAvatar).mockResolvedValueOnce("data:image/png;base64,foto")
  const avatar = renderHook(() => useAvatar())
  await waitFor(() => expect(avatar.result.current).not.toBeNull())
  vi.mocked(bajarAvatar).mockRejectedValueOnce(new Error("sin conexión"))
  await act(() => recargarAvatar())
  expect(avatar.result.current).toBeNull()
})
