#!/usr/bin/env tsx
/**
 * pnpm tail — pretty-print wrangler Pages deployment tail
 *
 * Wraps `wrangler pages deployment tail guess` with colored output,
 * optional filtering, and header redaction.
 *
 * Usage:
 *   pnpm tail                          # tail preview environment
 *   pnpm tail --env=production         # tail production
 *   pnpm tail --filter=status>=400     # only show error responses
 *   pnpm tail --filter=path~/api/v2    # only show matching paths (regex)
 *   pnpm tail --env=production --filter=status>=500
 *
 * Note: `wrangler tail` only works for standalone Workers.
 * Pages Functions must use `wrangler pages deployment tail`.
 */
import { spawn } from 'node:child_process'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

const envArg = args.find((a) => a.startsWith('--env='))
const env: 'production' | 'preview' = envArg?.includes('production') ? 'production' : 'preview'

const filterArg = args.find((a) => a.startsWith('--filter='))
const filterStr = filterArg?.replace('--filter=', '') ?? null

interface Filter {
  kind: 'status' | 'path'
  op: '>=' | '<=' | '==' | '~'
  value: string | number
}

function parseFilter(raw: string): Filter | null {
  const statusMatch = raw.match(/^status(>=|<=|==)(\d+)$/)
  if (statusMatch) return { kind: 'status', op: statusMatch[1] as Filter['op'], value: parseInt(statusMatch[2], 10) }
  const pathMatch = raw.match(/^path~(.+)$/)
  if (pathMatch) return { kind: 'path', op: '~', value: pathMatch[1] }
  return null
}

const filter = filterStr ? parseFilter(filterStr) : null
if (filterStr && !filter) {
  console.error(`Invalid --filter value: "${filterStr}"`)
  console.error('Examples: --filter=status>=400  --filter=path~/api/v2')
  process.exit(1)
}

// ── Colors ────────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'

function colorStatus(status: number): string {
  if (status < 300) return `${GREEN}${status}${RESET}`
  if (status < 400) return `${CYAN}${status}${RESET}`
  if (status < 500) return `${YELLOW}${status}${RESET}`
  return `${RED}${BOLD}${status}${RESET}`
}

function colorMethod(method: string): string {
  const colors: Record<string, string> = {
    GET: GREEN,
    POST: CYAN,
    PUT: YELLOW,
    PATCH: YELLOW,
    DELETE: RED,
  }
  return `${colors[method] ?? MAGENTA}${method}${RESET}`
}

// ── Event types ───────────────────────────────────────────────────────────────

interface WranglerTailEvent {
  event?: {
    request?: {
      method?: string
      url?: string
      headers?: Record<string, string>
    }
    response?: {
      status?: number
    }
  }
  eventTimestamp?: number
  outcome?: string
  cpuTime?: number
  exceptions?: Array<{ name: string; message: string }>
  logs?: Array<{ message: string[] }>
}

// ── Filtering ─────────────────────────────────────────────────────────────────

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function shouldShow(ev: WranglerTailEvent): boolean {
  if (!filter) return true
  const status = ev.event?.response?.status ?? 0
  const url = ev.event?.request?.url ?? ''
  const path = (() => {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  })()

  if (filter.kind === 'status') {
    const threshold = filter.value as number
    if (filter.op === '>=') return status >= threshold
    if (filter.op === '<=') return status <= threshold
    if (filter.op === '==') return status === threshold
  }
  if (filter.kind === 'path') {
    try {
      return new RegExp(filter.value as string).test(path)
    } catch {
      return path.includes(filter.value as string)
    }
  }
  return true
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderEvent(ev: WranglerTailEvent): void {
  const req = ev.event?.request
  const res = ev.event?.response
  if (!req) return

  const ts = ev.eventTimestamp
    ? new Date(ev.eventTimestamp).toISOString().replace('T', ' ').slice(0, 23)
    : new Date().toISOString().replace('T', ' ').slice(0, 23)

  const method = req.method ?? 'GET'
  let path = req.url ?? '/'
  try {
    path = new URL(req.url ?? '').pathname
  } catch {
    // keep raw url
  }
  const status = res?.status ?? 0
  const cpu = ev.cpuTime != null ? ` ${DIM}${ev.cpuTime}ms${RESET}` : ''
  const outcome =
    ev.outcome && ev.outcome !== 'ok' ? ` ${YELLOW}[${ev.outcome}]${RESET}` : ''

  console.log(
    `${DIM}${ts}${RESET}  ${colorMethod(method)} ${BOLD}${path}${RESET}  ${colorStatus(status)}${cpu}${outcome}`,
  )

  // Print exceptions inline
  if (ev.exceptions?.length) {
    for (const ex of ev.exceptions) {
      console.log(`  ${RED}↳ ${ex.name}: ${ex.message}${RESET}`)
    }
  }
}

// ── Spawn wrangler ────────────────────────────────────────────────────────────

const projectName = 'guess'
const wranglerArgs = ['pages', 'deployment', 'tail', projectName, '--format=json', `--env=${env}`]

console.log(
  `${BOLD}guess tail${RESET}  env=${CYAN}${env}${RESET}${filter ? `  filter=${MAGENTA}${filterStr}${RESET}` : ''}`,
)
console.log(`${DIM}wrangler ${wranglerArgs.join(' ')}${RESET}\n`)

const proc = spawn('wrangler', wranglerArgs, {
  stdio: ['inherit', 'pipe', 'inherit'],
})

let buffer = ''

proc.stdout.on('data', (chunk: Buffer) => {
  buffer += chunk.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const ev = JSON.parse(trimmed) as WranglerTailEvent
      if (shouldShow(ev)) renderEvent(ev)
    } catch {
      // Non-JSON lines (wrangler startup messages) — print as-is
      if (!trimmed.startsWith('{')) {
        console.log(`${DIM}${trimmed}${RESET}`)
      }
    }
  }
})

proc.on('exit', (code) => {
  process.exit(code ?? 0)
})

process.on('SIGINT', () => {
  proc.kill('SIGINT')
})
