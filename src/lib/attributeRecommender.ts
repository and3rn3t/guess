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
    .map(([key, label]) => `${key}: ${label}`)
    .slice(0, 50)
  
  const prompt = `You are helping to build a character guessing game. Given a character name and their existing attributes, recommend the top 10 most relevant additional attributes to add.

Character: ${characterName}

Existing attributes: ${JSON.stringify(existingAttributes, null, 2)}

Available attributes to choose from:
${availableAttributes.join('\n')}

Analyze the character and recommend exactly 10 attributes that would be most useful for distinguishing this character in a guessing game. For each recommendation, classify the priority as "high", "medium", or "low" and provide a brief reason.

Return your response as a JSON object with a single "recommendations" property containing an array of objects with this structure:
{
  "recommendations": [
    {
      "attribute": "attribute_key",
      "label": "Human Readable Label",
      "reason": "Why this attribute is relevant",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Focus on attributes that:
1. Are factually accurate for this character
2. Help distinguish them from other characters
3. Are meaningful for gameplay`

  try {
    const response = await window.spark.llm(prompt, 'gpt-4o-mini', true)
    const parsed = JSON.parse(response)
    return parsed.recommendations || []
  } catch (error) {
    console.error('AI recommendation failed:', error)
    return getAttributeRecommendations(characterName, existingAttributes)
  }
}
