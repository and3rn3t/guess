import { onRequestPost as __api_llm_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/llm.ts"

export const routes = [
    {
      routePath: "/api/llm",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_llm_ts_onRequestPost],
    },
  ]