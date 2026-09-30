import { Link } from 'react-router-dom'

/** Text wordmark for now — swap in a real logo image here later without
 * touching anything that renders <Logo />. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`text-xl font-extrabold tracking-tight text-brand-red ${className}`}>
      Ntaade
    </Link>
  )
}
