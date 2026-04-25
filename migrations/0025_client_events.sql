-- AN.5: Client-side event pipeline.
-- Stores batched events flushed from the client (localStorage → POST /api/v2/events).
-- Used for funnel analysis, skip rates, and feature usage without requiring auth.

CREATE TABLE IF NOT EXISTS client_events (
  id           TEXT    PRIMARY KEY,            -- client-generated UUID (idempotency)
  session_id   TEXT,                           -- game session ID (nullable — may fire pre-game)
  user_id      TEXT,                           -- cookie-based user ID (from X-User-Id header)
  event_type   TEXT    NOT NULL,               -- 'game_start' | 'game_end' | 'share' | etc.
  data         TEXT,                           -- JSON blob of event-specific fields (≤ 4KB)
  client_ts    INTEGER,                        -- client timestamp (ms since epoch)
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_client_events_type_time ON client_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_events_user      ON client_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_events_session   ON client_events(session_id) WHERE session_id IS NOT NULL;
