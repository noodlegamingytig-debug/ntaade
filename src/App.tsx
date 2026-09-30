import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { NotFoundPage } from './components/ui/NotFoundPage'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './features/auth/AuthProvider'
import { RequireAuth } from './features/auth/RequireAuth'
import { SignInPage } from './features/auth/SignInPage'
import { CartPage } from './features/cart/CartPage'
import { CartProvider } from './features/cart/CartProvider'
import { CatalogPage } from './features/catalog/CatalogPage'
import { CheckoutPage } from './features/checkout/CheckoutPage'
import { OrderPage } from './features/orders/OrderPage'
import { OrdersPage } from './features/orders/OrdersPage'
import { ProductPage } from './features/product/ProductPage'

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<CatalogPage />} />
                <Route path="product/:id" element={<ProductPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="signin" element={<SignInPage />} />
                <Route element={<RequireAuth />}>
                  <Route path="checkout" element={<CheckoutPage />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="order/:id" element={<OrderPage />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </HashRouter>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
