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
import { AdminLayout } from './features/admin/AdminLayout'
import { AdminOverviewPage } from './features/admin/AdminOverviewPage'
import { RequireAdmin } from './features/admin/RequireAdmin'
import { BatchesAdminPage } from './features/admin/batches/BatchesAdminPage'
import { PickupListPage } from './features/admin/batches/PickupListPage'
import { CategoriesAdminPage } from './features/admin/categories/CategoriesAdminPage'
import { ItemEditPage } from './features/admin/items/ItemEditPage'
import { ItemsAdminPage } from './features/admin/items/ItemsAdminPage'
import { OrdersAdminPage } from './features/admin/orders/OrdersAdminPage'
import { PromotionsAdminPage } from './features/admin/promotions/PromotionsAdminPage'
import { SettingsAdminPage } from './features/admin/settings/SettingsAdminPage'

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
                <Route path="admin" element={<RequireAdmin />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<AdminOverviewPage />} />
                    <Route path="orders" element={<OrdersAdminPage />} />
                    <Route path="items" element={<ItemsAdminPage />} />
                    <Route path="items/new" element={<ItemEditPage />} />
                    <Route path="items/:id" element={<ItemEditPage />} />
                    <Route path="batches" element={<BatchesAdminPage />} />
                    <Route path="batches/:id/pickup" element={<PickupListPage />} />
                    <Route path="categories" element={<CategoriesAdminPage />} />
                    <Route path="promotions" element={<PromotionsAdminPage />} />
                    <Route path="settings" element={<SettingsAdminPage />} />
                  </Route>
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
