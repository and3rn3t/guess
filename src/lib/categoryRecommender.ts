import { ALL_KNOWN_ATTRIBUTES } from './attributeRecommender'

export interface AttributeRecommendation {
  attribute: string
  label: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export type AttributeCategory = 'physical' | 'abilities' | 'personality' | 'origins' | 'relationships'

interface CategoryDefinition {
  name: string
  description: string
  attributeFilter: (key: string, label: string) => boolean
  examplePrompt: string
}

const CATEGORY_DEFINITIONS: Record<AttributeCategory, CategoryDefinition> = {
  physical: {
    name: 'Physical Traits',
    description: 'physical appearance, clothing, and body features',
    attributeFilter: (key, label) =>
      label.toLowerCase().includes('wear') ||
      label.toLowerCase().includes('has ') ||
      key.includes('hasFur') ||
      key.includes('hasWings') ||
      key.includes('hasTail') ||
      key.includes('hasClaws') ||
      key.includes('hasTentacles') ||
      key.includes('hasFacialHair') ||
      key.includes('hasArmor'),
    examplePrompt: 'Focus on what they look like, what they wear, and their physical characteristics',
  },
  abilities: {
    name: 'Powers & Abilities',
    description: 'special powers, skills, and capabilities',
    attributeFilter: (key, label) =>
      key.startsWith('can') ||
      key.includes('Powers') ||
      key.includes('shoots') ||
      key.includes('controls') ||
      key.includes('climbs') ||
      key.includes('Regenerate') ||
      key.includes('Teleport') ||
      key.includes('Shapeshift') ||
      key.includes('Invisible'),
    examplePrompt: 'Focus on their powers, abilities, and what they can do',
  },
  personality: {
    name: 'Personality & Alignment',
    description: 'character traits, morality, and behavior',
    attributeFilter: (key, label) =>
      key.includes('Funny') ||
      key.includes('Villain') ||
      key.includes('Hero') ||
      key.includes('Leader') ||
      key.includes('Evil') ||
      key.includes('Good') ||
      label.toLowerCase().includes('personality') ||
      label.toLowerCase().includes('behavior'),
    examplePrompt: 'Focus on their personality, moral alignment, and how they behave',
  },
  origins: {
    name: 'Origins & Background',
    description: 'where they come from and their history',
    attributeFilter: (key, label) =>
      key.startsWith('from') ||
      key.startsWith('livesIn') ||
      key.includes('Real') ||
      key.includes('Fictional') ||
      key.includes('Royalty') ||
      key.includes('isFrom') ||
      label.toLowerCase().includes('from '),
    examplePrompt: 'Focus on where they come from, their background, and their world or universe',
  },
  relationships: {
    name: 'Relationships',
    description: 'companions, family, and social connections',
    attributeFilter: (key, label) =>
      key.includes('Family') ||
      key.includes('Companion') ||
      key.includes('Sidekick') ||
      key.includes('Pet') ||
      key.includes('Minions') ||
      key.includes('hasPartner') ||
      key.includes('Friend') ||
      label.toLowerCase().includes('relationship') ||
      label.toLowerCase().includes('companion'),
    examplePrompt: 'Focus on their relationships, companions, family, and social connections',
  },
}

export async function generateCategoryRecommendations(
  characterName: string,
  existingAttributes: Record<string, boolean | null>,
  category: AttributeCategory
): Promise<AttributeRecommendation[]> {
  const categoryDef = CATEGORY_DEFINITIONS[category]
  const existingKeys = Object.keys(existingAttributes)

  const availableAttributes = Object.entries(ALL_KNOWN_ATTRIBUTES)
    .filter(([key]) => !existingKeys.includes(key))
    .filter(([key, label]) => categoryDef.attributeFilter(key, label))

  if (availableAttributes.length === 0) {
    return []
  }

  const existingAttrDisplay = Object.entries(existingAttributes)
    .map(([key, value]) => {
      const label = ALL_KNOWN_ATTRIBUTES[key] || key
      const valueStr = value === true ? 'YES' : value === false ? 'NO' : 'MAYBE'
      return `  - ${label}: ${valueStr}`
    })
    .join('\n')

  const attributeList = availableAttributes.map(([key, label]) => `  - ${label} (${key})`).join('\n')
  
  const prompt = `You are an expert character analyst for a guessing game. Analyze "${characterName}" to provide accurate attribute recommendations.

CHARACTER: ${characterName}

CURRENT ATTRIBUTES:
${existingAttrDisplay || '  (No attributes defined yet)'}

CATEGORY: ${categoryDef.name}
FOCUS: Recommend attributes related to ${categoryDef.description}

AVAILABLE ATTRIBUTES FOR THIS CATEGORY:
${attributeList}

TASK:
Analyze ${characterName} and recommend up to 10 of the most accurate and strategically valuable attributes from the ${categoryDef.name} category.

REQUIREMENTS:
1. **Accuracy First**: Only recommend attributes that are factually correct for ${characterName}
2. **Specificity**: Provide detailed, character-specific reasoning that demonstrates knowledge
3. **Strategic Value**: Prioritize attributes that help distinguish ${characterName} from similar characters
4. **Category Focus**: ${categoryDef.examplePrompt}

PRIORITY LEVELS:
- "high": Defining traits that are central to ${characterName}'s identity in this category
- "medium": Important and accurate traits, but not absolutely defining
- "low": Interesting details that add depth but aren't crucial

Return exactly this JSON format with a "recommendations" array:
{
  "recommendations": [
    {
      "attribute": "attribute_key",
      "label": "Human Readable Label",
      "reason": "Detailed, specific explanation showing knowledge of ${characterName}",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Provide up to 10 recommendations focused specifically on ${categoryDef.description} for ${characterName}.`

  try {
    const response = await window.spark.llm(prompt, 'gpt-4o', true)
    const parsed = JSON.parse(response)
    return (parsed.recommendations || []).slice(0, 10)
  } catch (error) {
    console.error('AI category recommendation failed:', error)
    return []
  }
}

export function getCategoryInfo(category: AttributeCategory): CategoryDefinition {
  return CATEGORY_DEFINITIONS[category]
}

export function getAllCategories(): AttributeCategory[] {
  return Object.keys(CATEGORY_DEFINITIONS) as AttributeCategory[]
}

export function getAvailableAttributesForCategory(
  category: AttributeCategory,
  existingAttributes: Record<string, boolean | null>
): Array<{ key: string; label: string }> {
  const categoryDef = CATEGORY_DEFINITIONS[category]
  const existingKeys = Object.keys(existingAttributes)

  return Object.entries(ALL_KNOWN_ATTRIBUTES)
    .filter(([key]) => !existingKeys.includes(key))
    .filter(([key, label]) => categoryDef.attributeFilter(key, label))
    .map(([key, label]) => ({ key, label }))
}
