import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function Bomba() {
  throw new Error("Algo explotó")
}

it("debe mostrar el mensaje de error cuando un child lanza error", () => {
  const original = console.error
  console.error = vi.fn()

  render(
    <ErrorBoundary>
      <Bomba />
    </ErrorBoundary>,
  )

  expect(screen.getByText("Algo salió mal")).toBeTruthy()
  expect(screen.getByText("Ocurrió un error inesperado. Por favor intenta recargar la página.")).toBeTruthy()
  expect(screen.getByText("Recargar página")).toBeTruthy()
  expect(screen.queryByText("Algo explotó")).toBeNull()

  console.error = original
})

it("debe renderizar los children si no hay error", () => {
  render(
    <ErrorBoundary>
      <p>Todo bien</p>
    </ErrorBoundary>,
  )

  expect(screen.getByText("Todo bien")).toBeTruthy()
})
