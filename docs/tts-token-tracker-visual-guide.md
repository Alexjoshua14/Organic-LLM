# TTS Token Usage Tracker - Visual Guide

## Component Appearance

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     Speak Page Header                        │
│                      "Prometheus"                            │
│                   Speech Generation                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  [Textarea Input Area]                               │  │
│  │                                                       │  │
│  │  Enter your text here...                             │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  📝 Characters | ⚡ Est. Tokens | 💵 Est. Cost      │  │
│  │     1,234      |     1,234      |    $0.123          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ☑ Process Text for Speech  │  [Model Selector ▼]   │  │
│  │                             │  [Generate Speech →]  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Visual Design Details

### Colors & Styling

- **Background**: Glass morphism with backdrop blur
- **Border**: Subtle white/10 opacity border
- **Icons**: Color-coded for visual hierarchy
  - Blue (Type): Characters
  - Purple (Zap): Tokens
  - Emerald (Dollar): Cost
- **Typography**:
  - Labels: 10px uppercase, muted foreground, tracking-wide
  - Values: 14px semibold, tabular-nums for alignment

### Responsive Behavior

#### Desktop (>768px)

```
┌───────────────────────────────────────────────────┐
│  📝 Chars │ ⚡ Tokens │ 💵 Cost                   │
│   1,234   │   1,234   │  $0.123                   │
└───────────────────────────────────────────────────┘
```

#### Mobile (<768px)

```
┌─────────────────────────┐
│  📝 Chars │ ⚡ Tokens   │
│   1,234   │   1,234     │
│                          │
│     💵 Cost: $0.123     │
└─────────────────────────┘
```

## Interactive States

### Default State

- Subtle presence with muted colors
- Icons at 70% opacity
- Smooth backdrop blur

### Hover State

```
┌───────────────────────────────────────────────────┐
│  📝 CHARACTERS ← [Tooltip appears]                │
│     1,234        "Total character count..."       │
│  ↑ Scale: 105%                                    │
└───────────────────────────────────────────────────┘
```

- Metric scales up to 105%
- Tooltip appears after 300ms
- Cursor changes to help cursor

### Tooltip Content

```
┌─────────────────────────────────────────┐
│  Total character count in your text     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Estimated tokens for ElevenLabs        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Estimated cost at $0.0001 per char     │
└─────────────────────────────────────────┘
```

## Component Visibility

### Shows When:

✅ User has typed text in the textarea
✅ Text is not just whitespace

### Hidden When:

❌ Textarea is empty
❌ Text is only whitespace

## Cost Formatting Examples

| Character Count | Model           | Display Cost |
| --------------- | --------------- | ------------ |
| 10              | GPT-4o Mini     | <$0.001      |
| 100             | GPT-4o Mini     | <$0.001      |
| 1,000           | GPT-4o Mini     | $0.015       |
| 10,000          | Flash v2.5      | $1.000       |
| 50,000          | Multilingual v2 | $15.000      |

## Animation & Transitions

### Entrance Animation

- Fades in when text becomes non-empty
- Duration: 200ms
- Easing: ease-in-out

### Hover Animation

- Scale: 100% → 105%
- Duration: 200ms
- Easing: ease-in-out

### Value Updates

- Numbers update instantly (no animation)
- Uses tabular-nums for stable layout

## Accessibility Features

### Keyboard Navigation

- Tab to focus each metric
- Tooltips appear on keyboard focus
- Clear focus indicators

### Screen Readers

- Semantic HTML structure
- ARIA labels via tooltips
- Meaningful alt text for icons

### Color Contrast

- Text meets WCAG AA standards
- Icons have 70% opacity for subtlety
- High contrast on hover

## Integration Points

The component automatically:

1. **Listens to** `inputText` state changes
2. **Reads** `selectedModel` to determine pricing
3. **Calculates** metrics using `useMemo` for performance
4. **Renders** only when conditions are met

No manual setup required - just import and use!

## Compact Version

For tight spaces, use `CompactTokenUsageDisplay`:

```
┌──────────────┐
│ 💵 $0.123   │  ← Hover for full details
└──────────────┘
```

Tooltip shows all three metrics in a table format.
