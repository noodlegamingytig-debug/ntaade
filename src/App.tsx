import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { NotFoundPage } from './components/ui/NotFoundPage'
import { ToastProvider } from './components/ui/Toast'
import { CatalogPage } from './features/catalog/CatalogPage'
import { ProductPage } from './features/product/ProductPage'

function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<CatalogPage />} />
            <Route path="product/:id" element={<ProductPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  )
}

export default App
