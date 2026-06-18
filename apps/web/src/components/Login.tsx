import { useState, useEffect } from "react"
import { loginUser } from "../api"
import { Link, useNavigate } from "react-router-dom"
import toast from "react-hot-toast"

export default function Login() {
  const [credential, setCredential] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const remembered = localStorage.getItem("rememberedEmail")
    if (remembered) {
      setCredential(remembered)
      setRememberMe(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const loadingToast = toast.loading("Iniciando sesión...")
    try {
      const data = await loginUser({ credential, password })
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("email", data.email)
      if (data.username) localStorage.setItem("username", data.username)
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", credential)
      } else {
        localStorage.removeItem("rememberedEmail")
      }
      toast.success("¡Bienvenido!", { id: loadingToast })
      navigate("/")
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-slate-900 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Mariana's</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">Iniciar Sesión</h1>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1 block">Correo o Usuario</label>
            <input
              type="text"
              required
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              placeholder="ej: paulacorreaq"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1 block">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-violet-200 bg-violet-50/30 pl-4 pr-12 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-violet-300 hover:text-violet-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded text-violet-500"
            />
            <label htmlFor="remember" className="text-sm text-slate-600">Recordarme</label>
          </div>
          <button type="submit" className="mt-2 w-full rounded-2xl border border-violet-300 bg-violet-400 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-95">
            Ingresar
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          ¿No tienes cuenta? <Link to="/register" className="font-semibold text-violet-500 hover:underline">Regístrate</Link>
        </p>
      </div>
    </div>
  )
}
