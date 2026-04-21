/**
 * Phase 2: Generate expanded attribute taxonomy via LLM.
 *
 * 1. Calls GPT-4o to propose ~150 new boolean attributes
 * 2. Generates question text for each
 * 3. Outputs SQL migration file
 *
 * Usage: OPENAI_API_KEY=sk-... npx tsx scripts/generate-attributes.ts
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.error('Set OPENAI_API_KEY env var')
  process.exit(1)
}

const EXISTING_ATTRIBUTES = [
  'canBreatheUnderwater', 'canControlElements', 'canFly', 'canRegenerate',
  'canShapeshift', 'canSwim', 'canTalk', 'canTeleport', 'canTimeTravel',
  'climbsWalls', 'controlsWeather', 'fromBook', 'fromMovie', 'fromSpace',
  'fromVideoGame', 'hasArmor', 'hasClaws', 'hasCompanion', 'hasFacialHair',
  'hasFamily', 'hasJob', 'hasMagicPowers', 'hasPet', 'hasSidekick',
  'hasSpiderSense', 'hasSuperpowers', 'hasTail', 'hasTentacles', 'hasWeapon',
  'hasWebShooters', 'hasWings', 'isAnimal', 'isFictional', 'isFunny',
  'isHero', 'isHuman', 'isImmortal', 'isInvisible', 'isLeader', 'isMale',
  'isReal', 'isRobot', 'isRoyalty', 'isVillain', 'livesInCity',
  'livesInNewYork', 'shootsLasers', 'usesTechnology', 'usesVehicle',
  'wearsCape', 'wearsGlasses', 'wearsHat', 'wearsMask',
]

const CATEGORIES = [
  'video-games', 'movies', 'anime', 'comics', 'books', 'cartoons', 'tv-shows', 'pop-culture',
]

interface AttributeProposal {
  key: string
  displayText: string
  questionText: string
  categories: string[] | null  // null = applies to all
  group: string
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`OpenAI API error ${resp.status}: ${text}`)
  }

  const data = (await resp.json()) as { choices: { message: { content: string } }[] }
  return data.choices[0].message.content
}

function esc(s: string): string {
  return s.replace(/'/g, "''")
}

async function main() {
  console.error('Generating expanded attribute taxonomy...')

  const systemPrompt = `You are an expert at designing classification systems for fictional characters.
You must output valid JSON only. No markdown, no code blocks.`

  const userPrompt = `I have an AI guessing game (like Akinator) for fictional characters across these categories: ${CATEGORIES.join(', ')}.

Current boolean attributes (${EXISTING_ATTRIBUTES.length} total):
${EXISTING_ATTRIBUTES.join(', ')}

I need to scale from ~136 characters to 100,000+. Generate exactly 150 NEW boolean attributes (not duplicating any existing ones) that would maximize the game's ability to distinguish characters.

Requirements:
- Each attribute must be a yes/no boolean (true/false/null for unknown)
- Use camelCase keys starting with lowercase (e.g., isProtagonist, hasRedHair, fromJapan)
- Include a natural-language yes/no question for each
- Group attributes by theme
- Include attributes that work across ALL categories AND category-specific ones
- Aim for attributes where roughly 20-50% of characters would be "true" — avoid attributes that are nearly always true or always false
- Cover these themes: identity/species, role/archetype, physical appearance, abilities/powers, origin/setting, media source, personality, relationships, anime-specific, game-specific, comics-specific, TV-specific

For each attribute, specify which categories it applies to (null = all categories).

Output JSON format:
{
  "attributes": [
    {
      "key": "camelCaseKey",
      "displayText": "Human Readable Label",
      "questionText": "Is this character ...?",
      "categories": null,
      "group": "identity"
    }
  ]
}`

  const raw = await callOpenAI(systemPrompt, userPrompt)
  const parsed = JSON.parse(raw) as { attributes: AttributeProposal[] }

  // Filter out any that duplicate existing
  const existingSet = new Set(EXISTING_ATTRIBUTES)
  const newAttrs = parsed.attributes.filter((a) => !existingSet.has(a.key))

  console.error(`LLM proposed ${parsed.attributes.length} attributes, ${newAttrs.length} are new`)

  // Validate keys are camelCase
  const validKey = /^[a-z][a-zA-Z0-9]*$/
  const valid = newAttrs.filter((a) => {
    if (!validKey.test(a.key)) {
      console.error(`  Skipping invalid key: ${a.key}`)
      return false
    }
    return true
  })

  // Deduplicate by key
  const seen = new Set<string>()
  const deduped: AttributeProposal[] = []
  for (const a of valid) {
    if (!seen.has(a.key)) {
      seen.add(a.key)
      deduped.push(a)
    }
  }

  console.error(`After validation: ${deduped.length} new attributes`)

  // Output SQL migration
  const lines: string[] = []
  lines.push('-- ============================================================')
  lines.push('-- Phase 2: Expanded attribute taxonomy')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push(`-- New attributes: ${deduped.length}`)
  lines.push('-- ============================================================')
  lines.push('')

  // Insert attribute definitions
  lines.push('-- New attribute definitions')
  for (const a of deduped) {
    const cats = a.categories ? `'${esc(JSON.stringify(a.categories))}'` : 'NULL'
    lines.push(
      `INSERT INTO attribute_definitions (key, display_text, question_text, categories) VALUES ('${esc(a.key)}', '${esc(a.displayText)}', '${esc(a.questionText)}', ${cats});`
    )
  }
  lines.push('')

  // Insert questions (one per new attribute)
  lines.push('-- New questions for expanded attributes')
  let qIdx = 52 // existing questions go up to q51
  for (const a of deduped) {
    const qId = `q${qIdx++}`
    lines.push(
      `INSERT INTO questions (id, text, attribute_key) VALUES ('${esc(qId)}', '${esc(a.questionText)}', '${esc(a.key)}');`
    )
  }

  console.log(lines.join('\n'))

  // Also output a JSON file for reference / backfill script
  const jsonOut = JSON.stringify(deduped, null, 2)
  const fs = await import('fs')
  fs.writeFileSync('scripts/expanded-attributes.json', jsonOut)

  console.error(`\nDone! SQL written to stdout, JSON saved to scripts/expanded-attributes.json`)
  console.error(`Run: npx tsx scripts/generate-attributes.ts > migrations/0003_expanded_attributes.sql`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
