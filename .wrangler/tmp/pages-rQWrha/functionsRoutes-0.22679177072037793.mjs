import { onRequestGet as __api_characters_ts_onRequestGet } from "/Users/andernet/Documents/GitHub/guess/functions/api/characters.ts"
import { onRequestPost as __api_characters_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/characters.ts"
import { onRequestGet as __api_corrections_ts_onRequestGet } from "/Users/andernet/Documents/GitHub/guess/functions/api/corrections.ts"
import { onRequestPost as __api_corrections_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/corrections.ts"
import { onRequestPost as __api_llm_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/llm.ts"
import { onRequestPost as __api_llm_stream_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/llm-stream.ts"
import { onRequestGet as __api_questions_ts_onRequestGet } from "/Users/andernet/Documents/GitHub/guess/functions/api/questions.ts"
import { onRequestPost as __api_questions_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/questions.ts"
import { onRequestGet as __api_stats_ts_onRequestGet } from "/Users/andernet/Documents/GitHub/guess/functions/api/stats.ts"
import { onRequestPost as __api_stats_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/stats.ts"
import { onRequestGet as __api_sync_ts_onRequestGet } from "/Users/andernet/Documents/GitHub/guess/functions/api/sync.ts"
import { onRequestPost as __api_sync_ts_onRequestPost } from "/Users/andernet/Documents/GitHub/guess/functions/api/sync.ts"

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
      routePath: "/api/corrections",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_corrections_ts_onRequestGet],
    },
  {
      routePath: "/api/corrections",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_corrections_ts_onRequestPost],
    },
  {
      routePath: "/api/llm",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_llm_ts_onRequestPost],
    },
  {
      routePath: "/api/llm-stream",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_llm_stream_ts_onRequestPost],
    },
  {
      routePath: "/api/questions",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_questions_ts_onRequestGet],
    },
  {
      routePath: "/api/questions",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_questions_ts_onRequestPost],
    },
  {
      routePath: "/api/stats",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_stats_ts_onRequestGet],
    },
  {
      routePath: "/api/stats",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_stats_ts_onRequestPost],
    },
  {
      routePath: "/api/sync",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_sync_ts_onRequestGet],
    },
  {
      routePath: "/api/sync",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sync_ts_onRequestPost],
    },
  ]