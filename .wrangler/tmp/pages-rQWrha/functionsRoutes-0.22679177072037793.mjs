import { onRequestGet as __api_characters_ts_onRequestGet } from "/Users/andernet/Documents/GitHub/guess/functions/api/characters.ts"
import { onRequestPost as __api_characters_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/characters.ts"
import { onRequestPost as __api_llm_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/llm.ts"

export const routes = [
    {
      routePath: "/api/characters",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_characters_ts_onRequestGet],
    },
  {
      routePath: "/api/characters",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_characters_ts_onRequestPost],
    },
  {
      routePath: "/api/llm",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_llm_ts_onRequestPost],
    },
  ]