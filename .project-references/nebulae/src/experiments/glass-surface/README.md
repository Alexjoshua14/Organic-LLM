# Glass Surface

A foundational experiment exploring the liquid glass aesthetic with configurable properties, subtle depth, and gentle micro-interactions.

## Purpose

This experiment establishes baseline interaction patterns for Nebulae:

- Glass/matte surfaces with backdrop blur
- Dimensional depth through shadows and layering
- Gentle, organic motion on interaction
- Calm but alive aesthetic
- Configurable visual properties for prototyping

## Architecture

### Component Structure

```bash
components/
├── GlassSurfacePrototype.tsx  # Main glass surface component with configurable props
└── GlassSurfaceControls.tsx   # Control panel for adjusting all surface properties
```

### State Management

**Glass Surface Properties:**

- `blur`: Backdrop blur intensity (0-100px)
- `backgroundOpacity`: Background transparency (0-100%)
- `border`: Show/hide border toggle
- `borderOpacity`: Border transparency (0-100%)
- `shadowIntensity`: Shadow depth multiplier (0-100%)
- `borderRadius`: Corner radius (none, sm, md, lg, 2xl)
- `interactive`: Enable/disable hover effects

**Default Values:**

- `blur`: 24px
- `backgroundOpacity`: 40%
- `border`: true
- `borderOpacity`: 20%
- `shadowIntensity`: 50%
- `borderRadius`: "2xl"
- `interactive`: true

## Component API

### GlassSurfacePrototype

The main component that renders a glass surface with configurable properties.

**Props:**

```typescript
interface GlassSurfacePrototypeProps {
  blur?: number;              // 0-100, backdrop-blur value in pixels
  backgroundOpacity?: number; // 0-100, background opacity percentage
  border?: boolean;           // Show/hide border
  borderOpacity?: number;     // 0-100, border opacity percentage
  shadowIntensity?: number;   // 0-100, shadow intensity multiplier
  borderRadius?: string;      // "none" | "sm" | "md" | "lg" | "2xl"
  interactive?: boolean;      // Enable hover effects
  className?: string;         // Additional CSS classes
  children?: React.ReactNode; // Content to display inside surface
}
```

**Features:**

- Automatic dark mode detection via `MutationObserver`
- Dynamic style calculation based on dark/light mode
- Smooth hover transitions when `interactive` is enabled
- Responsive to all prop changes

**Usage Example:**

```tsx
import { GlassSurfacePrototype } from "@/experiments/glass-surface/components/GlassSurfacePrototype";

<GlassSurfacePrototype
  blur={24}
  backgroundOpacity={40}
  border={true}
  borderOpacity={20}
  shadowIntensity={50}
  borderRadius="2xl"
  interactive={true}
>
  <div>Your content here</div>
</GlassSurfacePrototype>
```

### GlassSurfaceControls

Control panel component for adjusting all glass surface properties.

**Props:**

```typescript
interface GlassSurfaceControlsProps {
  blur: number;
  onBlurChange: (blur: number) => void;
  backgroundOpacity: number;
  onBackgroundOpacityChange: (opacity: number) => void;
  border: boolean;
  onBorderChange: (border: boolean) => void;
  borderOpacity: number;
  onBorderOpacityChange: (opacity: number) => void;
  shadowIntensity: number;
  onShadowIntensityChange: (intensity: number) => void;
  borderRadius: string;
  onBorderRadiusChange: (radius: string) => void;
  interactive: boolean;
  onInteractiveChange: (interactive: boolean) => void;
  onReset: () => void;
}
```

**Controls:**

- **Backdrop Blur Slider**: 0-100px range
- **Background Opacity Slider**: 0-100% range
- **Border Toggle**: Show/hide border switch
- **Border Opacity Slider**: 0-100% range (shown when border is enabled)
- **Shadow Intensity Slider**: 0-100% range
- **Border Radius Select**: None, Small, Medium, Large, Extra Large
- **Interactive Toggle**: Enable/disable hover effects switch
- **Copy Settings Button**: Copies current configuration as JSON to clipboard
- **Reset Button**: Animates all sliders back to default values (see [Slider Animation Pattern](../../../docs/foundational-patterns.md#slider-animation-pattern))

## Interaction Patterns

### Hover State (when `interactive={true}`)

- **Scale**: Subtle scale up (1.02x)
- **Lift**: Gentle translateY (-4px)
- **Shadow**: Depth increase with enhanced shadow
- **Glow**: Gradient glow reveal from top-left
- **Duration**: 350ms smooth transition with ease-out timing

### Visual Properties

- **Surface**: Semi-transparent white with backdrop blur
- **Border**: Subtle white overlay for edge definition
- **Corners**: Configurable radius (default: 2xl / 24px)
- **Shadow**: Multi-layer shadow system for dimensional depth
- **Motion**: 350ms duration with ease-out timing

### Dark Mode Behavior

- Background opacity automatically reduced to ~12.5% of light mode value
- Border opacity maintained at same percentage
- Shadow intensity increased for better depth perception
- All calculations happen automatically via `MutationObserver`

## Design Tokens Used

From `src/foundations/theme/tokens.css`:

- `--duration-slow` (350ms) - transition duration
- `--ease-out` (organic easing) - transition timing
- `--radius-2xl` (1.5rem) - default corner radius
- Neutral color scale - for text and backgrounds
- Glass surface utilities (`.glass-surface`, `.glass-input`) - reusable CSS classes

## Implementation Details

### Dark Mode Detection

The component uses a `MutationObserver` to watch for changes to the `document.documentElement.classList`, automatically updating styles when dark mode is toggled.

### Dynamic Style Calculation

All visual properties are calculated dynamically:

- Background opacity: `rgba(255, 255, 255, opacity)` in light mode, reduced in dark mode
- Border color: `rgba(255, 255, 255, borderOpacity)`
- Shadow: Multi-layer shadows with intensity multipliers
- Backdrop filter: Applied via inline style to support arbitrary pixel values

### Reset Animation

The reset functionality uses `requestAnimationFrame` to smoothly animate slider values back to defaults. See [Foundational Patterns](../../../docs/foundational-patterns.md#slider-animation-pattern) for implementation details.

## Visual Hierarchy

**Depth Layers:**

1. Glass surface (highest depth with backdrop blur)
2. Content inside surface (relative z-10)
3. Hover glow overlay (absolute, pointer-events-none)

**Spacing:**

- Internal padding: `p-8` (2rem)
- Content gap: `gap-6` (1.5rem)
- Control panel: `gap-5` (1.25rem) between controls

## Notes

**Future Exploration Ideas:**

- Click/active states
- Nested surfaces
- Color-tinted glass variants
- Motion paths beyond simple lift
- Preset configurations (frosted, clear, matte)
- Export configuration as design tokens

**Potential Improvements:**

- Animation presets (gentle, dramatic, subtle)
- Real-time preview of parameter changes
- Configuration import/export
- Accessibility enhancements (reduced motion support)

