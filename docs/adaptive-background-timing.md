# Adaptive Background - Timing & Behavior Flow

## The Complete Experience

### Timeline of Interaction

```
User hovers over input element
    ↓
[0ms] Background begins dimming
    ↓ (slow, organic transition)
    ↓
[2500ms] Background fully dimmed (55-60% opacity)
    ↓
User moves cursor away from element
    ↓
[0ms] Background STAYS dimmed (intentional hold)
    ↓ (waiting... ready... anticipating...)
    ↓
[2400-3200ms] Background begins returning
    ↓ (slow, breathing transition)
    ↓
[4900-5700ms] Background fully back to ambient state
```

### Page-Specific Timings

#### Home Page

```
Hover → Dim over 2.5s → Stay dimmed 2.4s → Return over 2.5s
Total cycle: ~7.4 seconds from hover to full rest

Why shorter delay:
- Simpler interaction
- Quick input focus
- Less "processing" feeling needed
```

#### Speak Page

```
Hover → Dim over 2.5s → Stay dimmed 3.2s → Return over 2.5s
Total cycle: ~8.2 seconds from hover to full rest

Why longer delay:
- More complex workflow
- Processing/generation context
- Creates sense of system "thinking"
```

## Emotional Journey

### Phase 1: Attention (0-2.5s)

**User hovers**

- Background begins slow fade
- Feels organic, breathing
- "I see you focusing here"

### Phase 2: Focus (2.5s-5.7s/6.7s)

**User interacts, then leaves**

- Background stays dimmed
- Holds its breath
- "I'm ready and waiting"
- "Take your time"

### Phase 3: Release (5.7s-8.2s / 6.7s-9.2s)

**After delay, background returns**

- Slow exhale back to ambient
- Never rushed
- "Returning to rest now"

## Psychological Effects

### Why This Works

1. **Anticipation**

   - The hold creates expectation
   - Like a pause before a response
   - Feels intelligent and aware

2. **No Flicker**

   - Prevents rapid state changes
   - Smooth even when moving between elements
   - Professional and polished

3. **Breathing Rhythm**

   - 2.5s transitions feel like breaths
   - ~3s holds feel like pauses
   - Natural, organic timing

4. **Compounding Micro-Interactions**
   - Alone: subtle and barely noticeable
   - Combined with other details: revolutionary
   - Creates cohesive, alive interface

## Technical Implementation

### State Machine

```
AMBIENT (default)
    ↓ [hover]
DIMMING (transition 2.5s)
    ↓ [transition complete]
FOCUSED (dimmed state)
    ↓ [leave]
HOLDING (waiting restDelay)
    ↓ [timeout complete]
RETURNING (transition 2.5s)
    ↓ [transition complete]
AMBIENT
```

### Re-Hover Behavior

If user hovers again during HOLDING or RETURNING:

```
HOLDING or RETURNING
    ↓ [hover again]
Clear timeout → DIMMING/FOCUSED
    ↓
Immediately resume focused state
    ↓
Feels responsive and fluid
```

## Design Rationale

### Why 2.5s transitions?

- Fast enough to be responsive
- Slow enough to be noticed subconsciously
- Matches natural breathing rhythm
- Never jarring or abrupt

### Why 2.4-3.2s delay?

- Long enough to create anticipation
- Short enough not to feel broken
- Similar to LLM "thinking" pause
- Varies by context (simple vs complex)

### Why 40-45% dimming?

- Noticeable but not dramatic
- Content stays visible
- Background still present
- Subtle enhancement, not takeover

## Comparison to Other Approaches

### Without Delay (Before)

```
Hover → Dim 400ms → Leave → Return 400ms
Total: <1 second

Problems:
- Feels twitchy
- No personality
- Technical, not organic
- Rapid flickering
```

### With Intentional Delay (Current)

```
Hover → Dim 2.5s → Stay 2.4-3.2s → Return 2.5s
Total: ~7-9 seconds

Benefits:
- Feels alive
- Has personality
- Thoughtful and intentional
- Smooth and professional
```

## Future Considerations

### Potential Enhancements

- Dynamic delay based on user behavior patterns
- Longer delay when typing actively
- Faster return during rapid navigation
- Context-aware dimming intensity

### Accessibility

- Respects prefers-reduced-motion
- Can be disabled via prop
- No impact on keyboard navigation
- Pure visual enhancement

## Usage in Other Contexts

This pattern can be applied to:

- Loading states (hold before showing spinner)
- Success feedback (hold before fading confirmation)
- Error messages (hold attention before dismissing)
- Transitions between views (pause before animation)

The key: **Intentional timing creates intentional feeling**
