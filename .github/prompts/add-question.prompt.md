---
description: "Add a new question targeting a character attribute for the guessing game."
mode: "agent"
---

# Add Question

Add a new question to the DEFAULT_QUESTIONS array in `src/lib/database.ts`.

## Requirements
1. Generate a unique `id` (use the format `q-{attribute}` or `q-{descriptive-slug}`)
2. Write a clear, natural yes/no question as the `text`
3. Set `attribute` to the exact camelCase attribute key it tests
4. The attribute must exist on characters in DEFAULT_CHARACTERS
5. Place the question logically near related questions

## Good Question Criteria
- High **information gain**: splits the character pool roughly in half
- Tests a single, unambiguous attribute
- Natural language that a player would understand
- Not redundant with existing questions

## After Adding
- Verify the attribute exists on characters
- Check for duplicate question IDs
- Run `pnpm build` to verify no type errors

Add question for: {{input}}
