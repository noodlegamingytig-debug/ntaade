import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const onCatalogPage = location.pathname === '/'
  const searchValue = onCatalogPage ? (searchParams.get('q') ?? '') : ''

  function handleSearch(value: string) {
    if (onCatalogPage) {
      const next = new URLSearchParams(searchParams)
      if (value) next.set('q', value)
      else next.delete('q')
      navigate({ pathname: '/', search: next.toString() }, { replace: true })
    } else {
      navigate(value ? `/?q=${encodeURIComponent(value)}` : '/')
    }
  }

  return (
    <div className="min-h-svh bg-white">
      <Header searchValue={searchValue} onSearch={handleSearch} />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
