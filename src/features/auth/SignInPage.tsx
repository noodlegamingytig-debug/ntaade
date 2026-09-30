import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ASHESI_DOMAIN } from '../../lib/ashesiEmail'

const inputCls =
  'w-full rounded-lg border border-brand-gray-300 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red'

export function SignInPage() {
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rawNext = params.get('next') ?? '/'
  const next = rawNext.startsWith('/') ? rawNext : '/'
  const creating = params.get('mode') === 'signup'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = `${creating ? 'Create account' : 'Sign in'} · Ntaade`
  }, [creating])

  if (user) return <Navigate to={next} replace />

  function switchMode() {
    const nextParams = new URLSearchParams(params)
    if (creating) nextParams.delete('mode')
    else nextParams.set('mode', 'signup')
    setParams(nextParams, { replace: true })
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = creating ? await signUp(email, password) : await signIn(email, password)
    setBusy(false)
    if (err) return setError(err)
    navigate(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-xl font-semibold text-brand-gray-900">
        {creating ? 'Create your Ntaade account' : 'Sign in to Ntaade'}
      </h1>
      <p className="mt-1 text-sm text-brand-gray-500">
        Browsing is open to everyone. You only need an account to check out.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm font-medium text-brand-gray-700">
          Your Ashesi email
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder={`you${ASHESI_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputCls} mt-1 font-normal`}
          />
        </label>
        <label className="block text-sm font-medium text-brand-gray-700">
          Password
          <input
            type="password"
            required
            minLength={creating ? 8 : undefined}
            autoComplete={creating ? 'new-password' : 'current-password'}
            placeholder={creating ? 'At least 8 characters' : ''}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} mt-1 font-normal`}
          />
        </label>
        {error && <p role="alert" className="text-sm text-brand-red-dark">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand-red py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60"
        >
          {busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-brand-gray-600">
        {creating ? 'Already have an account?' : 'New here?'}{' '}
        <button type="button" onClick={switchMode} className="font-medium text-brand-red hover:underline">
          {creating ? 'Sign in' : 'Create an account'}
        </button>
      </p>
      <p className="mt-2 text-center text-xs text-brand-gray-400">
        Forgot your password? Message us and we'll reset it for you.
      </p>
    </div>
  )
}
