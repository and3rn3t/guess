import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { ThemeProvider } from "next-themes";

import App from './App.tsx'
import { AboutPage } from './components/static/AboutPage.tsx'
import { CreditsPage } from './components/static/CreditsPage.tsx'

// Catch async errors that bypass ErrorBoundary (event handlers, setTimeout, etc.)
globalThis.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.error('Unhandled promise rejection:', event.reason)
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason)
  const stack = event.reason instanceof Error ? event.reason.stack : undefined
  void import('@/lib/analytics').then((m) => {
    m.trackUncaughtError(`Unhandled rejection: ${message}`, stack)
    m.flushEvents()
  })
})
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"

const isAdmin = globalThis.location.pathname === '/admin' || globalThis.location.pathname.startsWith('/admin/')
const isAbout = globalThis.location.pathname === '/about'
const isCredits = globalThis.location.pathname === '/credits'

if (isAdmin) {
  // Lazy-load the admin bundle to keep the main app chunk small
  const { AdminApp } = await import('./components/admin/AdminApp.tsx')
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider attribute="class" defaultTheme="system" themes={["dark", "light", "system"]} enableSystem>
        <AdminApp />
      </ThemeProvider>
    </ErrorBoundary>
  )
} else if (isAbout) {
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider attribute="class" defaultTheme="system" themes={["dark", "light", "system"]} enableSystem>
        <AboutPage />
      </ThemeProvider>
    </ErrorBoundary>
  )
} else if (isCredits) {
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider attribute="class" defaultTheme="system" themes={["dark", "light", "system"]} enableSystem>
        <CreditsPage />
      </ThemeProvider>
    </ErrorBoundary>
  )
} else {
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ThemeProvider attribute="class" defaultTheme="system" themes={["dark", "light", "system"]} enableSystem>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  )
}
