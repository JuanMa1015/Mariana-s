import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Login from './Login'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual as any, useNavigate: () => mockNavigate }
})

const mockLoginUser = vi.fn()
vi.mock('../api', () => ({ loginUser: (...args: any[]) => mockLoginUser(...args) }))

const mockToast = { loading: vi.fn(() => 'toast-id'), success: vi.fn(), error: vi.fn() }
vi.mock('react-hot-toast', () => ({
  default: { loading: (...args: any[]) => mockToast.loading(...args), success: (...args: any[]) => mockToast.success(...args), error: (...args: any[]) => mockToast.error(...args) },
}))

function renderLogin() {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

it('should render login form', () => {
  renderLogin()
  expect(screen.getByText('Mariana\'s')).toBeInTheDocument()
  expect(screen.getByText('Iniciar Sesión')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('ej: paulacorreaq')).toBeInTheDocument()
  expect(screen.getByText('Ingresar')).toBeInTheDocument()
})

it('should allow typing credentials', async () => {
  const user = userEvent.setup()
  renderLogin()

  const input = screen.getByPlaceholderText('ej: paulacorreaq')
  await user.type(input, 'test@example.com')
  expect(input).toHaveValue('test@example.com')
})

it('should toggle password visibility', async () => {
  const user = userEvent.setup()
  const { container } = renderLogin()

  const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement
  expect(passwordInput).not.toBeNull()
  expect(passwordInput.type).toBe('password')

  const toggleButton = container.querySelector('button') as HTMLButtonElement
  await user.click(toggleButton)

  expect(passwordInput.type).toBe('text')
})

it('should show remembered email on mount', () => {
  localStorage.setItem('rememberedEmail', 'remembered@test.com')
  renderLogin()

  expect(screen.getByPlaceholderText('ej: paulacorreaq')).toHaveValue('remembered@test.com')
})

it('should call loginUser on submit and navigate', async () => {
  const user = userEvent.setup()
  mockLoginUser.mockResolvedValueOnce({ access_token: 'abc', email: 'test@example.com', username: 'testuser' })

  const { container } = renderLogin()

  await user.type(screen.getByPlaceholderText('ej: paulacorreaq'), 'test@example.com')
  const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement
  await user.type(passwordInput, 'password123')
  await user.click(screen.getByText('Ingresar'))

  expect(mockLoginUser).toHaveBeenCalledWith({ credential: 'test@example.com', password: 'password123' })
  expect(localStorage.getItem('token')).toBe('abc')
  expect(mockNavigate).toHaveBeenCalledWith('/')
})

it('should show error toast on login failure', async () => {
  const user = userEvent.setup()
  mockLoginUser.mockRejectedValueOnce(new Error('Credenciales inválidas'))

  const { container } = renderLogin()

  await user.type(screen.getByPlaceholderText('ej: paulacorreaq'), 'test@example.com')
  const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement
  await user.type(passwordInput, 'wrong')
  await user.click(screen.getByText('Ingresar'))

  expect(mockToast.error).toHaveBeenCalledWith('Credenciales inválidas', expect.any(Object))
})

it('should link to register page', () => {
  renderLogin()
  const link = screen.getByText('Regístrate')
  expect(link).toBeInTheDocument()
  expect(link.closest('a')).toHaveAttribute('href', '/register')
})
