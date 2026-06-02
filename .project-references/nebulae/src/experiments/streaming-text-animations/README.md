# Streaming Text Animations

A prototyping lab for exploring different text streaming animation patterns with configurable granularity, timing, and visual effects.

## Purpose

This experiment provides a framework for prototyping and testing text streaming animations:

- Multiple animation prototypes (Typewriter, Ripple)
- Configurable streaming granularity (character, word, line, sentence)
- Adjustable timing and visual parameters
- Modular control system for shared and prototype-specific settings

## Architecture

### Component Structure

```bash
components/
├── PrototypeDisplay.tsx      # Main orchestrator - state management & layout
├── PrototypeSelector.tsx     # Dropdown to switch between prototypes
├── SharedControls.tsx        # Common controls (text, stream mode, speed, loop)
├── TypewriterControls.tsx    # Typewriter-specific controls (cursor toggle)
├── RippleControls.tsx        # Ripple-specific controls (color, transition duration)
└── prototypes/
    ├── TypewriterPrototype.tsx  # Typewriter display component
    ├── RipplePrototype.tsx      # Ripple display component
    └── types.ts                  # Shared type definitions
```

### State Management

**Shared State** (all prototypes):

- Text content
- Stream mode (character/word/line/sentence)
- Speed (15-500ms per unit)
- Loop toggle
- Play/pause/restart controls

**Prototype-Specific State**:

- Typewriter: cursor visibility, cursor blink behavior
- Ripple: highlight color, transition duration

### Prototype System

Prototypes are registered in a configuration object that maps:

- `component`: The display component with props
- `specificControls`: Prototype-specific control components

This allows easy addition of new prototypes by extending the config.

## Prototypes

### Typewriter

Classic typewriter effect with configurable cursor behavior.

**Features:**

- Streaming text with visible cursor
- Smart cursor blinking (blinks after 250ms inactivity, stops during active streaming)
- Configurable cursor visibility toggle
- Supports all stream modes

**Controls:**

- Show/hide cursor toggle

### Ripple

Color wave effect where characters transition from highlight to base color.

**Features:**

- Leading edge highlighted in accent color
- Smooth color transition (configurable 50-500ms)
- Wave effect as text streams in
- Highlight color automatically transitions to base when streaming stops

**Controls:**

- Highlight color picker (Ember, Nebula, Aurora, Plasma)
- Transition duration slider (50-500ms)

## Stream Modes

All prototypes support four streaming granularities:

1. **Character** - Streams one character at a time
2. **Word** - Streams complete words (spaces included with words)
3. **Line** - Streams line by line (preserves line breaks)
4. **Sentence** - Streams sentence by sentence

## Interaction Patterns

**Play/Pause/Reset:**

- Play button starts animation from current position
- Pause stops at current position
- Reset clears display and stops animation
- Button text adapts: "Play" → "Pause" → "Restart"

**Loop Behavior:**

- When enabled, animation restarts after 3-second delay
- When disabled, animation stops at completion

**Cursor Blinking (Typewriter):**

- Cursor is solid during active streaming
- After 250ms of inactivity, cursor begins blinking
- Blinking stops immediately when new content streams in
- Mimics real typing UI behavior

## Design Tokens Used

From `src/foundations/theme/tokens.css`:

- `--color-accent-ember` (default Ripple highlight)
- `--color-accent-nebula`, `--color-accent-aurora`, `--color-accent-plasma` (color presets)
- `--color-text-primary` (base text color)
- `--radius-2xl` (glass surface corners)
- Glass surface utilities (`.glass-surface`, `.glass-input`)

## Visual Hierarchy

**Depth Layers:**

1. Main display area (glass-surface with highest depth)
2. Control buttons (above display)
3. Settings controls (below display, tertiary background)

**Spacing:**

- Tight grouping: selector → buttons → display (gap-4)
- Clear separation: display → settings (mt-8)
- Responsive padding throughout

## Notes

**Future Prototype Ideas:**

- Fade-in effect
- Slide-in from direction
- Character-by-character reveal with stagger
- Glitch/typewriter hybrid
- Multi-color gradient wave

**Potential Improvements:**

- Export animation as video/GIF
- Preset animation configurations
- Real-time preview of parameter changes
- Animation timeline scrubber
