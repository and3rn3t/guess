# iOS Screen Specification Pack

Effective date: 2026-05-09

This pack defines implementation-ready screen specifications for player-facing iOS parity surfaces.

## Shared Rules

- Dynamic Type support on all player-facing text.
- VoiceOver labels and hints on every actionable control.
- Reduced-motion path for transitions and high-motion effects.
- Explicit render states for `idle`, `loading`, `error`, and `offline`.
- Tap targets at or above 44x44pt.

## Screen Index

1. Welcome
2. Playing
3. Guessing
4. Game Over
5. Challenge
6. Stats
7. History
8. Compare
9. Session Resume
10. Preferences
11. Teaching
12. Post-Game Feedback

## Welcome

Purpose:

- Start standard game, launch challenge, or resume prior session.

Primary user jobs:

- Pick difficulty and categories quickly.
- Continue prior session without losing context.

State requirements:

- `idle`: primary actions visible.
- `loading`: prevent duplicate starts.
- `error`: inline retry for start/resume failures.
- `offline`: local-safe options with sync warning.

Accessibility and HIG:

- VoiceOver order should be stable and top-down.
- Large primary CTA and low visual clutter.

Telemetry:

- `mobile_welcome_viewed`
- `mobile_game_start_tapped`
- `mobile_resume_tapped`
- `mobile_challenge_tapped`

Success criteria:

- Median time-to-start under 5 seconds.

## Playing

Purpose:

- Capture answers and advance session with minimal friction.

Primary user jobs:

- Answer quickly (`yes`, `no`, `maybe`, `unknown`).
- Understand confidence and remaining progression budget.

State requirements:

- `idle`: question and answer controls enabled.
- `loading`: pending server response after answer/skip.
- `error`: inline retry with non-destructive rollback.
- `offline`: clear reconnect status and safe behavior.

Accessibility and HIG:

- Answer controls must not rely on color alone.
- Announce next question after update.
- Haptic feedback on answer commit.

Telemetry:

- `mobile_question_shown`
- `mobile_answer_submitted`
- `mobile_skip_tapped`
- `mobile_inline_retry_tapped`

Success criteria:

- p95 tap-to-feedback under 100ms.

## Guessing

Purpose:

- Present guess confidence and collect correct/incorrect signal.

Primary user jobs:

- Confirm guess or reject and continue.

State requirements:

- `idle`: candidate, confidence, and actions visible.
- `loading`: awaiting confirm/reject response.
- `error`: recover without session loss.
- `offline`: defer non-critical analytics only.

Accessibility and HIG:

- Confidence details readable by VoiceOver.
- Clear action labels for confirm/reject.

Telemetry:

- `mobile_guess_shown`
- `mobile_guess_confirmed`
- `mobile_guess_rejected`

Success criteria:

- Guess decision completion under 3 seconds median.

## Game Over

Purpose:

- Close session and route to next meaningful action.

Primary user jobs:

- Replay, review recap, or submit feedback.

State requirements:

- `idle`: outcome summary and next actions.
- `loading`: replay or feedback submission pending.
- `error`: non-blocking feedback retry.
- `offline`: deferred feedback with status message.

Accessibility and HIG:

- Outcome announcement on entry.
- Keep actions obvious and avoid modal stacking.

Telemetry:

- `mobile_game_over_viewed`
- `mobile_play_again_tapped`
- `mobile_feedback_opened`

Success criteria:

- Replay start success rate above 99%.

## Challenge

Purpose:

- Provide daily challenge entry and completion flow.

Primary user jobs:

- Start challenge and review summary progress.

State requirements:

- `idle`: challenge metadata and entry CTA.
- `loading`: challenge bootstrap in progress.
- `error`: retry with preserved context.
- `offline`: explain unavailable online features.

Accessibility and HIG:

- Leaderboard summary announced as structured text.
- Summary-first layout retained for small screens.

Telemetry:

- `mobile_challenge_viewed`
- `mobile_challenge_started`
- `mobile_challenge_completed`

Success criteria:

- Summary render start under 150ms p95.

## Stats

Purpose:

- Show progression and confidence-building metrics.

Primary user jobs:

- Review streaks, wins, and trend indicators.

State requirements:

- `idle`: cards/charts readable and stable.
- `loading`: skeleton placeholders for metrics.
- `error`: partial fallback cards plus retry.
- `offline`: last known stats with staleness marker.

Accessibility and HIG:

- Chart values must be represented in text form.

Telemetry:

- `mobile_stats_viewed`

Success criteria:

- Stats load success above 99%.

## History

Purpose:

- Browse past sessions for reflection and resume context.

Primary user jobs:

- Filter and inspect prior outcomes.

State requirements:

- `idle`: list and lightweight filters.
- `loading`: paginated loading indicator.
- `error`: retry with existing list preserved.
- `offline`: cached history where available.

Accessibility and HIG:

- List rows expose concise, descriptive summary labels.

Telemetry:

- `mobile_history_viewed`
- `mobile_history_filter_changed`

Success criteria:

- First-page load under 500ms p95 on warm cache.

## Compare

Purpose:

- Compare performance across category and difficulty.

Primary user jobs:

- Understand strengths and weaknesses quickly.

State requirements:

- `idle`: comparison cards and deltas.
- `loading`: placeholders for metrics.
- `error`: fallback messaging with retry.
- `offline`: last known values with stale indicator.

Accessibility and HIG:

- Avoid color-only encoding for deltas.

Telemetry:

- `mobile_compare_viewed`

Success criteria:

- User can identify top weakness in one screen pass.

## Session Resume

Purpose:

- Recover interrupted session safely.

Primary user jobs:

- Resume previous session or intentionally discard.

State requirements:

- `idle`: resume/discard prompt.
- `loading`: resume bootstrap in progress.
- `error`: fallback to safe new-session path.
- `offline`: local snapshot recovery when available.

Accessibility and HIG:

- Action labels clearly communicate consequences.

Telemetry:

- `mobile_resume_prompt_viewed`
- `mobile_resume_confirmed`
- `mobile_resume_discarded`

Success criteria:

- Resume restore correctness above 99%.

## Preferences

Purpose:

- Persist user controls and accessibility settings.

Primary user jobs:

- Set gameplay preferences and accessibility options.

State requirements:

- `idle`: current settings displayed.
- `loading`: save in progress.
- `error`: non-destructive save retry.
- `offline`: local save with sync-later notice.

Accessibility and HIG:

- Use native settings controls.

Telemetry:

- `mobile_preferences_viewed`
- `mobile_preferences_saved`

Success criteria:

- Settings persistence survives app restart.

## Teaching

Purpose:

- Show guided strategy and teach-mode progression.

Primary user jobs:

- Complete short lessons and apply strategy.

State requirements:

- `idle`: lesson card and CTA.
- `loading`: lesson transition in progress.
- `error`: recover to prior lesson state.
- `offline`: local lessons remain available.

Accessibility and HIG:

- Step transitions announced and controllable.

Telemetry:

- `mobile_teaching_viewed`
- `mobile_teaching_step_completed`

Success criteria:

- Lesson completion rate tracked and improving.

## Post-Game Feedback

Purpose:

- Collect quick qualitative signal after play.

Primary user jobs:

- Submit rating and optional comment.

State requirements:

- `idle`: feedback form ready.
- `loading`: submit in progress.
- `error`: preserve input and retry.
- `offline`: defer submission with clear status.

Accessibility and HIG:

- Rating control announces current value and range.

Telemetry:

- `mobile_feedback_viewed`
- `mobile_feedback_submitted`

Success criteria:

- Feedback submission success above 99%.
