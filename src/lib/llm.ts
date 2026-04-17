export async function llm(prompt: string, model: string, jsonMode?: boolean): Promise<string> {
  const response = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, jsonMode }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM request failed (${response.status}): ${errorText}`)
  }

  return response.text()
}
