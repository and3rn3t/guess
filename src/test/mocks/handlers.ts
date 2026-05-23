import { http, HttpResponse } from 'msw'
import type { Character, Question } from '@/lib/types'

const defaultCharacters: Character[] = [
  { id: 'mario', name: 'Mario', category: 'video-games', attributes: { isHuman: true } },
]

const defaultQuestions: Question[] = [
  { id: 'q1', text: 'Is this character human?', attribute: 'isHuman' },
]

const defaultHistory = {
  games: [],
  total: 0,
}

const defaultLiveOps = {
  games1h: 10,
  wins1h: 6,
  losses1h: 4,
  errors1h: 0,
  warns1h: 0,
  gamesPerMin: 0.17,
  errorsPerMin: 0,
  winRate: 0.6,
  errorRate: 0,
  p95LatencyMs: 250,
  telemetryErrors1h: null,
  loggingGap: null,
  generatedAt: Math.floor(Date.now() / 1000),
}

export const handlers = [
  // LLM endpoints
  http.post('/api/llm', () => {
    return new HttpResponse('{"answer": "test"}', {
      headers: {
        'Content-Type': 'text/plain',
        'X-Token-Usage': JSON.stringify({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }),
      },
    })
  }),

  http.post('/api/llm-stream', () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"token":"Hello"}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: {"token":" World"}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: {"done":true}\n\n'))
        controller.close()
      },
    })
    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }),

  // v2 endpoints
  http.post('/api/v2/game/start', () => {
    return HttpResponse.json({
      sessionId: 'test-session-123',
      question: defaultQuestions[0],
      reasoning: { why: 'Test', impact: 'Test', remaining: 1, confidence: 50 },
      totalCharacters: 1,
    })
  }),

  http.post('/api/v2/game/answer', () => {
    return HttpResponse.json({
      type: 'question',
      question: defaultQuestions[0],
      reasoning: { why: 'Test', impact: 'Test', remaining: 1, confidence: 50 },
      remaining: 1,
      eliminated: 0,
      questionCount: 1,
    })
  }),

  http.post('/api/v2/game/result', () => {
    return HttpResponse.json({ success: true })
  }),

  http.post('/api/v2/game/feedback', () => {
    return HttpResponse.json({ success: true })
  }),

  http.post('/api/v2/game/resume', () => {
    return HttpResponse.json({ expired: true })
  }),

  http.post('/api/v2/game/skip', () => {
    return HttpResponse.json({
      type: 'question',
      question: defaultQuestions[0],
      reasoning: { why: 'Test', impact: 'Test', remaining: 1, confidence: 50 },
      remaining: 1,
      questionCount: 1,
      skippedCount: 1,
    })
  }),

  http.post('/api/v2/game/reject-guess', () => {
    return HttpResponse.json({
      type: 'question',
      question: defaultQuestions[0],
      reasoning: { why: 'Test', impact: 'Test', remaining: 1, confidence: 50 },
      remaining: 1,
      questionCount: 1,
      guessCount: 1,
      rejectCooldownRemaining: 0,
    })
  }),

  http.post('/api/v2/characters', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/v2/characters', () => {
    return HttpResponse.json(defaultCharacters)
  }),

  http.get('/api/v2/attributes', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v2/questions', () => {
    return HttpResponse.json(defaultQuestions)
  }),

  http.get('/api/v2/stats', () => {
    return HttpResponse.json({ totalGames: 0, totalCharacters: 0 })
  }),

  http.get('/api/v2/history', () => {
    return HttpResponse.json(defaultHistory)
  }),

  http.get('/api/admin/live-ops', () => {
    return HttpResponse.json(defaultLiveOps)
  }),
]
