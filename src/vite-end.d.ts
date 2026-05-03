/// <reference types="vite/client" />

declare module "lucide-react/dist/esm/icons/*" {
  import type { ForwardRefExoticComponent, RefAttributes } from "react";
  const icon: ForwardRefExoticComponent<
    Record<string, unknown> & RefAttributes<SVGSVGElement>
  >;
  export default icon;
}

declare module "swagger-ui-dist" {
  export interface SwaggerUiOptions {
    spec?: Record<string, unknown>;
    domNode?: Element | null;
    deepLinking?: boolean;
    displayRequestDuration?: boolean;
  }

  export interface SwaggerUiInstance {
    destroy?: () => void;
  }

  export function SwaggerUIBundle(options: SwaggerUiOptions): SwaggerUiInstance;
}