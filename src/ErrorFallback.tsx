import { useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";

import { AlertTriangleIcon, RefreshCwIcon, HomeIcon } from "lucide-react";

interface ErrorFallbackProps {
  error: unknown;
  resetErrorBoundary: () => void;
}

export const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
  const isDev = import.meta.env.DEV;

  // Hooks must run on every render to satisfy the Rules of Hooks. The DEV
  // rethrow happens *after* the hook is registered, so the order is stable
  // across DEV and production.
  useEffect(() => {
    if (isDev) return;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    void import("@/lib/analytics").then((m) => m.trackUncaughtError(message, stack));
  }, [error, isDev]);

  // When encountering an error in the development mode, rethrow it and don't display the boundary.
  // The parent UI will take care of showing a more helpful dialog.
  if (isDev) throw error;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangleIcon />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            The game encountered an unexpected error. You can try again or return to the home screen.
          </AlertDescription>
        </Alert>
        
        <div className="bg-card border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">Error Details:</h3>
          <pre className="text-xs text-destructive bg-muted/50 p-3 rounded border overflow-auto max-h-32">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </div>
        
        <div className="flex gap-3">
          <Button 
            onClick={resetErrorBoundary} 
            className="flex-1"
            variant="outline"
          >
            <RefreshCwIcon />
            Try Again
          </Button>
          <Button
            onClick={() => window.location.replace('/')}
            className="flex-1"
            variant="default"
          >
            <HomeIcon />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
