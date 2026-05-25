import * as fs from "fs";
import * as readline from "readline";

// ── Types mirrored from engine.ts ─────────────────────────────────────────────

export interface SimQuestionStep {
  attribute: string;
  answer: "yes" | "no" | "maybe" | "unknown";
  infoGain: number;
}

export interface SimGameResult {
  runId: string;
  targetCharacterId: string;
  targetCharacterName: string;
  targetCharacterCategory?: string | null;
  won: boolean;
  questionsAsked: number;
  guessesUsed: number;
  guessTrigger: string | null;
  forcedGuess: boolean;
  confidenceAtGuess: number | null;
  entropyAtGuess: number | null;
  gapAtGuess: number | null;
  aliveCountAtGuess: number | null;
  secondBestCharacterId: string | null;
  secondBestCharacterName: string | null;
  secondBestProbability: number | null;
  questionsSequence: SimQuestionStep[];
  answerDistribution: Record<"yes" | "no" | "maybe" | "unknown", number>;
  characterPoolSize: number;
  maxQuestions: number;
  difficulty: string;
  createdAt: number;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function pct(n: number, total: number): string {
  return total === 0 ? "—" : `${((n / total) * 100).toFixed(1)}%`;
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export function p90(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.9)];
}

export function bar(n: number, total: number, width = 30): string {
  const fill = total === 0 ? 0 : Math.round((n / total) * width);
  return "█".repeat(fill) + "░".repeat(width - fill);
}

export function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

export function section(title: string): void {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ${title}`);
  console.log("═".repeat(70));
}

export function subsection(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 65 - title.length))}`);
}

// ── Load JSONL ────────────────────────────────────────────────────────────────

export async function loadResults(filePath: string): Promise<SimGameResult[]> {
  const results: SimGameResult[] = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) {
      try {
        results.push(JSON.parse(trimmed) as SimGameResult);
      } catch {
        // skip malformed lines
      }
    }
  }
  return results;
}
