type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void

type ErrorUtilsShape = {
  getGlobalHandler?: () => GlobalErrorHandler
  setGlobalHandler?: (handler: GlobalErrorHandler) => void
}

if (__DEV__) {
  try {
    // Access ErrorUtils without writing to globalThis — Hermes seals the global object.
    const globalObject = globalThis as typeof globalThis & {
      ErrorUtils?: ErrorUtilsShape
    }
    const errorUtils = globalObject.ErrorUtils
    const originalHandler = errorUtils?.getGlobalHandler?.()

    errorUtils?.setGlobalHandler?.((error, isFatal) => {
      try {
        const message = error instanceof Error ? error.message : String(error)
        const stack = error instanceof Error ? error.stack ?? '(no stack)' : '(no stack)'
        console.error('[GlobalErrorHandler] fatal:', Boolean(isFatal))
        console.error('[GlobalErrorHandler] message:', message)
        console.error('[GlobalErrorHandler] stack:', stack)
      } catch {
        // Never throw from inside the global error handler.
      }
      originalHandler?.(error, isFatal)
    })
  } catch {
    // Diagnostic code must never crash the app.
  }
}
