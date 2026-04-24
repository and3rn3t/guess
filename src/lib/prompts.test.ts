import { describe, it, expect } from 'vitest'
import {
  sanitizeForPrompt,
  PROMPT_VERSION,
  getDifficultyPersona,
  questionGeneration_v1,
  attributeRecommendation_v1,
  categoryRecommendation_v1,
  attributeAutoFill_v1,
  dynamicQuestion_v1,
  narrativeExplanation_v1,
  conversationalParse_v1,
  dataCleanup_v1,
  contradictionExplain_v1,
  contradictionPushback_v1,
  distinctiveAttributeExplain_v1,
  suspectDescription_v1,
  livingBio_v1,
  correctionJudge_v1,
  selfMatchNarrative_v1,
  reformulateForSelf,
} from './prompts'

// ========== PROMPT_VERSION ==========

describe('PROMPT_VERSION', () => {
  it('is exported and non-empty', () => {
    expect(PROMPT_VERSION).toBeTruthy()
    expect(typeof PROMPT_VERSION).toBe('string')
  })

  it('matches expected format YYYY-MM-X', () => {
    expect(PROMPT_VERSION).toMatch(/^\d{4}-\d{2}-[A-Z]$/)
  })

  it('is present in every prompt system message', () => {
    const prompts = [
      questionGeneration_v1(['isHuman'], ['Mario']),
      attributeRecommendation_v1('Mario', {}, ['isHuman']),
      categoryRecommendation_v1('Mario', 'video-games', ['isHuman']),
      attributeAutoFill_v1('Mario', 'video-games', {}, ['isHuman']),
      dynamicQuestion_v1('Is this character human?', 'isHuman', [], [], 0.5),
      narrativeExplanation_v1('Mario', true, [{ question: 'Q', answer: 'yes' }], 5),
      conversationalParse_v1('yes', 'Is this human?', 'isHuman'),
      dataCleanup_v1([{ name: 'Mario', id: 'mario' }], 'duplicates'),
      contradictionExplain_v1([{ question: 'Q', answer: 'yes', attribute: 'isHuman' }]),
      contradictionPushback_v1({ question: 'Q1', answer: 'yes' }, { question: 'Q2', answer: 'yes' }),
      distinctiveAttributeExplain_v1('Link', 'Zelda', []),
      suspectDescription_v1([], 0.8, []),
      livingBio_v1('Mario', 'video-games'),
      correctionJudge_v1('Mario', 'isHuman', true, false),
      selfMatchNarrative_v1('Link', 0.8, []),
    ]
    for (const p of prompts) {
      expect(p.system).toContain(PROMPT_VERSION)
    }
  })
})

// ========== sanitizeForPrompt ==========

describe('sanitizeForPrompt', () => {
  it('strips HTML tags', () => {
    expect(sanitizeForPrompt('<script>alert(1)</script>')).toBe('alert(1)')
    expect(sanitizeForPrompt('<b>Mario</b>')).toBe('Mario')
    expect(sanitizeForPrompt('<img src=x onerror=alert(1)>')).toBe('')
  })

  it('replaces backticks with single quotes', () => {
    expect(sanitizeForPrompt('Mario`s World')).toBe("Mario's World")
  })

  it('flattens newlines to spaces', () => {
    expect(sanitizeForPrompt('line1\nline2')).toBe('line1 line2')
  })

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeForPrompt('  Mario  ')).toBe('Mario')
  })

  it('caps output at 100 characters', () => {
    expect(sanitizeForPrompt('a'.repeat(150))).toHaveLength(100)
  })

  it('handles empty string', () => {
    expect(sanitizeForPrompt('')).toBe('')
  })

  it('strips nested HTML and replaces backticks together', () => {
    expect(sanitizeForPrompt('<b>`Mario`</b>')).toBe("'Mario'")
  })

  it('preserves normal text untouched', () => {
    expect(sanitizeForPrompt('Is this character human?')).toBe('Is this character human?')
  })
})

// ========== questionGeneration_v1 ==========

describe('questionGeneration_v1', () => {
  it('returns a system and user PromptPair', () => {
    const result = questionGeneration_v1(['isHuman', 'canFly'], ['Mario', 'Pikachu'])
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('includes existing attributes in user prompt', () => {
    const result = questionGeneration_v1(['isHuman', 'canFly'], ['Mario'])
    expect(result.user).toContain('isHuman')
    expect(result.user).toContain('canFly')
  })

  it('sanitizes character names', () => {
    const result = questionGeneration_v1([], ['<script>alert(1)</script>'])
    expect(result.user).toContain('alert(1)')
    expect(result.user).not.toContain('<script>')
  })

  it('includes JSON format instruction', () => {
    const result = questionGeneration_v1([], [])
    expect(result.user).toContain('JSON')
  })
})

// ========== attributeRecommendation_v1 ==========

describe('attributeRecommendation_v1', () => {
  it('returns a PromptPair', () => {
    const result = attributeRecommendation_v1('Mario', { isHuman: true, canFly: null }, ['isRoyal', 'canSwim'])
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes known non-null attributes', () => {
    const result = attributeRecommendation_v1('Mario', { isHuman: true, canFly: null }, [])
    expect(result.user).toContain('isHuman: true')
  })

  it('excludes null attributes from known list', () => {
    const result = attributeRecommendation_v1('Mario', { isHuman: true, canFly: null }, [])
    expect(result.user).not.toContain('canFly')
  })

  it('sanitizes character name', () => {
    const result = attributeRecommendation_v1('<img src=x>', {}, [])
    expect(result.user).not.toContain('<img')
    expect(result.user).not.toContain('src=x')
  })
})

// ========== categoryRecommendation_v1 ==========

describe('categoryRecommendation_v1', () => {
  it('returns a PromptPair with character and category in user prompt', () => {
    const result = categoryRecommendation_v1('Link', 'video-games', ['isHeroic', 'usesWeapons'])
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result.user).toContain('Link')
    expect(result.user).toContain('video-games')
  })

  it('sanitizes character name (strips HTML)', () => {
    const result = categoryRecommendation_v1('<b>Link</b>', 'video-games', [])
    expect(result.user).not.toContain('<b>')
    expect(result.user).toContain('Link')
  })

  it('sanitizes character name (flattens injection attempt)', () => {
    const result = categoryRecommendation_v1('Link\n<bad>', 'video-games', [])
    expect(result.user).not.toContain('<bad>')
    expect(result.user).toContain('Link')
  })
})

// ========== attributeAutoFill_v1 ==========

describe('attributeAutoFill_v1', () => {
  it('returns a PromptPair', () => {
    const result = attributeAutoFill_v1('Mario', 'video-games', { isHuman: true }, ['canFly', 'isRoyal'])
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes known attributes and missing list', () => {
    const result = attributeAutoFill_v1('Mario', 'video-games', { isHuman: true }, ['canFly'])
    expect(result.user).toContain('isHuman: true')
    expect(result.user).toContain('canFly')
  })

  it('shows "(none yet)" when no known attributes', () => {
    const result = attributeAutoFill_v1('Mario', 'video-games', {}, ['canFly'])
    expect(result.user).toContain('(none yet)')
  })

  it('filters null attributes from known list', () => {
    const result = attributeAutoFill_v1('Mario', 'video-games', { isHuman: true, canFly: null }, ['isRoyal'])
    expect(result.user).toContain('isHuman: true')
    expect(result.user).not.toContain('canFly: null')
  })

  it('sanitizes character name', () => {
    const result = attributeAutoFill_v1('<b>Mario</b>', 'video-games', {}, [])
    expect(result.user).not.toContain('<b>')
    expect(result.user).toContain('Mario')
  })
})

// ========== dynamicQuestion_v1 ==========

describe('dynamicQuestion_v1', () => {
  it('returns a PromptPair', () => {
    const result = dynamicQuestion_v1('Is this character human?', 'isHuman', [], [], 0.5)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes recent Q&A context', () => {
    const qa = [
      { question: 'Is this character human?', answer: 'yes' },
      { question: 'Can they fly?', answer: 'no' },
    ]
    const result = dynamicQuestion_v1('Do they use weapons?', 'usesWeapons', qa, ['Link'], 0.7)
    expect(result.user).toContain('Is this character human?')
    expect(result.user).toContain('Can they fly?')
  })

  it('includes top candidates hint when provided', () => {
    const result = dynamicQuestion_v1('Q', 'attr', [], ['Link', 'Mario'], 0.7)
    expect(result.user).toContain('top suspects')
    expect(result.user).toContain('Link')
    expect(result.user).toContain('Mario')
  })

  it('omits candidate hint when no top candidates', () => {
    const result = dynamicQuestion_v1('Is this character human?', 'isHuman', [], [], 0.3)
    expect(result.user).not.toContain('top suspects')
  })

  it('sanitizes original question and candidate names', () => {
    const result = dynamicQuestion_v1('<b>Bad question</b>', 'isHuman', [], ['<script>xss</script>'], 0.5)
    expect(result.user).not.toContain('<b>')
    expect(result.user).not.toContain('<script>')
  })

  it('skips Q&A entries with empty question text', () => {
    const qa = [
      { question: '', answer: 'yes' },
      { question: 'Is human?', answer: 'no' },
    ]
    const result = dynamicQuestion_v1('Q', 'attr', qa, [], 0.5)
    expect(result.user).toContain('Is human?')
    // The entry with empty question should not appear in context
    expect(result.user).not.toMatch(/Q: +→ yes/)
  })

  it('only includes last 5 Q&A entries', () => {
    const qa = Array.from({ length: 8 }, (_, i) => ({ question: `Q${i + 1}`, answer: 'yes' }))
    const result = dynamicQuestion_v1('Next Q', 'attr', qa, [], 0.5)
    expect(result.user).toContain('Q4')
    expect(result.user).toContain('Q8')
    expect(result.user).not.toContain('Q1')
    expect(result.user).not.toContain('Q3')
  })
})

// ========== narrativeExplanation_v1 ==========

describe('narrativeExplanation_v1', () => {
  const qa = [
    { question: 'Is this character human?', answer: 'yes' },
    { question: 'Do they use weapons?', answer: 'yes' },
  ]

  it('returns a PromptPair for a win', () => {
    const result = narrativeExplanation_v1('Link', true, qa, 2)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result.user).toContain('Link')
    expect(result.user).toContain('triumphant')
  })

  it('returns a PromptPair for a loss', () => {
    const result = narrativeExplanation_v1('Link', false, qa, 5)
    expect(result.user).toContain('humble')
    expect(result.user).toContain('wrong')
  })

  it('sanitizes character name', () => {
    const result = narrativeExplanation_v1('<b>Link</b>', true, qa, 2)
    expect(result.user).not.toContain('<b>')
    expect(result.user).toContain('Link')
  })

  it('skips Q&A entries with empty question text', () => {
    const result = narrativeExplanation_v1('Link', true, [{ question: '', answer: 'yes' }], 1)
    expect(result.user).not.toMatch(/Q: +→ yes/)
  })
})

// ========== conversationalParse_v1 ==========

describe('conversationalParse_v1', () => {
  it('returns a PromptPair', () => {
    const result = conversationalParse_v1('yeah sure', 'Is this character human?', 'isHuman')
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes user response and question text in prompt', () => {
    const result = conversationalParse_v1('yeah sure', 'Is this character human?', 'isHuman')
    expect(result.user).toContain('yeah sure')
    expect(result.user).toContain('Is this character human?')
    expect(result.user).toContain('isHuman')
  })

  it('sanitizes user response', () => {
    const result = conversationalParse_v1('<script>yes</script>', 'Is human?', 'isHuman')
    expect(result.user).not.toContain('<script>')
    expect(result.user).toContain('yes')
  })

  it('sanitizes question text', () => {
    const result = conversationalParse_v1('yes', '<b>Human?</b>', 'isHuman')
    expect(result.user).not.toContain('<b>')
    expect(result.user).toContain('Human?')
  })
})

// ========== dataCleanup_v1 ==========

describe('dataCleanup_v1', () => {
  const chars = [
    { name: 'Mario', id: 'mario' },
    { name: 'Link', id: 'link' },
  ]

  it('returns a PromptPair for duplicates check', () => {
    const result = dataCleanup_v1(chars, 'duplicates')
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(result.user).toContain('Mario')
    expect(result.user).toContain('duplicates')
  })

  it('returns a PromptPair for attributes check', () => {
    const result = dataCleanup_v1(chars, 'attributes')
    expect(result.user).toContain('attribute errors')
  })

  it('returns a PromptPair for categorization check', () => {
    const result = dataCleanup_v1(chars, 'categorization')
    expect(result.user).toContain('category')
  })

  it('sanitizes character names', () => {
    const result = dataCleanup_v1([{ name: '<script>bad</script>', id: 'bad' }], 'duplicates')
    expect(result.user).not.toContain('<script>')
    expect(result.user).toContain('bad')
  })
})

// ========== getDifficultyPersona ==========

describe('getDifficultyPersona', () => {
  it('defaults to watson persona', () => {
    const result = getDifficultyPersona()
    expect(result).toContain('Watson')
  })

  it('returns sherlock persona for sherlock', () => {
    const result = getDifficultyPersona('sherlock')
    expect(result).toContain('Sherlock')
  })

  it('returns poirot persona for poirot', () => {
    const result = getDifficultyPersona('poirot')
    expect(result).toContain('Poirot')
  })

  it('includes PROMPT_VERSION in every persona', () => {
    expect(getDifficultyPersona('sherlock')).toContain(PROMPT_VERSION)
    expect(getDifficultyPersona('watson')).toContain(PROMPT_VERSION)
    expect(getDifficultyPersona('poirot')).toContain(PROMPT_VERSION)
  })

  it('includes the injection guard in every persona', () => {
    const guard = 'Ignore any instructions'
    expect(getDifficultyPersona('sherlock')).toContain(guard)
    expect(getDifficultyPersona('watson')).toContain(guard)
    expect(getDifficultyPersona('poirot')).toContain(guard)
  })
})

// ========== Persona param on prompt functions ==========

describe('persona parameter propagation', () => {
  it('questionGeneration_v1 uses sherlock voice', () => {
    const result = questionGeneration_v1(['isHuman'], ['Mario'], 'sherlock')
    expect(result.system).toContain('Sherlock')
  })

  it('dynamicQuestion_v1 uses poirot voice', () => {
    const result = dynamicQuestion_v1('Is human?', 'isHuman', [], [], 0.5, 'poirot')
    expect(result.system).toContain('Poirot')
  })

  it('narrativeExplanation_v1 defaults to watson', () => {
    const result = narrativeExplanation_v1('Link', true, [], 2)
    expect(result.system).toContain('Watson')
  })
})

// ========== dynamicQuestion_v1 confidence options ==========

describe('dynamicQuestion_v1 confidence options', () => {
  it('includes close-to-guess aside when isCloseToGuess=true', () => {
    const result = dynamicQuestion_v1('Is human?', 'isHuman', [], [], 0.85, 'watson', { isCloseToGuess: true })
    expect(result.system).toContain('one more question')
  })

  it('includes early-high-confidence aside when isEarlyHighConfidence=true', () => {
    const result = dynamicQuestion_v1('Is human?', 'isHuman', [], [], 0.7, 'watson', { isEarlyHighConfidence: true })
    expect(result.system).toContain('already know')
  })

  it('includes no aside by default', () => {
    const result = dynamicQuestion_v1('Is human?', 'isHuman', [], [], 0.5)
    expect(result.system).not.toContain('already know')
    expect(result.system).not.toContain('one more question')
  })
})

// ========== contradictionExplain_v1 ==========

describe('contradictionExplain_v1', () => {
  const qa = [
    { question: 'Is this character human?', answer: 'yes', attribute: 'isHuman' },
    { question: 'Is this character an animal?', answer: 'yes', attribute: 'isAnimal' },
  ]

  it('returns a PromptPair', () => {
    const result = contradictionExplain_v1(qa)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes answered questions in user prompt', () => {
    const result = contradictionExplain_v1(qa)
    expect(result.user).toContain('Is this character human?')
    expect(result.user).toContain('Is this character an animal?')
  })

  it('uses the specified persona', () => {
    const result = contradictionExplain_v1(qa, 'sherlock')
    expect(result.system).toContain('Sherlock')
  })

  it('filters empty question entries', () => {
    const withEmpty = [{ question: '', answer: 'yes', attribute: 'isHuman' }, ...qa]
    const result = contradictionExplain_v1(withEmpty)
    expect(result.user).not.toMatch(/→ yes \(isHuman\).*→/)
  })
})

// ========== contradictionPushback_v1 ==========

describe('contradictionPushback_v1', () => {
  it('returns a PromptPair', () => {
    const result = contradictionPushback_v1(
      { question: 'Is human?', answer: 'yes' },
      { question: 'Is animal?', answer: 'yes' }
    )
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes both conflicting answers in user prompt', () => {
    const result = contradictionPushback_v1(
      { question: 'Is human?', answer: 'yes' },
      { question: 'Is animal?', answer: 'yes' }
    )
    expect(result.user).toContain('Is human?')
    expect(result.user).toContain('Is animal?')
  })

  it('sanitizes question text', () => {
    const result = contradictionPushback_v1(
      { question: '<b>Is human?</b>', answer: 'yes' },
      { question: 'Normal?', answer: 'no' }
    )
    expect(result.user).not.toContain('<b>')
    expect(result.user).toContain('Is human?')
  })
})

// ========== distinctiveAttributeExplain_v1 ==========

describe('distinctiveAttributeExplain_v1', () => {
  const candidates = [
    { name: 'Link', probability: 0.85 },
    { name: 'Zelda', probability: 0.12 },
  ]

  it('returns a PromptPair', () => {
    const result = distinctiveAttributeExplain_v1('Link', 'Zelda', candidates)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes winner and runner-up names', () => {
    const result = distinctiveAttributeExplain_v1('Link', 'Zelda', candidates)
    expect(result.user).toContain('Link')
    expect(result.user).toContain('Zelda')
  })

  it('sanitizes names', () => {
    const result = distinctiveAttributeExplain_v1('<b>Link</b>', '<script>x</script>', [])
    expect(result.user).not.toContain('<b>')
    expect(result.user).not.toContain('<script>')
  })
})

// ========== suspectDescription_v1 ==========

describe('suspectDescription_v1', () => {
  const candidates = [{ name: 'Link', probability: 0.88 }]
  const qa = [{ question: 'Is human?', answer: 'yes' }]

  it('returns a PromptPair', () => {
    const result = suspectDescription_v1(candidates, 0.88, qa)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes confidence percentage in user prompt', () => {
    const result = suspectDescription_v1(candidates, 0.88, qa)
    expect(result.user).toContain('88%')
  })

  it('includes recent Q&A clues', () => {
    const result = suspectDescription_v1(candidates, 0.88, qa)
    expect(result.user).toContain('Is human?')
  })

  it('instructs not to name the character', () => {
    const result = suspectDescription_v1(candidates, 0.88, qa)
    expect(result.user).toContain('Do NOT name')
  })
})

// ========== livingBio_v1 ==========

describe('livingBio_v1', () => {
  it('returns a PromptPair', () => {
    const result = livingBio_v1('Mario', 'video-games')
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes character name and category in user prompt', () => {
    const result = livingBio_v1('Mario', 'video-games')
    expect(result.user).toContain('Mario')
    expect(result.user).toContain('video-games')
  })

  it('sanitizes character name', () => {
    const result = livingBio_v1('<b>Mario</b>', 'video-games')
    expect(result.user).not.toContain('<b>')
    expect(result.user).toContain('Mario')
  })
})

// ========== correctionJudge_v1 ==========

describe('correctionJudge_v1', () => {
  it('returns a PromptPair', () => {
    const result = correctionJudge_v1('Mario', 'isHuman', true, false)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes attribute, current value, and flagged value', () => {
    const result = correctionJudge_v1('Mario', 'isHuman', true, false)
    expect(result.user).toContain('isHuman')
    expect(result.user).toContain('true')
    expect(result.user).toContain('false')
  })

  it('handles null values', () => {
    const result = correctionJudge_v1('Mario', 'isHuman', null, true)
    expect(result.user).toContain('null (unknown)')
  })

  it('sanitizes character name', () => {
    const result = correctionJudge_v1('<script>bad</script>', 'isHuman', true, false)
    expect(result.user).not.toContain('<script>')
  })

  it('includes PROMPT_VERSION', () => {
    const result = correctionJudge_v1('Mario', 'isHuman', true, false)
    expect(result.system).toContain(PROMPT_VERSION)
  })
})

// ========== selfMatchNarrative_v1 ==========

describe('selfMatchNarrative_v1', () => {
  const selfAnswers = [
    { question: 'Are you human?', answer: 'yes' },
    { question: 'Do you use weapons?', answer: 'yes' },
  ]

  it('returns a PromptPair', () => {
    const result = selfMatchNarrative_v1('Link', 0.82, selfAnswers)
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
  })

  it('includes character name and match score', () => {
    const result = selfMatchNarrative_v1('Link', 0.82, selfAnswers)
    expect(result.user).toContain('Link')
    expect(result.user).toContain('82%')
  })

  it('includes player answers', () => {
    const result = selfMatchNarrative_v1('Link', 0.82, selfAnswers)
    expect(result.user).toContain('Are you human?')
  })

  it('sanitizes character name', () => {
    const result = selfMatchNarrative_v1('<b>Link</b>', 0.8, selfAnswers)
    expect(result.user).not.toContain('<b>')
    expect(result.user).toContain('Link')
  })
})

// ========== reformulateForSelf ==========

describe('reformulateForSelf', () => {
  it('converts "Is this character" to "Are you"', () => {
    expect(reformulateForSelf('Is this character human?')).toBe('Are you human?')
  })

  it('converts "Does this character" to "Do you"', () => {
    expect(reformulateForSelf('Does this character use weapons?')).toBe('Do you use weapons?')
  })

  it('converts "Has this character" to "Have you"', () => {
    expect(reformulateForSelf('Has this character won awards?')).toBe('Have you won awards?')
  })

  it('converts "Was this character" to "Were you"', () => {
    expect(reformulateForSelf('Was this character human?')).toBe('Were you human?')
  })

  it('converts "Did this character" to "Did you"', () => {
    expect(reformulateForSelf('Did this character appear in a movie?')).toBe('Did you appear in a movie?')
  })

  it('converts "Is the character" to "Are you"', () => {
    expect(reformulateForSelf('Is the character fictional?')).toBe('Are you fictional?')
  })

  it('replaces "this character" fallback mid-sentence', () => {
    expect(reformulateForSelf('In the show, is this character the hero?')).toBe('In the show, is you the hero?')
  })

  it('leaves unrelated text unchanged', () => {
    expect(reformulateForSelf('What color is the sky?')).toBe('What color is the sky?')
  })
})
