export interface AttributeRecommendation {
  attribute: string
  label: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface CharacterTypeProfile {
  type: string
  keywords: string[]
  coreAttributes: string[]
  recommendedAttributes: string[]
  optionalAttributes: string[]
}

export const CHARACTER_TYPE_PROFILES: CharacterTypeProfile[] = [
  {
    type: 'Superhero',
    keywords: ['hero', 'super', 'avenger', 'justice', 'league', 'man', 'woman', 'captain', 'spider', 'iron', 'bat', 'wonder'],
    coreAttributes: ['isHero', 'hasSuperpowers', 'isFictional', 'isHuman'],
    recommendedAttributes: ['wearsCape', 'wearsMask', 'hasSidekick', 'livesInCity', 'hasWeapon', 'canFly', 'hasArmor', 'usesVehicle'],
    optionalAttributes: ['hasWebShooters', 'climbsWalls', 'hasSpiderSense', 'livesInNewYork', 'isRobot', 'canRegenerate', 'shootsLasers'],
  },
  {
    type: 'Villain/Antagonist',
    keywords: ['villain', 'evil', 'bad', 'joker', 'thanos', 'darth', 'voldemort', 'sauron', 'loki'],
    coreAttributes: ['isVillain', 'isFictional'],
    recommendedAttributes: ['hasSuperpowers', 'hasMagicPowers', 'hasWeapon', 'hasArmor', 'isLeader', 'hasMinions', 'canShapeshift'],
    optionalAttributes: ['canTeleport', 'isImmortal', 'fromSpace', 'usesVehicle', 'wearsMask', 'hasTentacles', 'controlsWeather'],
  },
  {
    type: 'Video Game Character',
    keywords: ['mario', 'sonic', 'link', 'zelda', 'pokemon', 'pikachu', 'kirby', 'samus', 'pacman'],
    coreAttributes: ['fromVideoGame', 'isFictional'],
    recommendedAttributes: ['hasSuperpowers', 'hasWeapon', 'usesVehicle', 'canJump', 'collectsItems', 'hasLives'],
    optionalAttributes: ['isAnimal', 'isHero', 'canFly', 'wearsHat', 'hasCompanion', 'canShapeshift', 'usesTechnology'],
  },
  {
    type: 'Fantasy Character',
    keywords: ['wizard', 'elf', 'dwarf', 'dragon', 'knight', 'hobbit', 'gandalf', 'frodo', 'aragorn', 'merlin'],
    coreAttributes: ['isFictional', 'fromBook'],
    recommendedAttributes: ['hasMagicPowers', 'hasWeapon', 'isRoyalty', 'hasCompanion', 'canTalk'],
    optionalAttributes: ['isImmortal', 'canShapeshift', 'canTeleport', 'hasWings', 'canControlElements', 'wearsRobe'],
  },
  {
    type: 'Sci-Fi Character',
    keywords: ['star', 'wars', 'trek', 'alien', 'robot', 'cyborg', 'android', 'space', 'vader', 'spock'],
    coreAttributes: ['isFictional', 'fromSpace'],
    recommendedAttributes: ['usesTechnology', 'hasWeapon', 'usesVehicle', 'isRobot', 'canTeleport'],
    optionalAttributes: ['isImmortal', 'hasArmor', 'shootsLasers', 'canTimeTravel', 'hasClaws', 'canRegenerate'],
  },
  {
    type: 'Animal/Creature',
    keywords: ['dog', 'cat', 'bird', 'dragon', 'pokemon', 'lion', 'wolf', 'bear', 'snake', 'fish'],
    coreAttributes: ['isAnimal', 'isFictional'],
    recommendedAttributes: ['canTalk', 'hasFur', 'hasWings', 'hasTail', 'canFly'],
    optionalAttributes: ['hasSuperpowers', 'hasCompanion', 'canSwim', 'hasClaws', 'canBreatheUnderwater', 'hasTentacles'],
  },
  {
    type: 'Historical Figure',
    keywords: ['king', 'queen', 'president', 'emperor', 'napoleon', 'cleopatra', 'caesar', 'washington'],
    coreAttributes: ['isReal', 'isHuman'],
    recommendedAttributes: ['isLeader', 'isRoyalty', 'hasJob', 'isMale'],
    optionalAttributes: ['hasFacialHair', 'wearsGlasses', 'hasFamily', 'livesInCity', 'isFromEurope', 'isFromAsia'],
  },
  {
    type: 'Celebrity/Public Figure',
    keywords: ['actor', 'singer', 'musician', 'athlete', 'artist', 'writer', 'scientist'],
    coreAttributes: ['isReal', 'isHuman'],
    recommendedAttributes: ['hasJob', 'isMale', 'isFamous', 'isAlive'],
    optionalAttributes: ['wearsGlasses', 'hasFacialHair', 'hasFamily', 'livesInCity', 'wonAwards', 'playsInstrument'],
  },
  {
    type: 'Robot/AI',
    keywords: ['robot', 'android', 'cyborg', 'ai', 'r2d2', 'c3po', 'wall-e', 'terminator', 'optimus'],
    coreAttributes: ['isRobot', 'isFictional'],
    recommendedAttributes: ['usesTechnology', 'canTalk', 'hasWeapon', 'usesVehicle'],
    optionalAttributes: ['hasSuperpowers', 'isVillain', 'canFly', 'shootsLasers', 'canShapeshift', 'isImmortal'],
  },
  {
    type: 'Cartoon Character',
    keywords: ['mickey', 'bugs', 'spongebob', 'homer', 'bart', 'scooby', 'tom', 'jerry', 'popeye'],
    coreAttributes: ['isFictional', 'fromCartoon'],
    recommendedAttributes: ['isAnimal', 'canTalk', 'isFunny', 'hasCompanion'],
    optionalAttributes: ['wearsHat', 'wearsGloves', 'hasSuperpowers', 'livesInCity', 'hasFamily', 'hasPet'],
  },
]

export const ALL_KNOWN_ATTRIBUTES: Record<string, string> = {
  isReal: 'Real Person',
  isAnimal: 'Animal/Creature',
  isHuman: 'Human',
  canFly: 'Can Fly',
  hasSuperpowers: 'Has Superpowers',
  isVillain: 'Villain',
  fromVideoGame: 'From Video Game',
  fromMovie: 'From Movie',
  fromBook: 'From Book',
  isFictional: 'Fictional',
  wearsHat: 'Wears Hat',
  hasMagicPowers: 'Has Magic Powers',
  isHero: 'Hero',
  canTalk: 'Can Talk',
  hasWeapon: 'Has Weapon',
  usesVehicle: 'Uses Vehicle',
  isRobot: 'Robot/AI',
  hasCompanion: 'Has Companion',
  isMale: 'Male',
  canShapeshift: 'Can Shapeshift',
  hasFamily: 'Has Family',
  isImmortal: 'Immortal',
  hasJob: 'Has Job/Occupation',
  wearsGlasses: 'Wears Glasses',
  hasFacialHair: 'Has Facial Hair',
  isLeader: 'Leader',
  canTeleport: 'Can Teleport',
  isFunny: 'Funny/Comedic',
  fromSpace: 'From Space',
  livesInCity: 'Lives in City',
  canSwim: 'Can Swim',
  hasArmor: 'Has Armor',
  usesTechnology: 'Uses Technology',
  wearsCape: 'Wears Cape',
  hasTail: 'Has Tail',
  canBreatheUnderwater: 'Can Breathe Underwater',
  isInvisible: 'Invisible',
  hasSidekick: 'Has Sidekick',
  wearsMask: 'Wears Mask',
  canControlElements: 'Controls Elements',
  canTimeTravel: 'Can Time Travel',
  hasPet: 'Has Pet',
  isRoyalty: 'Royalty',
  hasWebShooters: 'Has Web Shooters',
  climbsWalls: 'Climbs Walls',
  hasSpiderSense: 'Has Spider-Sense',
  livesInNewYork: 'Lives in New York',
  hasClaws: 'Has Claws',
  hasWings: 'Has Wings',
  canRegenerate: 'Can Regenerate',
  hasTentacles: 'Has Tentacles',
  shootsLasers: 'Shoots Lasers',
  controlsWeather: 'Controls Weather',
  fromCartoon: 'From Cartoon/Animation',
  hasMinions: 'Has Minions/Followers',
  canJump: 'Can Jump High',
  collectsItems: 'Collects Items',
  hasLives: 'Has Multiple Lives',
  wearsRobe: 'Wears Robe',
  isFamous: 'Famous',
  isAlive: 'Currently Alive',
  wonAwards: 'Won Awards',
  playsInstrument: 'Plays Musical Instrument',
  wearsGloves: 'Wears Gloves',
  isFromEurope: 'From Europe',
  isFromAsia: 'From Asia',
  hasFur: 'Has Fur',
}

export function detectCharacterType(characterName: string): CharacterTypeProfile | null {
  const nameLower = characterName.toLowerCase()
  
  for (const profile of CHARACTER_TYPE_PROFILES) {
    for (const keyword of profile.keywords) {
      if (nameLower.includes(keyword)) {
        return profile
      }
    }
  }
  
  return null
}

export function getAttributeRecommendations(
  characterName: string,
  existingAttributes: Record<string, boolean | null>
): AttributeRecommendation[] {
  const recommendations: AttributeRecommendation[] = []
  const detectedType = detectCharacterType(characterName)
  
  if (!detectedType) {
    return getGenericRecommendations(existingAttributes)
  }
  
  const existingKeys = new Set(Object.keys(existingAttributes))
  
  detectedType.coreAttributes.forEach((attr) => {
    if (!existingKeys.has(attr)) {
      recommendations.push({
        attribute: attr,
        label: ALL_KNOWN_ATTRIBUTES[attr] || attr,
        reason: `Essential for ${detectedType.type} characters`,
        priority: 'high',
      })
    }
  })
  
  detectedType.recommendedAttributes.forEach((attr) => {
    if (!existingKeys.has(attr)) {
      recommendations.push({
        attribute: attr,
        label: ALL_KNOWN_ATTRIBUTES[attr] || attr,
        reason: `Common trait for ${detectedType.type} characters`,
        priority: 'medium',
      })
    }
  })
  
  detectedType.optionalAttributes.forEach((attr) => {
    if (!existingKeys.has(attr)) {
      recommendations.push({
        attribute: attr,
        label: ALL_KNOWN_ATTRIBUTES[attr] || attr,
        reason: `May apply to some ${detectedType.type} characters`,
        priority: 'low',
      })
    }
  })
  
  return recommendations
}

export function getGenericRecommendations(
  existingAttributes: Record<string, boolean | null>
): AttributeRecommendation[] {
  const recommendations: AttributeRecommendation[] = []
  const existingKeys = new Set(Object.keys(existingAttributes))
  
  const baseAttributes = [
    'isReal',
    'isFictional',
    'isHuman',
    'isAnimal',
    'canTalk',
  ]
  
  baseAttributes.forEach((attr) => {
    if (!existingKeys.has(attr)) {
      recommendations.push({
        attribute: attr,
        label: ALL_KNOWN_ATTRIBUTES[attr] || attr,
        reason: 'Basic character classification',
        priority: 'high',
      })
    }
  })
  
  const commonAttributes = [
    'hasSuperpowers',
    'isHero',
    'isVillain',
    'hasWeapon',
    'canFly',
  ]
  
  commonAttributes.forEach((attr) => {
    if (!existingKeys.has(attr)) {
      recommendations.push({
        attribute: attr,
        label: ALL_KNOWN_ATTRIBUTES[attr] || attr,
        reason: 'Common character trait',
        priority: 'medium',
      })
    }
  })
  
  return recommendations
}

export async function generateAttributeRecommendationsWithAI(
  characterName: string,
  existingAttributes: Record<string, boolean | null>
): Promise<AttributeRecommendation[]> {
  const existingKeys = Object.keys(existingAttributes)
  const availableAttributes = Object.entries(ALL_KNOWN_ATTRIBUTES)
    .filter(([key]) => !existingKeys.includes(key))
    .map(([key, label]) => ({ key, label }))
  
  const existingAttrDisplay = Object.entries(existingAttributes)
    .map(([key, value]) => {
      const label = ALL_KNOWN_ATTRIBUTES[key] || key
      const valueStr = value === true ? 'YES' : value === false ? 'NO' : 'MAYBE'
      return `  - ${label} (${key}): ${valueStr}`
    })
    .join('\n')

  const prompt = `You are an expert character analyst helping to enhance a character guessing game database. You have deep knowledge of characters across all media - movies, TV, books, video games, comics, history, and pop culture.

CHARACTER ANALYSIS REQUEST:
Character Name: ${characterName}

CURRENT ATTRIBUTES (Already Defined):
${existingAttrDisplay || '  (No attributes defined yet)'}

AVAILABLE ATTRIBUTES TO CHOOSE FROM:
${availableAttributes.map(({ key, label }) => `  - ${label} (${key})`).join('\n')}

YOUR TASK:
Analyze "${characterName}" thoroughly and recommend the top 15 most relevant attributes to add. Use your knowledge of this character to make accurate, strategic recommendations.

SELECTION CRITERIA:
1. **Accuracy**: Only recommend attributes that are factually correct for this character
2. **Distinctiveness**: Prioritize attributes that help differentiate this character from similar ones
3. **Strategic Value**: Focus on attributes that would be useful in a guessing game (meaningful for narrowing down possibilities)
4. **Coverage**: Include a mix of physical traits, abilities, relationships, origins, and personality
5. **Priority Classification**:
   - HIGH: Essential traits that strongly define this character
   - MEDIUM: Important but not defining traits
   - LOW: Interesting details that add depth but aren't crucial

REASONING QUALITY:
For each recommendation, provide a specific, insightful reason that demonstrates your knowledge of the character. Examples:
- Good: "Spider-Man climbs walls using his spider abilities gained from the radioactive spider bite"
- Bad: "This might be useful for the character"

Return your response as a JSON object with a single "recommendations" property containing an array of exactly 15 recommendation objects:

{
  "recommendations": [
    {
      "attribute": "attribute_key",
      "label": "Human Readable Label",
      "reason": "Specific, detailed reason showing character knowledge",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Provide exactly 15 recommendations. Be specific and accurate about ${characterName}.`

  try {
    const response = await window.spark.llm(prompt, 'gpt-4o', true)
    const parsed = JSON.parse(response)
    return parsed.recommendations || []
  } catch (error) {
    console.error('AI recommendation failed:', error)
    return getAttributeRecommendations(characterName, existingAttributes)
  }
}

export async function generateSmartAttributeSuggestions(
  characterName: string,
  existingAttributes: Record<string, boolean | null>,
  focusArea?: 'physical' | 'abilities' | 'personality' | 'origins' | 'relationships'
): Promise<AttributeRecommendation[]> {
  const existingKeys = Object.keys(existingAttributes)
  const availableAttributes = Object.entries(ALL_KNOWN_ATTRIBUTES)
    .filter(([key]) => !existingKeys.includes(key))
  
  let focusDescription = ''
  let attributeFilter: ((key: string, label: string) => boolean) | undefined
  
  if (focusArea === 'physical') {
    focusDescription = 'physical appearance and traits (what they look like, what they wear)'
    attributeFilter = (key, label) => 
      label.toLowerCase().includes('wear') || 
      label.toLowerCase().includes('has ') ||
      key.includes('has') && (key.includes('Hair') || key.includes('Wings') || key.includes('Tail') || key.includes('Claws'))
  } else if (focusArea === 'abilities') {
    focusDescription = 'powers, abilities, and what they can do'
    attributeFilter = (key) => 
      key.startsWith('can') || 
      key.includes('Powers') || 
      key.includes('shoots') ||
      key.includes('controls') ||
      key.includes('climbs')
  } else if (focusArea === 'personality') {
    focusDescription = 'personality traits and moral alignment'
    attributeFilter = (key) => 
      key.includes('Funny') || 
      key.includes('Villain') || 
      key.includes('Hero') ||
      key.includes('Leader')
  } else if (focusArea === 'origins') {
    focusDescription = 'where they come from and their background'
    attributeFilter = (key, label) => 
      key.startsWith('from') || 
      key.startsWith('livesIn') ||
      key.includes('Real') ||
      label.includes('From ')
  } else if (focusArea === 'relationships') {
    focusDescription = 'relationships, companions, and social connections'
    attributeFilter = (key) => 
      key.includes('Family') || 
      key.includes('Companion') || 
      key.includes('Sidekick') ||
      key.includes('Pet') ||
      key.includes('Minions')
  }

  const filteredAttributes = focusArea 
    ? availableAttributes.filter(([key, label]) => attributeFilter?.(key, label) || false)
    : availableAttributes

  if (filteredAttributes.length === 0) {
    return []
  }

  const existingAttrDisplay = Object.entries(existingAttributes)
    .map(([key, value]) => {
      const label = ALL_KNOWN_ATTRIBUTES[key] || key
      const valueStr = value === true ? 'YES' : value === false ? 'NO' : 'MAYBE'
      return `  - ${label}: ${valueStr}`
    })
    .join('\n')

  const prompt = `You are analyzing "${characterName}" for a character guessing game.

CURRENT ATTRIBUTES:
${existingAttrDisplay || '  (None defined yet)'}

FOCUS AREA: ${focusDescription || 'general character traits'}

AVAILABLE ATTRIBUTES IN THIS CATEGORY:
${filteredAttributes.map(([key, label]) => `  - ${label} (${key})`).join('\n')}

Recommend the top 8 most accurate and strategic attributes from this category for "${characterName}". 

For each recommendation:
- Ensure it's factually accurate for this character
- Explain specifically why it applies to ${characterName}
- Classify priority as "high" (defining trait), "medium" (important), or "low" (interesting detail)

Return as JSON:
{
  "recommendations": [
    {
      "attribute": "attribute_key",
      "label": "Human Readable Label", 
      "reason": "Specific explanation for ${characterName}",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Provide exactly 8 recommendations focused on ${focusDescription || 'general traits'}.`

  try {
    const response = await window.spark.llm(prompt, 'gpt-4o', true)
    const parsed = JSON.parse(response)
    return parsed.recommendations || []
  } catch (error) {
    console.error('AI focused recommendation failed:', error)
    return []
  }
}
