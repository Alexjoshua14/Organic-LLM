# Organic Presence Components

Lightweight, client-rendered SVG components that add subtle organic life to your UI.

## Components

### `OrganicPresence`

Basic breathing presence indicator with simple pulsing animation.

### `CompactOrganicPresence`

Smaller, more subtle version of `OrganicPresence`.

### `AdaptiveOrganicPresence`

Intelligent presence indicator that changes based on application state.

## Features

- 🪶 **Lightweight**: Pure SVG with CSS animations, no heavy dependencies
- 🎨 **Organic**: Morphing blob shapes with breathing animations
- 📍 **Non-intrusive**: Absolutely positioned, won't affect layout
- 🎭 **State-aware**: Adapts visual intensity based on context
- ⚡ **Performant**: Simple transforms and opacity changes only
- 🌊 **Smooth**: 2-5s animation cycles for natural feel

## Basic Usage

### Simple Presence Indicator

```tsx
import { OrganicPresence } from "@/components/ambient/OrganicPresence";

export default function MyPage() {
  const [showPresence, setShowPresence] = useState(true);

  return (
    <div>
      <OrganicPresence
        show={showPresence}
        position="bottom-right"
        size={80}
        intensity={0.3}
      />
      {/* Your content */}
    </div>
  );
}
```

### Compact Version

```tsx
import { CompactOrganicPresence } from "@/components/ambient/OrganicPresence";

<CompactOrganicPresence show={true} position="top-right" />;
```

## Advanced: State-Aware Presence

### With Manual State Control

```tsx
import { AdaptiveOrganicPresence } from "@/components/ambient/AdaptiveOrganicPresence";

export default function ChatPage() {
  const [presenceState, setPresenceState] = useState("idle");

  const handleUserFocus = () => setPresenceState("active");
  const handleSubmit = () => setPresenceState("thinking");
  const handleResponse = () => setPresenceState("responding");
  const handleComplete = () => setPresenceState("idle");

  return (
    <div>
      <AdaptiveOrganicPresence
        state={presenceState}
        position="bottom-right"
        size={100}
      />
      {/* Your chat interface */}
    </div>
  );
}
```

### With Hook

```tsx
import {
  AdaptiveOrganicPresence,
  useOrganicPresenceState,
} from "@/components/ambient/AdaptiveOrganicPresence";

export default function MyPage() {
  const { state, setActive, setThinking, setResponding, setIdle } =
    useOrganicPresenceState();

  return (
    <div>
      <AdaptiveOrganicPresence state={state} />

      <input onFocus={setActive} onBlur={setIdle} />

      <button
        onClick={async () => {
          setThinking();
          await generateResponse();
          setResponding();
          // ... handle response
          setIdle();
        }}
      >
        Submit
      </button>
    </div>
  );
}
```

## Configuration

### `OrganicPresence` Props

| Prop        | Type      | Default          | Description                  |
| ----------- | --------- | ---------------- | ---------------------------- |
| `show`      | `boolean` | `true`           | Show/hide with smooth fade   |
| `position`  | Position  | `"bottom-right"` | Where to place the indicator |
| `size`      | `number`  | `80`             | Size in pixels               |
| `color`     | `string`  | `"currentColor"` | SVG fill color               |
| `intensity` | `number`  | `0.3`            | Visibility (0-1)             |
| `className` | `string`  | `""`             | Additional CSS classes       |

### `AdaptiveOrganicPresence` Props

| Prop        | Type     | Default          | Description                  |
| ----------- | -------- | ---------------- | ---------------------------- |
| `state`     | State    | `"idle"`         | Current presence state       |
| `position`  | Position | `"bottom-right"` | Where to place the indicator |
| `size`      | `number` | `100`            | Size in pixels               |
| `className` | `string` | `""`             | Additional CSS classes       |

### Position Options

- `"top-left"` - Upper left corner
- `"top-right"` - Upper right corner
- `"bottom-left"` - Lower left corner
- `"bottom-right"` - Lower right corner
- `"center"` - Center of viewport (AdaptiveOrganicPresence only)

### Presence States

| State        | Opacity | Blur | Speed | Color       | Meaning                   |
| ------------ | ------- | ---- | ----- | ----------- | ------------------------- |
| `idle`       | 0.15    | 16px | 5s    | Blue        | Resting, ambient presence |
| `active`     | 0.25    | 14px | 3.5s  | Purple      | Ready, user engaged       |
| `thinking`   | 0.35    | 12px | 2.5s  | Purple-500  | Processing, working       |
| `responding` | 0.45    | 10px | 2s    | Fuchsia-500 | Active response, shimmer  |

## Design Philosophy

### The Breathing Effect

All animations use 2-5s cycles to match natural breathing rhythms:

- Slow enough to be subliminal
- Fast enough to feel alive
- Never mechanical or repetitive

### Morphing Blobs

Three layers create depth:

1. **Outer blob**: Slowest, largest movements
2. **Middle layer**: Medium pace, medium morphing
3. **Inner core**: Fastest pulse, subtle intensity changes

### State Transitions

State changes use the same 2.5s easing as background:

```
cubic-bezier(0.25, 0.46, 0.45, 0.94)
```

This creates cohesive, organic feeling across the entire UI.

## Integration Examples

### Home Page (Chat Input)

```tsx
import { AdaptiveOrganicPresence } from "@/components/ambient/AdaptiveOrganicPresence";

export default function Home() {
  const [presenceState, setPresenceState] = useState("idle");

  return (
    <Page>
      <AdaptiveOrganicPresence
        state={presenceState}
        position="bottom-left"
        size={90}
      />

      <AIInput
        onFocus={() => setPresenceState("active")}
        onSubmit={() => setPresenceState("thinking")}
        onResponse={() => setPresenceState("responding")}
        onComplete={() => setPresenceState("idle")}
      />
    </Page>
  );
}
```

### Speak Page (TTS Generation)

```tsx
export default function SpeakPage() {
  const [isGenerating, setIsGenerating] = useState(false);

  const presenceState = isGenerating ? "thinking" : "idle";

  return (
    <Page>
      <OrganicPresence
        show={true}
        position="top-left"
        size={60}
        intensity={0.25}
      />

      <Button
        onClick={async () => {
          setIsGenerating(true);
          await generateSpeech();
          setIsGenerating(false);
        }}
      >
        Generate
      </Button>
    </Page>
  );
}
```

## Performance Considerations

### Lightweight by Design

- **No JavaScript animation**: Uses native CSS/SVG animations
- **GPU accelerated**: Opacity and transform only
- **Single DOM element**: One absolutely positioned div
- **No re-renders**: State changes only affect CSS properties

### Best Practices

✅ **Do:**

- Use one presence indicator per page
- Position away from interactive elements
- Keep size under 120px for subtlety
- Use lower intensity (0.2-0.4) for ambient feel

❌ **Don't:**

- Add multiple overlapping indicators
- Use very large sizes (>150px)
- Set very high intensity (>0.6) - becomes distracting
- Animate position changes - keep it fixed

## Accessibility

- **Purely decorative**: No semantic meaning, purely visual enhancement
- **Respects motion preferences**: Can be disabled with `prefers-reduced-motion`
- **No interaction required**: Doesn't interfere with keyboard/screen readers
- **Optional**: Can be hidden entirely without losing functionality

### Respecting Motion Preferences

```tsx
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export default function MyPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AdaptiveOrganicPresence
      state={prefersReducedMotion ? "idle" : actualState}
    />
  );
}
```

## Customization

### Custom Colors

```tsx
// Theme-aware colors
const color =
  theme === "dark"
    ? "rgb(139, 92, 246)" // purple-500
    : "rgb(59, 130, 246)"; // blue-500

<OrganicPresence color={color} />;
```

### Custom Animation Speed

Modify the component's `dur` attributes:

- Slower (calmer): `6s`, `4.5s`, `3.5s`
- Faster (energetic): `1.5s`, `2s`, `2.5s`

### Custom Shapes

The SVG paths can be modified for different organic shapes:

- More circular (calm)
- More irregular (active)
- Asymmetric (dynamic)

## Compound Effects

This component works best when combined with:

- ✅ Adaptive background dimming
- ✅ Smooth page transitions
- ✅ Thoughtful animation timing
- ✅ Consistent easing curves

Together, these create a revolutionary UI that feels alive and intentional.

## Future Enhancements

Potential additions:

- Particle trail on state change
- Glow intensity variations
- Multiple color layers
- Audio-reactive pulsing
- Pointer-following variant
