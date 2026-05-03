#!/usr/bin/env tsx
/**
 * Runs network/credential-dependent validation checks when env vars are present.
 * Missing credentials cause a check to be skipped, not failed.
 */
import { spawnSync } from 'node:child_process';

type OnlineCheck = {
  name: string;
  command: string;
  args: string[];
  requiredEnv: string[];
};

const checks: OnlineCheck[] = [
  {
    name: 'D1 migration dry-run (preview)',
    command: 'pnpm',
    args: ['migrate:dry-run:preview'],
    requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
  },
  {
    name: 'Vision validation (LLM)',
    command: 'pnpm',
    args: ['vision:validate'],
    requiredEnv: ['OPENAI_API_KEY'],
  },
];

function hasRequiredEnv(keys: string[]): boolean {
  return keys.every((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function runCheck(check: OnlineCheck): void {
  console.log(`\n[online] Running: ${check.name}`);
  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(`[online] ${check.name} failed to start: ${result.error.message}`);
    process.exit(1);
  }
}

function main(): void {
  console.log('Online validation checks');
  console.log('────────────────────────');

  let ran = 0;

  for (const check of checks) {
    if (!hasRequiredEnv(check.requiredEnv)) {
      console.log(
        `[online] Skipping: ${check.name} (missing env: ${check.requiredEnv.join(', ')})`,
      );
      continue;
    }

    ran += 1;
    runCheck(check);
  }

  if (ran === 0) {
    console.log('\n[online] No checks ran (no required credentials found).');
    return;
  }

  console.log(`\n[online] Completed ${ran} online check(s).`);
}

main();
