export async function llm(prompt: string, model: string, jsonMode?: boolean): Promise<string> {
  let response: Response
  try {
    response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model, jsonMode }),
    })
  } catch {
    throw new Error('Network error — check your internet connection and try again.')
  }

  if (!response.ok) {
    if (response.status === 502) {
      throw new Error('The AI service is temporarily unavailable. Please try again in a moment.')
    }
    if (response.status === 429) {
      throw new Error('Too many requests — please wait a moment and try again.')
    }
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM request failed (${response.status}): ${errorText}`)
  }

  return response.text()
}
