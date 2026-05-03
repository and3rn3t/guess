#!/usr/bin/env zsh
# scripts/aliases.sh — Guess project shell aliases
#
# Usage (one-time setup):
#   echo "source $(pwd)/scripts/aliases.sh" >> ~/.zshrc && source ~/.zshrc
#
# Or just for the current session:
#   source scripts/aliases.sh

GUESS_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"

# ── Dev servers ───────────────────────────────────────────────────────────────
alias gdev="cd $GUESS_DIR && pnpm dev"           # Vite dev server (localhost:5000)
alias gcfdev="cd $GUESS_DIR && pnpm cf:dev"      # Dev with Cloudflare bindings (KV, D1, R2)

# ── Validation & builds ───────────────────────────────────────────────────────
alias gval="cd $GUESS_DIR && pnpm validate"      # Type-check + lint + test (run after every change)
alias gbuild="cd $GUESS_DIR && pnpm build"       # Full production build

# ── Tests ─────────────────────────────────────────────────────────────────────
alias gtest="cd $GUESS_DIR && pnpm test:watch"   # Vitest in watch mode

# ── Database ──────────────────────────────────────────────────────────────────
alias gmigratenew="cd $GUESS_DIR && pnpm migrate:create"  # Scaffold a new migration

# ── Utilities ─────────────────────────────────────────────────────────────────
alias gdoctor="cd $GUESS_DIR && pnpm doctor"     # Environment health check
alias gtail="cd $GUESS_DIR && pnpm tail"         # Pretty-print wrangler tail (preview by default)

# ── Print summary ─────────────────────────────────────────────────────────────
echo "🎮 guess aliases loaded:"
echo "  gdev        pnpm dev (localhost:5000)"
echo "  gcfdev      pnpm cf:dev (with CF bindings)"
echo "  gval        pnpm validate"
echo "  gbuild      pnpm build"
echo "  gtest       pnpm test:watch"
echo "  gmigratenew pnpm migrate:create"
echo "  gdoctor     pnpm doctor"
echo "  gtail       pnpm tail [--env=production] [--filter=...]"
