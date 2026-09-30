import { AccountMenu } from './AccountMenu'
import { CartIcon } from './CartIcon'
import { Logo } from './Logo'
import { SearchBar } from './SearchBar'

interface HeaderProps {
  searchValue: string
  onSearch: (value: string) => void
}

export function Header({ searchValue, onSearch }: HeaderProps) {
  return (
    <header className="print:hidden sticky top-0 z-20 border-b border-brand-gray-200 bg-white">
      {/* Desktop: wordmark, search, account, cart all in one row.
          Mobile: wordmark/account/cart on top, search bar on its own row below. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap">
        <Logo />
        <div className="order-3 w-full sm:order-none sm:mx-4 sm:max-w-md sm:flex-1">
          <SearchBar value={searchValue} onSearch={onSearch} />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <AccountMenu />
          <CartIcon />
        </div>
      </div>
    </header>
  )
}
