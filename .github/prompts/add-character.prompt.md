---
description: "Add a new character to the default database with all required attributes."
mode: "agent"
---

# Add Character

Add a new character to the DEFAULT_CHARACTERS array in `src/lib/database.ts`.

## Requirements
1. Generate a unique lowercase `id` from the character name
2. Set the `name` to the character's display name
3. Fill ALL existing attributes (check other characters for the full attribute list)
4. Use `true`, `false`, or `null` (null = genuinely unknown/not applicable)
5. Be factually accurate — research the character if needed
6. Place the new entry alphabetically in the array

## Attribute Categories
- **Identity**: isReal, isAnimal, isHuman, isRobot, isFictional, isMale
- **Abilities**: canFly, hasSuperpowers, hasMagicPowers, canShapeshift, canTeleport, canControlElements, canTimeTravel, canRegenerate
- **Physical**: wearsHat, hasTail, wearsCape, hasFacialHair, hasClaws, hasWings, hasTentacles, wearsMask, hasArmor, wearsGlasses
- **Powers**: hasWebShooters, hasSpiderSense, shootsLasers, controlsWeather
- **Movement**: climbsWalls, canSwim, canBreatheUnderwater
- **Social**: hasFamily, hasCompanion, hasSidekick, isLeader, hasPet
- **Origins**: fromSpace, fromVideoGame, fromMovie, fromBook, livesInNewYork, livesInCity
- **Personality**: isFunny, isVillain, isHero
- **Other**: canTalk, hasWeapon, usesVehicle, usesTechnology, isImmortal, hasJob, isRoyalty, isInvisible

## After Adding
- Verify no duplicate IDs exist
- Check attribute count matches other characters
- Run `pnpm build` to verify no type errors

Add the character: {{input}}
