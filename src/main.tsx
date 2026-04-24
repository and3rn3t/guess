import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { ThemeProvider } from "next-themes";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

if (isAdmin) {
  // Lazy-load the admin bundle to keep the main app chunk small
  const { AdminApp } = await import('./components/admin/AdminApp.tsx')
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider attribute="class" defaultTheme="dark" themes={["dark", "light"]}>
        <AdminApp />
      </ThemeProvider>
    </ErrorBoundary>
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider attribute="class" defaultTheme="dark" themes={["dark", "light"]}>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  )
}
