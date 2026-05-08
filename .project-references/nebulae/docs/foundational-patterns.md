# Foundational Patterns

This document catalogs reusable UX/UI patterns and micro-interactions that enhance user experience across Nebulae. These patterns are designed to be consistent, performant, and easy to implement.

## Slider Animation Pattern

### Purpose

Smoothly animate numeric slider values when resetting to defaults or transitioning between states. This pattern provides visual feedback that makes state changes feel intentional and polished.

### When to Use

- **Reset buttons**: When resetting form controls or configuration panels
- **State transitions**: When programmatically changing slider values
- **Preset application**: When applying saved configurations
- **Undo/redo**: When reverting to previous states

### Implementation

The pattern uses `requestAnimationFrame` to smoothly interpolate values over time with a cubic ease-out easing function.

**Core Pattern:**

```typescript
const handleReset = () => {
  const duration = 300; // milliseconds
  const startTime = performance.now();

  // Default/target values
  const defaults = {
    blur: 24,
    backgroundOpacity: 40,
    borderOpacity: 20,
    shadowIntensity: 50,
  };

  // Starting values (capture current state)
  const start = {
    blur,
    backgroundOpacity,
    borderOpacity,
    shadowIntensity,
  };

  // Easing function (cubic ease-out)
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOut(progress);

    // Interpolate values
    setBlur(Math.round(start.blur + (defaults.blur - start.blur) * eased));
    setBackgroundOpacity(
      Math.round(
        start.backgroundOpacity +
          (defaults.backgroundOpacity - start.backgroundOpacity) * eased
      )
    );
    setBorderOpacity(
      Math.round(
        start.borderOpacity +
          (defaults.borderOpacity - start.borderOpacity) * eased
      )
    );
    setShadowIntensity(
      Math.round(
        start.shadowIntensity +
          (defaults.shadowIntensity - start.shadowIntensity) * eased
      )
    );

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Ensure final values are exact
      setBlur(defaults.blur);
      setBackgroundOpacity(defaults.backgroundOpacity);
      setBorderOpacity(defaults.borderOpacity);
      setShadowIntensity(defaults.shadowIntensity);
    }
  };

  // Set non-animated values immediately (booleans, strings)
  setBorder(true);
  setBorderRadius("2xl");
  setInteractive(true);

  // Start animation
  requestAnimationFrame(animate);
};
```

### Key Components

1. **Duration**: Typically 300ms for slider animations. Adjust based on distance and desired feel.
2. **Easing Function**: Cubic ease-out (`1 - (1-t)³`) provides natural deceleration. Other options:
   - Linear: `t`
   - Ease-in: `t³`
   - Ease-in-out: `t < 0.5 ? 4t³ : 1 - Math.pow(-2t + 2, 3) / 2`
3. **Interpolation**: Linear interpolation with easing: `start + (target - start) * eased`
4. **Final Values**: Always set exact target values at completion to avoid rounding errors

### Benefits

- **Visual Feedback**: Users see the transition, making state changes clear
- **Polished Feel**: Smooth animations elevate the perceived quality
- **Performance**: `requestAnimationFrame` ensures smooth 60fps animations
- **Accessibility**: Can be disabled via `prefers-reduced-motion`

### Considerations

- **Multiple Values**: Animate all related values simultaneously for cohesive feel
- **Non-Numeric Values**: Set booleans and strings immediately (no animation needed)
- **Interruption**: If user interacts during animation, consider canceling or queuing
- **Reduced Motion**: Respect `prefers-reduced-motion` media query for accessibility

### Example Usage

See `src/app/experiments/glass-surface/page.tsx` for a complete implementation in the Glass Surface experiment.

### Future Enhancements

- Extract into reusable hook: `useAnimatedReset(values, defaults, duration)`
- Support for different easing functions via configuration
- Automatic `prefers-reduced-motion` detection
- Animation cancellation on user interaction

---

## Future Patterns

This section will document additional foundational UX/UI patterns as they are introduced:

### Form Validation Animations

_Placeholder for form validation animation patterns_

### Loading States

_Placeholder for loading state patterns_

### Transition Patterns

_Placeholder for page/component transition patterns_

### Focus Management

_Placeholder for focus management patterns_

### Error Handling UI

_Placeholder for error state patterns_
