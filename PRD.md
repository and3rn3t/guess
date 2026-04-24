# Planning Guide

An intelligent guessing game that asks strategic questions to identify what character, object, or concept the user is thinking of, while providing real-time explanations of the AI's reasoning process and decision-making strategy.

## Implementation Status

| Feature | Status |
|---|---|
| Question Generation & Asking | Implemented |
| Answer Processing | Implemented |
| Reasoning Explanation Panel | Implemented |
| Final Guess & Resolution | Implemented |
| Learning System (Teaching Mode) | Implemented |
| Enhanced Attribute System (224 attrs, 53K+ characters) | Implemented |
| Statistics Dashboard | Implemented |
| Character Comparison Tool | Implemented |
| AI-Powered Attribute Recommendations | Implemented |
| Difficulty Selector | Implemented |
| Category Filters | Implemented |
| Daily Challenge | Implemented |
| Keyboard Shortcuts | Implemented |
| User Answer Reveal on Loss | Implemented |
| Touch-Optimized UI | Implemented |
| PWA / Offline Support | Implemented |

**Experience Qualities**:

1. **Intriguing** - The game should feel mysterious and intelligent, with the AI appearing to read the user's mind through clever deduction
2. **Transparent** - Every question and decision should be explained in depth so users understand the reasoning behind the AI's strategy
3. **Engaging** - The experience should feel like a conversation with a clever detective, not a sterile Q&A session

**Complexity Level**: Light Application (multiple features with basic state)
This is a focused game experience with question-answer flow, character database management, AI reasoning display, and game state tracking - but doesn't require complex multi-view navigation or advanced data modeling.

## Essential Features

**Question Generation & Asking**

- Functionality: AI generates strategic yes/no questions to narrow down possibilities
- Purpose: Core mechanic that drives the guessing process through binary elimination
- Trigger: Game start or after each user answer
- Progression: User clicks "Start Game" → AI analyzes possibilities → Question appears with explanation → User answers → Process repeats
- Success criteria: Questions are relevant, progressively narrow possibilities, and feel intelligent

**Answer Processing**

- Functionality: Records user's yes/no/maybe/don't know responses and updates probability space
- Purpose: Captures user input and adjusts the AI's understanding of what they're thinking
- Trigger: User clicks answer button
- Progression: User sees question → Clicks answer button → Answer highlights → Explanation panel updates → Next question appears
- Success criteria: Answers register instantly, visual feedback is clear, probability adjustments are shown

**Reasoning Explanation Panel**

- Functionality: Real-time display showing why the AI asked each question and how answers affect its strategy
- Purpose: Educational transparency that makes the AI's logic visible and builds trust/engagement
- Trigger: Displays continuously alongside questions
- Progression: Question appears → Explanation shows reasoning → User answers → Explanation updates with impact analysis → Pattern continues
- Success criteria: Explanations are clear, informative, and update smoothly without disrupting gameplay

**Final Guess & Resolution**

- Functionality: AI makes confident guess when probability threshold reached, user confirms or denies
- Purpose: Culmination of the deduction process with satisfying reveal
- Trigger: Confidence threshold met (typically 80%+) or question limit reached (15 questions)
- Progression: AI confidence builds → Guess screen appears → User confirms/denies → Win/lose state shows → Option to play again
- Success criteria: Guesses feel accurate, win/loss feedback is satisfying, easy restart flow

**Learning System (Teaching Mode)**

- Functionality: When AI guesses wrong, allows user to teach it the correct answer by entering the character name; the system automatically saves all answered questions as attributes
- Purpose: Makes the database grow smarter over time and gives users agency in improving the system
- Trigger: User indicates AI's guess was incorrect and clicks "Teach Me" button
- Progression: AI guesses wrong → GameOver screen with "Teach Me" option → Teaching Mode form appears → Shows all attributes that will be remembered → User enters character name → System saves with all answers as attributes → Success confirmation → Option to play again
- Success criteria: Teaching flow is intuitive, character name and all answered questions saved as attributes, new entries persist in KV storage, game uses new characters in future rounds

**Enhanced Attribute System**

- Functionality: Characters now have 224 unique attributes covering physical traits, abilities, relationships, origins, and personality
- Purpose: Enables much deeper character differentiation and more strategic question selection
- Categories:
  - Basic identity (isHuman, isAnimal, isRobot)
  - Abilities (canFly, canTeleport, canShapeshift, canControlElements, canRegenerate)
  - Physical traits (wearsHat, hasTail, wearsCape, hasFacialHair, hasClaws, hasWings, hasTentacles)
  - Powers (hasSuperpowers, hasMagicPowers, hasWebShooters, hasSpiderSense, shootsLasers, controlsWeather)
  - Movement (climbsWalls, canSwim, canBreatheUnderwater)
  - Social (hasFamily, hasCompanion, hasSidekick, isLeader)
  - Origins (fromSpace, fromVideoGame, fromMovie, fromBook, livesInNewYork, livesInCity)
  - Personality (isFunny, isVillain, isHero)
- New Questions: Added 10 new questions for recently discovered attributes from user-taught characters
- Success criteria: Question generator discovers new attributes from user-taught characters, game asks more diverse and strategic questions, characters are more easily distinguishable

**Statistics Dashboard**

- Functionality: Comprehensive analytics dashboard showing question usage patterns, attribute diversity metrics, and character pool composition
- Purpose: Provides insights into game performance, identifies underutilized questions, reveals attribute entropy for strategic improvement, and tracks learning system growth
- Trigger: User clicks "Statistics" button from welcome screen
- Progression: Click Statistics → Dashboard loads with three tabs (Question Usage, Attribute Analysis, Character Diversity) → View detailed metrics → Return to game
- Key Metrics:
  - Question Performance: Times asked, average position in game, success rate per question
  - Attribute Entropy: Information gain potential for each attribute, yes/no/null distribution, character coverage percentage
  - Character Diversity: Total characters, user-taught vs default breakdown, most/least common attributes, diversity score
  - Game History: Tracked wins/losses with questions asked per game for performance analytics
- Success criteria: Dashboard loads instantly, metrics update as games are played, entropy calculations guide question strategy, visualizations clearly communicate patterns

**Character Comparison Tool**

- Functionality: Interactive analysis tool that examines attribute overlaps between characters, identifies similar pairs, and enables detailed two-character comparisons
- Purpose: Reveals patterns in the character database, highlights areas where differentiation is weak, helps identify opportunities for new questions, and assists in understanding which characters are too similar
- Trigger: User clicks "Compare" button from welcome screen
- Progression: Click Compare → Dashboard loads with three tabs (Attribute Analysis, Similar Pairs, Compare Two) → Explore metrics and select characters → View detailed breakdowns → Return to game
- Key Features:
  - **Attribute Analysis Tab**: All attributes ranked by discrimination power (ability to differentiate characters), showing yes/no/maybe counts, coverage percentage, and a composite discrimination score
  - **Similar Pairs Tab**: Top 10 most similar character pairs with similarity percentage, shared vs different attribute counts, visual similarity bars
  - **Compare Two Tab**: Interactive character selector with search, side-by-side attribute comparison showing shared attributes (green), different attributes (red with value indicators), and similarity score
- Analysis Metrics:
  - Discrimination Power: Calculated from attribute coverage × distribution evenness × value variety
  - Similarity Score: Percentage of matching attribute values between two characters
  - Coverage: Percentage of characters that have defined (non-null) values for each attribute
- Success criteria: Tool loads instantly, discrimination calculations accurately identify strategic attributes, similarity analysis reveals problematic character overlaps, comparison view clearly shows differences between any two characters

**AI-Powered Attribute Recommendations**

- Functionality: Advanced AI recommendation system that analyzes characters deeply and suggests strategic attributes based on comprehensive character knowledge across all media
- Purpose: Uses AI (GPT-4o) to provide intelligent, character-specific attribute suggestions that go beyond rule-based recommendations with detailed reasoning that demonstrates real character knowledge
- Trigger: User navigates to a character from the Compare tool, clicks a recommendation icon/button
- Progression: Character selected → Recommendation screen loads with two tabs (Rule-Based, AI-Powered) → View rule-based suggestions based on character type detection → Generate AI recommendations (full analysis or category-focused) → Review detailed reasoning → Apply attributes with Yes/No/Maybe → Save changes
- Key Features:
  - **Rule-Based Tab**: Automatic character type detection (Superhero, Villain, Video Game, Fantasy, Sci-Fi, Animal, Historical, Celebrity, Robot, Cartoon) with tailored core/recommended/optional attributes, priority-based recommendations (high/medium/low)
  - **AI-Powered Tab**: Two recommendation modes:
    - **Complete Analysis**: Generates 15 comprehensive attribute recommendations across all categories using GPT-4o with deep character analysis, factual accuracy validation, strategic value assessment, detailed specific reasoning that shows character knowledge
    - **Focused Recommendations**: Category-specific analysis (Physical, Abilities, Personality, Origins, Relationships) generating 8 targeted attributes per category with specialized filtering
  - **Smart Application**: One-click apply with Yes/No/Maybe values, visual feedback showing applied attributes, live update of available recommendations as attributes are added, bulk save functionality
  - **Quality Reasoning**: AI provides specific, insightful explanations (e.g., "Spider-Man climbs walls using his spider abilities gained from the radioactive spider bite") rather than generic descriptions
- AI Prompt Engineering:
  - Displays current attributes with values to AI for context
  - Shows available attribute pool to prevent hallucination
  - Requests priority classification and specific reasoning
  - Uses GPT-4o for highest accuracy on character knowledge
  - Fallback to rule-based if AI fails
- Success criteria: AI generates accurate character-specific recommendations, reasoning demonstrates real character knowledge, focused categories provide relevant attributes, applying attributes is smooth with instant feedback, changes persist when saved

**Difficulty Selector**

- Functionality: Easy (20q) / Medium (15q) / Hard (10q) picker shown on the welcome screen before starting a game
- Purpose: Lets players control how many questions the AI gets, balancing accessibility vs challenge
- Trigger: User selects difficulty before clicking Start; selection passed to `POST /api/v2/game/start`
- Progression: Welcome screen loads → Difficulty picker visible → User selects → Hint text updates → User starts game with chosen budget
- Success criteria: Selection persists across sessions via `kv:pref:difficulty`; active difficulty shown in game footer; daily challenge unaffected

**Category Filters**

- Functionality: 8 multi-select chips on the welcome screen (Video Games, Movies, Anime, Comics, Books, Cartoons, TV Shows, Pop Culture) that narrow the candidate pool
- Purpose: Lets players focus on a domain they know, improving game enjoyment and relevance
- Trigger: User toggles chips before starting; selections passed to `POST /api/v2/game/start`
- Progression: Welcome screen → chips visible → user selects → pool estimate updates (`~N of 500+ characters`) → game starts with filtered pool
- Success criteria: Selections persist via `kv:pref:categories`; daily challenge always uses the full unfiltered pool; estimate uses `globalStats.byCategory`

**User Answer Reveal on Loss**

- Functionality: When the AI fails to guess correctly, `GameOver` shows a "Who were you thinking of?" text input; the submitted name is fuzzy-matched against the `characters` table and used to backfill `null` attributes
- Purpose: Recovers signal from lost games and improves the database over time without requiring a full Teaching Mode session
- Trigger: User loses (AI exhausts questions without a correct guess)
- Progression: AI fails → GameOver screen → input field appears → user types character name → `POST /api/v2/game/reveal` → null attributes backfilled (confidence 0.5), contradicting attributes queued as correction votes, `game_reveals` audit row written
- Success criteria: Fuzzy match works for common name variants; backfill only touches null attributes; contradictions queued, not applied immediately; audit row written regardless of match result

- **Obscure Subjects**: If user thinks of something too niche, AI gracefully admits uncertainty after reasonable attempts and invites them to teach it
- **Contradictory Answers**: System detects logical conflicts (e.g., "has fur" + "is a robot") and politely asks for clarification
- **Ambiguous Responses**: "Maybe" and "Don't Know" options prevent user frustration and factor into probability calculations appropriately
- **Empty Game State**: First-time users see a curated starter database so game works immediately without requiring initial data entry
- **Rapid Clicking**: Debounce answer buttons to prevent accidental double-submissions during question transitions

## Design Direction

The design should evoke the feeling of peering into a mystical fortune-teller's mind—mysterious yet approachable, intelligent yet playful. Think crystal ball aesthetics meets modern data visualization: ethereal gradients, subtle glows, flowing animations that suggest thought processes happening in real-time. The explanation panel should feel like looking at the AI's "notebook" where it tracks its deductive reasoning with clarity and personality.

## Color Selection

A mystical, intelligent color scheme that balances mystery with clarity.

- **Primary Color**: Deep cosmic purple `oklch(0.35 0.15 300)` - Communicates mystery, intelligence, and the mystical nature of mind-reading
- **Secondary Colors**:
  - Rich indigo `oklch(0.28 0.12 280)` for depth and supporting UI elements
  - Soft lavender `oklch(0.75 0.08 310)` for subtle backgrounds and hover states
- **Accent Color**: Bright cyan-blue `oklch(0.70 0.15 220)` - Attention-grabbing highlight for CTAs, correct guesses, and insights
- **Foreground/Background Pairings**:
  - Background (Deep space blue-black `oklch(0.12 0.03 270)`): Light text `oklch(0.98 0.01 300)` - Ratio 16.8:1 ✓
  - Primary (Deep cosmic purple `oklch(0.35 0.15 300)`): White text `oklch(1 0 0)` - Ratio 7.2:1 ✓
  - Accent (Bright cyan-blue `oklch(0.70 0.15 220)`): Dark text `oklch(0.12 0.03 270)` - Ratio 11.5:1 ✓
  - Card backgrounds (Elevated dark `oklch(0.18 0.04 280)`): Light text `oklch(0.98 0.01 300)` - Ratio 13.1:1 ✓

## Font Selection

Typography should feel modern and intelligent with a touch of mystery—geometric sans-serif that suggests precision and algorithmic thinking.

- **Primary Font**: Space Grotesk - Modern, slightly technical geometric sans with personality that fits the AI/game theme
- **Typographic Hierarchy**:
  - H1 (Game Title): Space Grotesk Bold / 42px / -0.02em letter spacing
  - H2 (Question Text): Space Grotesk Medium / 28px / -0.01em letter spacing
  - H3 (Section Headers): Space Grotesk Semibold / 20px / normal letter spacing
  - Body (Explanations): Space Grotesk Regular / 16px / 1.6 line height
  - Caption (Metadata): Space Grotesk Regular / 14px / 0.01em letter spacing / 70% opacity

## Animations

Animations should create a sense of thought and processing—smooth transitions that suggest the AI is actively thinking and analyzing. Key moments:

- **Question Transitions**: Fade-out-up old question, fade-in-down new question with 300ms stagger to suggest mental shifting
- **Answer Feedback**: Scale pulse on selected button with subtle glow expansion to confirm registration
- **Probability Updates**: Number counters animate smoothly using spring physics when confidence changes
- **Thinking State**: Subtle pulsing glow on explanation panel border when processing to show active reasoning
- **Final Guess Reveal**: Dramatic scale-in with slight rotation for the character reveal moment
- All animations use natural easing (ease-out for entrances, ease-in for exits) and respect reduced motion preferences

## Component Selection

- **Components**:
  - `Card` for question container, explanation panel, and final guess reveal - customized with glassmorphism backdrop-blur for mystical feel
  - `Button` for answer options (Yes/No/Maybe/Don't Know) - customized with glow effects and larger touch targets
  - `Progress` for question counter and confidence meter visualization
  - `Dialog` for teaching flow when AI guesses incorrectly
  - `Input` and `Textarea` for learning system forms
  - `Badge` for displaying current game statistics and confidence level
  - `Separator` for dividing explanation sections
  
- **Customizations**:
  - Custom "ThinkingCard" component with animated gradient border that pulses during AI reasoning
  - Custom "ConfidenceMeter" that visualizes probability as a glowing fill bar with particle effects
  - Glassmorphic answer buttons with hover states that create ethereal glow effects
  
- **States**:
  - Buttons: Rest (subtle border glow), Hover (increased glow + slight lift), Active (scale down + bright glow), Selected (persistent bright glow with checkmark), Disabled (reduced opacity + no glow)
  - Question cards: Idle (static), Thinking (pulsing border), Transitioning (fade + slide)
  - Explanation panel: Collapsed (show summary only), Expanded (full reasoning visible)
  
- **Icon Selection**:
  - `Brain` for AI reasoning indicators
  - `Lightbulb` for insights and deductions
  - `Question` for help/info tooltips
  - `CheckCircle` / `XCircle` for answer confirmation
  - `Sparkle` for confidence milestones
  - `ArrowRight` for progression cues
  - `Plus` for teaching/adding new entries
  
- **Spacing**:
  - Container padding: `p-6` on mobile, `p-8` on desktop
  - Card gaps: `gap-6` for major sections, `gap-4` for related elements
  - Button groups: `gap-3` for answer options
  - Text spacing: `space-y-2` for paragraph groups, `space-y-4` for distinct sections
  
- **Mobile**:
  - Stack explanation panel below question on mobile (initially collapsed with expand button)
  - Answer buttons go full-width in 2x2 grid on smallest screens, row of 4 on larger mobile
  - Reduce question text from 28px to 22px on mobile
  - Confidence meter moves from sidebar to top bar on mobile
  - Touch targets minimum 48px height for all interactive elements
