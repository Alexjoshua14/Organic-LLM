# Adaptive Background System

A smart background system that automatically reduces its visual intensity when the cursor hovers over important UI elements, ensuring text and controls remain highly visible.

## How It Works

The `AdaptiveLiquidChrome` component tracks cursor position and detects when hovering over elements marked with the `data-dim-background` attribute. When hovering, it smoothly reduces the background opacity to prevent visual interference.

## Features

- **Automatic dimming**: Background fades when cursor hovers over important elements
- **Intentional delay**: Holds dimmed state for ~3 seconds after hover, creating a sense of "readiness"
- **Organic transitions**: 2.5s sine wave easing for natural, breathing feel
- **Dynamic detection**: Uses MutationObserver to handle dynamically added elements
- **Performance optimized**: Uses CSS opacity instead of recreating WebGL context
- **Configurable intensity**: Adjust how much the background dims

## Usage

### 1. Import the Component

```tsx
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
```

### 2. Add to Your Page

```tsx
export default function MyPage() {
  return (
    <Page>
      <AdaptiveLiquidChrome
        speed={0.08} // Background animation speed
        dimIntensity={0.7} // 0-1, how much to dim (0.7 = reduce to 30% opacity)
        dimOnHover={true} // Enable/disable dimming feature
      />
      {/* Your content */}
    </Page>
  );
}
```

### 3. Mark Elements for Dimming

Add the `data-dim-background` attribute to any element that should trigger background dimming:

```tsx
{
  /* Single element */
}
<Button data-dim-background>Click me</Button>;

{
  /* Wrapper (dims when hovering any child) */
}
<div data-dim-background>
  <Textarea />
  <Button>Submit</Button>
</div>;

{
  /* Multiple elements */
}
<div>
  <input data-dim-background />
  <button data-dim-background>Go</button>
</div>;
```

## Configuration

### Props

| Prop           | Type      | Default | Description                                                                          |
| -------------- | --------- | ------- | ------------------------------------------------------------------------------------ |
| `speed`        | `number`  | `0.03`  | Background animation speed (lower = slower)                                          |
| `dimIntensity` | `number`  | `0.4`   | How much to dim (0-1, where 1 = fully dimmed)                                        |
| `dimOnHover`   | `boolean` | `true`  | Enable/disable automatic dimming                                                     |
| `restDelay`    | `number`  | `2800`  | Milliseconds to wait before returning to rest (creates intentional, thoughtful feel) |

### Dimming Intensity Examples

```tsx
// Subtle dimming (reduce to 70% opacity)
<AdaptiveLiquidChrome dimIntensity={0.3} />

// Moderate dimming (reduce to 50% opacity)
<AdaptiveLiquidChrome dimIntensity={0.5} />

// Strong dimming (reduce to 30% opacity)
<AdaptiveLiquidChrome dimIntensity={0.7} />

// Maximum dimming (reduce to 10% opacity)
<AdaptiveLiquidChrome dimIntensity={0.9} />
```

## Current Implementation

### Home Page

- **Dimming**: 45% intensity (background reduces to 55% opacity)
- **Rest delay**: 2.4 seconds (quick but thoughtful)
- **Transition**: 2.5s sine wave easing
- **Protected zones**: Main input area
- **Speed**: 0.03 (very subtle movement)

### Speak Page

- **Dimming**: 40% intensity (background reduces to 60% opacity)
- **Rest delay**: 3.2 seconds (longer wait, like processing/thinking)
- **Transition**: 2.5s sine wave easing
- **Protected zones**:
  - Text input textarea
  - Model selector dropdown
  - Generate speech button
  - Text display area
  - Control buttons (Play, Edit, Download, etc.)
- **Speed**: 0.08 (gentle movement)

## Technical Details

### How Dimming Works

1. **Detection**: MutationObserver watches for elements with `data-dim-background`
2. **Event Listeners**: Adds mouseenter/mouseleave handlers to each element
3. **Immediate Dim**: On hover, background immediately begins 2.5s transition to dimmed state
4. **Intentional Hold**: On leave, background stays dimmed for `restDelay` milliseconds
5. **Gentle Return**: After delay, background smoothly returns to ambient state over 2.5s
6. **State Management**: Uses setTimeout for delay, clears on re-hover for fluid interaction
7. **Cleanup**: Removes listeners and clears timeouts on unmount

### Performance Considerations

- **CSS-based**: Uses opacity transitions instead of recreating WebGL context
- **Hardware accelerated**: Uses `will-change: opacity` for smooth animations
- **Efficient observation**: MutationObserver only tracks DOM changes, not every mousemove
- **No re-renders**: State change only affects opacity, not entire component tree

### Browser Compatibility

- Modern browsers with MutationObserver support (all current browsers)
- Graceful degradation if MutationObserver is unavailable
- Works with touch devices (no dimming, as there's no hover state)

## Design Philosophy

The adaptive background follows these principles:

1. **Non-intrusive**: Background is subtle by default
2. **Contextual awareness**: Automatically steps back when focus is on content
3. **Smooth transitions**: Never jarring or distracting
4. **Intentional timing**: Holds dimmed state after hover, creating a sense of readiness and anticipation
5. **Organic feel**: Uses breathing-like transitions (2.5s) and thoughtful delays (~3s)
6. **User-centric**: Prioritizes readability over visual flair
7. **Progressive enhancement**: Works without dimming if JS is disabled

### The "Ready and Waiting" Effect

The ~3 second delay before returning to rest is intentional and thoughtful:

- **Feels alive**: Like the UI is "holding its breath" and paying attention
- **Creates anticipation**: Similar to how an LLM waits before responding
- **Reduces distraction**: Prevents rapid flickering when moving between elements
- **Compounds with other UX**: Small details like this create revolutionary interfaces

This is not just a technical feature - it's about imbuing personality into the interface.

## Best Practices

### When to Use `data-dim-background`

✅ **Do use on:**

- Text input fields
- Buttons and interactive controls
- Dropdown menus and selects
- Text display areas
- Modal dialogs and overlays
- Form containers

❌ **Don't use on:**

- Static text that's already highly visible
- Background decorative elements
- Empty spacer divs
- Navigation bars (usually have their own backgrounds)

### Placement Strategy

```tsx
// Good: Wrap the interactive container
<div data-dim-background>
  <textarea />
  <button>Submit</button>
</div>

// Also good: Individual critical elements
<button data-dim-background>Important Action</button>

// Avoid: Over-marking (causes too much dimming)
<div data-dim-background>
  <div data-dim-background>
    <button data-dim-background>Button</button>
  </div>
</div>
```

## Troubleshooting

### Background doesn't dim

- Check if `dimOnHover={true}` is set
- Verify `data-dim-background` attribute is present
- Check browser console for errors
- Ensure element is actually receiving hover events

### Dimming is too subtle/strong

- Adjust `dimIntensity` prop (0-1 range)
- Higher values = more dimming
- Try values between 0.5-0.8 for best results

### Transition feels laggy

- Reduce transition duration in component (currently 0.4s)
- Check if hardware acceleration is enabled
- Ensure no other heavy animations are running

### Works on some elements but not others

- MutationObserver might not have detected new elements yet
- Try adding `data-dim-background` to parent container instead
- Check if element is visible and not display:none

## Future Enhancements

Potential improvements:

- Distance-based dimming (dim more when closer to element)
- Custom transition curves per element
- Support for focus events (keyboard navigation)
- Zone-based dimming (dim entire regions)
- Animation pause on hover option
