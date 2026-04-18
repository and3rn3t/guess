/// <reference types="vite/client" />

declare module "lucide-react/dist/esm/icons/*" {
  import type { ForwardRefExoticComponent, RefAttributes } from "react";
  const icon: ForwardRefExoticComponent<
    Record<string, unknown> & RefAttributes<SVGSVGElement>
  >;
  export default icon;
}