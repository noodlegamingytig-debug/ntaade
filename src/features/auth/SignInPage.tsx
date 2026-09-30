import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ASHESI_DOMAIN } from '../../lib/ashesiEmail'
import { useNow } from '../../hooks/useNow'

const RESEND_SECONDS = 60

export function SignInPage() {
  const { user, requestCode, verifyCode } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const rawNext = params.get('next') ?? '/'
  const next = rawNext.startsWith('/') ? rawNext : '/'

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentAt, setSentAt] = useState(0)
  const now = useNow(1000)
  const cooldown = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000))

  useEffect(() => {
    document.title = 'Sign in · Ntaade'
  }, [])

  if (user) return <Navigate to={next} replace />

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    const err = await requestCode(email)
    setBusy(false)
    if (err) return setError(err)
    setSentAt(Date.now())
    setStep('code')
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await verifyCode(email, code)
    setBusy(false)
    if (err) return setError(err)
    navigate(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-10">
      <h1 className="text-xl font-semibold text-brand-gray-900">Sign in to Ntaade</h1>
      <p className="mt-1 text-sm text-brand-gray-500">
        Browsing is open to everyone. You only need to sign in to check out.
      </p>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-brand-gray-700" htmlFor="email">
            Your Ashesi email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder={`you${ASHESI_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-brand-gray-300 px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          {error && <p role="alert" className="text-sm text-brand-red-dark">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brand-red py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="mt-6 space-y-3">
          <p className="text-sm text-brand-gray-700">
            We sent a code to <strong>{email.trim().toLowerCase()}</strong>. Enter it below.
          </p>
          <input
            aria-label="Sign-in code"
            type="text"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6,10}"
            maxLength={10}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border border-brand-gray-300 px-3 py-2.5 text-center text-lg tracking-[0.3em] focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
          {error && <p role="alert" className="text-sm text-brand-red-dark">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length < 6}
            className="w-full rounded-full bg-brand-red py-2.5 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError(null) }} className="text-brand-gray-500 hover:underline">
              Use a different email
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={() => sendCode()}
              className="font-medium text-brand-red hover:underline disabled:text-brand-gray-400 disabled:no-underline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
