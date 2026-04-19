import { http, HttpResponse } from 'msw'
import type { Character, Question } from '@/lib/types'

const defaultCharacters: Character[] = [
  { id: 'mario', name: 'Mario', category: 'video-games', attributes: { isHuman: true } },
]

const defaultQuestions: Question[] = [
  { id: 'q1', text: 'Is this character human?', attribute: 'isHuman' },
]

export const handlers = [
  // v1 endpoints
  http.get('/api/characters', () => {
    return HttpResponse.json(defaultCharacters)
  }),

  http.post('/api/characters', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/questions', () => {
    return HttpResponse.json(defaultQuestions)
  }),

  http.post('/api/questions', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/stats', () => {
    return HttpResponse.json({ games: 0, wins: 0 })
  }),

  http.post('/api/stats', () => {
    return HttpResponse.json({ success: true })
  }),

  http.post('/api/corrections', () => {
    return HttpResponse.json({ success: true, autoApplied: false })
  }),

  http.get('/api/sync', () => {
    return HttpResponse.json({})
  }),

  http.post('/api/sync', () => {
    return HttpResponse.json({ success: true })
  }),

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

  http.post('/api/v2/game/resume', () => {
    return HttpResponse.json({ expired: true })
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
]
