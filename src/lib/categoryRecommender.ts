import { ALL_KNOWN_ATTRIBUTES, type AttributeRecommendation } from './attributeRecommender'
import { llm } from './llm'
import { AttributeRecommendationSchema } from './schemas'
import { z } from 'zod'

export type { AttributeRecommendation }

export type AttributeCategory = 'physical' | 'abilities' | 'personality' | 'origins' | 'relationships' | 'environment' | 'equipment'

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
      key.includes('hasArmor') ||
      key.includes('isMale') ||
      key.includes('isFemale') ||
      key.includes('isHuman') ||
      key.includes('isAnimal') ||
      key.includes('isRobot'),
    examplePrompt: 'Focus on what they look like, what they wear, and their physical characteristics',
  },
  abilities: {
    name: 'Powers & Abilities',
    description: 'special powers, skills, and capabilities',
    attributeFilter: (key, _label) =>
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
      key.startsWith('is') && (
        key.includes('Brave') ||
        key.includes('Intelligent') ||
        key.includes('Wise') ||
        key.includes('Arrogant') ||
        key.includes('Loyal') ||
        key.includes('Cunning') ||
        key.includes('Optimistic') ||
        key.includes('Pessimistic') ||
        key.includes('Shy') ||
        key.includes('Confident') ||
        key.includes('Aggressive') ||
        key.includes('Gentle') ||
        key.includes('Serious') ||
        key.includes('Playful') ||
        key.includes('Honest') ||
        key.includes('Deceptive') ||
        key.includes('Patient') ||
        key.includes('Impulsive') ||
        key.includes('Ambitious') ||
        key.includes('Lazy') ||
        key.includes('Creative') ||
        key.includes('Caring') ||
        key.includes('Selfish') ||
        key.includes('Merciful') ||
        key.includes('Ruthless') ||
        key.includes('Humble') ||
        key.includes('Jealous') ||
        key.includes('Independent') ||
        key.includes('TeamPlayer') ||
        key.includes('Rebellious')
      ) ||
      label.toLowerCase().includes('personality') ||
      label.toLowerCase().includes('behavior'),
    examplePrompt: 'Focus on their personality traits, moral alignment, temperament, and behavioral characteristics',
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
      key.includes('Job') ||
      key.includes('Famous') ||
      key.includes('Alive') ||
      key.includes('Awards') ||
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
  environment: {
    name: 'Environment & Habitat',
    description: 'where they live, operate, or spend time',
    attributeFilter: (key, label) =>
      key.startsWith('livesIn') ||
      key.includes('City') ||
      key.includes('Space') ||
      key.includes('Underwater') ||
      key.includes('Forest') ||
      key.includes('Mountain') ||
      key.includes('Desert') ||
      key.includes('Castle') ||
      key.includes('Location') ||
      label.toLowerCase().includes('lives in') ||
      label.toLowerCase().includes('location') ||
      label.toLowerCase().includes('habitat') ||
      label.toLowerCase().includes('environment'),
    examplePrompt: 'Focus on where they live, their typical environment, and the locations they inhabit',
  },
  equipment: {
    name: 'Equipment & Tools',
    description: 'weapons, vehicles, gadgets, and tools they use',
    attributeFilter: (key, label) =>
      key.includes('Weapon') ||
      key.includes('Vehicle') ||
      key.includes('Technology') ||
      key.includes('Armor') ||
      key.includes('Shield') ||
      key.includes('Sword') ||
      key.includes('Gun') ||
      key.includes('Gadget') ||
      key.includes('Tool') ||
      key.includes('uses') ||
      key.includes('has') && (label.toLowerCase().includes('weapon') || 
                               label.toLowerCase().includes('vehicle') || 
                               label.toLowerCase().includes('tool') ||
                               label.toLowerCase().includes('gadget')),
    examplePrompt: 'Focus on their weapons, vehicles, tools, gadgets, and equipment they use',
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
    const response = await llm(prompt, 'gpt-4o', true)
    const parsed = JSON.parse(response)
    const result = z.array(AttributeRecommendationSchema).safeParse(parsed.recommendations)
    return result.success ? result.data.slice(0, 10) : []
  } catch (error) {
    console.error('AI category recommendation failed:', error)
    return []
  }
}

export function getCategoryInfo(category: AttributeCategory): CategoryDefinition {
  return CATEGORY_DEFINITIONS[category]
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
