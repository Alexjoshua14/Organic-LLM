# Ambient Components

Subtle, organic UI elements that add life to the interface without demanding attention.

## Available Components

### OrganicPresence

A basic breathing presence indicator with morphing blob animation.

- **Best for**: Static indicators, ambient presence
- **Size**: Configurable, default 80px
- **States**: Show/hide only

### CompactOrganicPresence

Smaller, more subtle version of OrganicPresence.

- **Best for**: Corner indicators, minimal presence
- **Size**: Fixed at 50px
- **States**: Show/hide only

### AdaptiveOrganicPresence

Intelligent presence that adapts to application state.

- **Best for**: Interactive pages, state-aware feedback
- **Size**: Configurable, default 100px
- **States**: idle, active, thinking, responding

## Quick Start

### 1. Simple ambient presence

```tsx
import { OrganicPresence } from "@/components/ambient/OrganicPresence";

<OrganicPresence show={true} position="bottom-right" />;
```

### 2. State-aware presence

```tsx
import {
  AdaptiveOrganicPresence,
  useOrganicPresenceState,
} from "@/components/ambient/AdaptiveOrganicPresence";

function MyComponent() {
  const { state, setActive, setIdle } = useOrganicPresenceState();

  return (
    <>
      <AdaptiveOrganicPresence state={state} />
      <input onFocus={setActive} onBlur={setIdle} />
    </>
  );
}
```

## Integration Tips

### Positioning Strategy

- **Single page apps**: Bottom-right or bottom-left
- **Chat interfaces**: Near input area, not overlapping
- **Content pages**: Top corners to avoid scroll interference
- **Modals**: Consider hiding the presence entirely

### When to Show

- ✅ During user interaction
- ✅ When processing/loading
- ✅ As ambient background element
- ❌ During critical user tasks (don't distract)
- ❌ Over important content

### State Management

```tsx
// Example: Chat interface
onInputFocus     → setActive()
onSubmit         → setThinking()
onStreamStart    → setResponding()
onStreamComplete → setIdle()
```

## Performance

All components are:

- **Client-rendered**: React hooks ensure no SSR issues
- **Lightweight**: ~2KB total, pure SVG + CSS
- **GPU-accelerated**: Only opacity and transform animations
- **No dependencies**: Self-contained

## See Also

- [Full Documentation](../docs/organic-presence.md)
- [Adaptive Background](../docs/adaptive-background.md)
- [Design Philosophy](../docs/adaptive-background-timing.md)
