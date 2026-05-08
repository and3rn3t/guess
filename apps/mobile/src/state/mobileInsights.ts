export interface MobileHistoryStep {
  questionId?: string
  questionText: string
  attribute: string
  answer: 'yes' | 'no' | 'unknown'
}

export interface MobileHistoryEntry {
  id: string
  characterId: string
  characterName: string
  won: boolean
  timestamp: number
  difficulty: string
  totalQuestions: number
  steps: MobileHistoryStep[]
}

export interface MobileStatsByDifficulty {
  difficulty: string
  games: number
  wins: number
  winRate: number
  avgQuestions: number
}

export interface MobileGlobalStats {
  totalGames: number
  wins: number
  winRate: number
  avgQuestions: number
  byDifficulty: MobileStatsByDifficulty[]
}

export interface MobileAchievement {
  id: string
  label: string
  emoji: string
  description: string
}

export interface MobileAchievementProgress {
  achievement: MobileAchievement
  unlocked: boolean
  current: number
  target: number
  progressPct: number
  hint: string
}

export interface MobileHeatmapCell {
  id: string
  label: string
  games: number
  wins: number
  losses: number
  intensity: number
}

export interface MobileSuccessRate {
  id: string
  label: string
  games: number
  wins: number
  winRate: number
  avgQuestions: number
}

export interface MobileInsightsSnapshot {
  totalGames: number
  wins: number
  winRate: number
  avgQuestions: number
  dailyStreak: number
  achievements: MobileAchievement[]
  achievementProgress: MobileAchievementProgress[]
  heatmap: MobileHeatmapCell[]
  successRates: MobileSuccessRate[]
  recentHistory: MobileHistoryEntry[]
}

const ACHIEVEMENTS: ReadonlyArray<MobileAchievement> = [
  {
    id: 'speed-demon',
    label: 'Speed Demon',
    emoji: '⚡',
    description: 'Win in 5 or fewer questions',
  },
  {
    id: 'hot-streak',
    label: 'Hot Streak',
    emoji: '🔥',
    description: 'Win 3 days in a row',
  },
  {
    id: 'week-warrior',
    label: 'Week Warrior',
    emoji: '🗓️',
    description: 'Win 7 days in a row',
  },
  {
    id: 'persistent',
    label: 'Persistent',
    emoji: '🎮',
    description: 'Play 10 or more games',
  },
  {
    id: 'veteran',
    label: 'Veteran',
    emoji: '🏅',
    description: 'Play 50 or more games',
  },
] as const

const QUESTION_BUCKETS: ReadonlyArray<{
  id: string
  label: string
  min: number
  max: number
}> = [
  { id: 'q1-5', label: '1-5', min: 1, max: 5 },
  { id: 'q6-10', label: '6-10', min: 6, max: 10 },
  { id: 'q11-15', label: '11-15', min: 11, max: 15 },
  { id: 'q16-20', label: '16-20', min: 16, max: 20 },
  { id: 'q21+', label: '21+', min: 21, max: Number.POSITIVE_INFINITY },
] as const

export const deriveDailyStreak = (
  history: readonly MobileHistoryEntry[],
  now: number = Date.now(),
): number => {
  if (history.length === 0) {
    return 0
  }

  const winningDays = new Set<string>()
  for (const entry of history) {
    if (entry.won) {
      winningDays.add(toLocalDate(entry.timestamp))
    }
  }

  if (winningDays.size === 0) {
    return 0
  }

  const today = toLocalDate(now)
  const yesterday = toLocalDate(now - 86_400_000)
  if (!winningDays.has(today) && !winningDays.has(yesterday)) {
    return 0
  }

  let streak = 0
  let cursor = winningDays.has(today) ? today : yesterday
  while (winningDays.has(cursor)) {
    streak += 1
    cursor = toLocalDate(parseDate(cursor) - 86_400_000)
  }

  return streak
}

export const deriveAchievements = (
  history: readonly MobileHistoryEntry[],
  dailyStreak: number,
  totalGames: number,
): MobileAchievement[] => {
  const achievements: MobileAchievement[] = []

  if (history.some((entry) => entry.won && entry.totalQuestions <= 5)) {
    achievements.push(ACHIEVEMENTS[0])
  }
  if (dailyStreak >= 3) {
    achievements.push(ACHIEVEMENTS[1])
  }
  if (dailyStreak >= 7) {
    achievements.push(ACHIEVEMENTS[2])
  }
  if (totalGames >= 10) {
    achievements.push(ACHIEVEMENTS[3])
  }
  if (totalGames >= 50) {
    achievements.push(ACHIEVEMENTS[4])
  }

  return achievements
}

export const deriveAchievementProgress = (
  history: readonly MobileHistoryEntry[],
  dailyStreak: number,
  totalGames: number,
): MobileAchievementProgress[] => {
  const speedDemonWins = history.filter((entry) => entry.won && entry.totalQuestions <= 5).length

  const progress: MobileAchievementProgress[] = [
    {
      achievement: ACHIEVEMENTS[0],
      unlocked: speedDemonWins > 0,
      current: Math.min(speedDemonWins, 1),
      target: 1,
      progressPct: speedDemonWins > 0 ? 100 : 0,
      hint: speedDemonWins > 0 ? 'Unlocked' : 'Win one game in 5 questions or fewer',
    },
    {
      achievement: ACHIEVEMENTS[1],
      unlocked: dailyStreak >= 3,
      current: Math.min(dailyStreak, 3),
      target: 3,
      progressPct: Math.min(100, Math.round((Math.min(dailyStreak, 3) / 3) * 100)),
      hint: dailyStreak >= 3 ? 'Unlocked' : `${Math.max(0, 3 - dailyStreak)} more win day(s) in a row`,
    },
    {
      achievement: ACHIEVEMENTS[2],
      unlocked: dailyStreak >= 7,
      current: Math.min(dailyStreak, 7),
      target: 7,
      progressPct: Math.min(100, Math.round((Math.min(dailyStreak, 7) / 7) * 100)),
      hint: dailyStreak >= 7 ? 'Unlocked' : `${Math.max(0, 7 - dailyStreak)} more win day(s) in a row`,
    },
    {
      achievement: ACHIEVEMENTS[3],
      unlocked: totalGames >= 10,
      current: Math.min(totalGames, 10),
      target: 10,
      progressPct: Math.min(100, Math.round((Math.min(totalGames, 10) / 10) * 100)),
      hint: totalGames >= 10 ? 'Unlocked' : `${Math.max(0, 10 - totalGames)} more game(s) played`,
    },
    {
      achievement: ACHIEVEMENTS[4],
      unlocked: totalGames >= 50,
      current: Math.min(totalGames, 50),
      target: 50,
      progressPct: Math.min(100, Math.round((Math.min(totalGames, 50) / 50) * 100)),
      hint: totalGames >= 50 ? 'Unlocked' : `${Math.max(0, 50 - totalGames)} more game(s) played`,
    },
  ]

  return progress
}

export const deriveQuestionHeatmap = (
  history: readonly MobileHistoryEntry[],
): MobileHeatmapCell[] => {
  const cells = QUESTION_BUCKETS.map((bucket) => {
    const matches = history.filter(
      (entry) => entry.totalQuestions >= bucket.min && entry.totalQuestions <= bucket.max,
    )
    const wins = matches.filter((entry) => entry.won).length
    const losses = matches.length - wins
    return {
      id: bucket.id,
      label: bucket.label,
      games: matches.length,
      wins,
      losses,
      intensity: 0,
    }
  })

  const maxGames = Math.max(...cells.map((cell) => cell.games), 0)
  return cells.map((cell) => ({
    ...cell,
    intensity: maxGames === 0 ? 0 : Math.round((cell.games / maxGames) * 100),
  }))
}

export const deriveSuccessRates = (
  stats: MobileGlobalStats | null,
  history: readonly MobileHistoryEntry[],
): MobileSuccessRate[] => {
  if (stats && stats.byDifficulty.length > 0) {
    return stats.byDifficulty
      .filter((row) => row.games > 0)
      .sort((left, right) => right.games - left.games)
      .map((row) => ({
        id: row.difficulty,
        label: titleCase(row.difficulty),
        games: row.games,
        wins: row.wins,
        winRate: row.winRate,
        avgQuestions: row.avgQuestions,
      }))
  }

  const fallback = new Map<string, { games: number; wins: number; totalQuestions: number }>()
  for (const entry of history) {
    const current = fallback.get(entry.difficulty) ?? {
      games: 0,
      wins: 0,
      totalQuestions: 0,
    }
    current.games += 1
    current.wins += entry.won ? 1 : 0
    current.totalQuestions += entry.totalQuestions
    fallback.set(entry.difficulty, current)
  }

  return [...fallback.entries()]
    .sort((left, right) => right[1].games - left[1].games)
    .map(([difficulty, aggregate]) => ({
      id: difficulty,
      label: titleCase(difficulty),
      games: aggregate.games,
      wins: aggregate.wins,
      winRate: aggregate.games === 0 ? 0 : roundOneDecimal((aggregate.wins / aggregate.games) * 100),
      avgQuestions:
        aggregate.games === 0 ? 0 : roundOneDecimal(aggregate.totalQuestions / aggregate.games),
    }))
}

export const deriveMobileInsightsSnapshot = (
  stats: MobileGlobalStats | null,
  history: readonly MobileHistoryEntry[],
  now: number = Date.now(),
): MobileInsightsSnapshot => {
  const totalGames = stats?.totalGames ?? history.length
  const wins = stats?.wins ?? history.filter((entry) => entry.won).length
  const winRate =
    stats?.winRate ??
    (totalGames === 0 ? 0 : roundOneDecimal((wins / totalGames) * 100))
  const avgQuestions =
    stats?.avgQuestions ??
    (history.length === 0
      ? 0
      : roundOneDecimal(
          history.reduce((sum, entry) => sum + entry.totalQuestions, 0) / history.length,
        ))
  const dailyStreak = deriveDailyStreak(history, now)

  return {
    totalGames,
    wins,
    winRate,
    avgQuestions,
    dailyStreak,
    achievements: deriveAchievements(history, dailyStreak, totalGames),
    achievementProgress: deriveAchievementProgress(history, dailyStreak, totalGames),
    heatmap: deriveQuestionHeatmap(history),
    successRates: deriveSuccessRates(stats, history),
    recentHistory: [...history].sort((left, right) => right.timestamp - left.timestamp).slice(0, 6),
  }
}

const titleCase = (value: string): string =>
  value
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const roundOneDecimal = (value: number): number => Math.round(value * 10) / 10

const toLocalDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDate = (value: string): number => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}