# TTS Token Usage Tracker - Maintenance Guide

## Quick Reference for Updates

### Adding a New Model

1. **Update Type Definition** (`/lib/tts/token-calculator.ts`)

```typescript
export type TTSModel =
  | "gpt-4o-mini-tts"
  | "eleven_multilingual_v2"
  | "eleven_flash_v2_5"
  | "eleven_v3"
  | "your_new_model_here"; // ← Add here
```

2. **Add Pricing Configuration** (`/lib/tts/token-calculator.ts`)

```typescript
const PRICING_CONFIG: Record<TTSModel, {...}> = {
  // ... existing models
  "your_new_model_here": {
    costPerMillionChars: 250,  // Your pricing
    provider: "ProviderName",
    displayName: "Model Display Name",
  },
};
```

3. **Add to Model Selector** (`/components/chat/speech-model-selector.tsx`)

```typescript
const availableModels: SpeechModel[] = [
  // ... existing models
  {
    key: "your_new_model_here",
    label: "Model Display Name",
    provider: "ProviderName",
  },
];
```

### Updating Existing Model Pricing

Edit `/lib/tts/token-calculator.ts`:

```typescript
"model_name": {
  costPerMillionChars: NEW_PRICE,  // ← Update this number
  provider: "ProviderName",
  displayName: "Display Name",
},
```

**Example**: To update GPT-4o Mini pricing from $15 to $20 per million:

```typescript
"gpt-4o-mini-tts": {
  costPerMillionChars: 20,  // Changed from 15
  provider: "OpenAI",
  displayName: "GPT-4o Mini TTS",
},
```

### Changing Token Calculation Logic

Currently uses 1:1 character-to-token ratio. To change:

Edit `/lib/tts/token-calculator.ts`:

```typescript
export function calculateTokenUsage(
  text: string,
  model: TTSModel,
): TokenUsageData {
  const characterCount = text.length;

  // Current: 1:1 ratio
  const estimatedTokens = characterCount;

  // Alternative: Use a multiplier
  const estimatedTokens = Math.ceil(characterCount * 1.5);

  // Alternative: Use a more complex algorithm
  const estimatedTokens = estimateTokensComplex(text);

  // ... rest of function
}
```

### Customizing Display Format

#### Change Number Formatting

Edit `/lib/tts/token-calculator.ts`:

```typescript
export function formatNumber(num: number): string {
  // Current: US locale with commas
  return num.toLocaleString();

  // Alternative: Different locale
  return num.toLocaleString("de-DE");

  // Alternative: No formatting
  return num.toString();
}
```

#### Change Cost Formatting

Edit `/lib/tts/token-calculator.ts`:

```typescript
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.001) return "<$0.001"; // ← Change threshold
  if (cost < 1) return `$${cost.toFixed(3)}`; // ← Change decimals
  return `$${cost.toFixed(2)}`;
}
```

### Customizing UI Appearance

#### Change Colors

Edit `/components/tts/TokenUsageDisplay.tsx`:

```typescript
const metrics = [
  {
    icon: Type,
    label: "Characters",
    value: formatNumber(usageData.characterCount),
    tooltip: `Total character count in your text`,
    color: "text-blue-500/80", // ← Change color
  },
  // ... other metrics
];
```

#### Change Icon Size

Edit `/components/tts/TokenUsageDisplay.tsx`:

```typescript
<Icon
  className={`w-3.5 h-3.5 ${metric.color} opacity-70`}  // ← w-3.5 h-3.5
  strokeWidth={2.5}  // ← Change stroke width
/>
```

#### Change Glass Effect

Edit `/components/tts/TokenUsageDisplay.tsx`:

```typescript
<div
  className={`
    ${glass()}  // ← Uses design system primitive
    rounded-lg  // ← Change border radius
    px-4 py-2.5  // ← Change padding
    border border-white/10  // ← Change border opacity
    backdrop-blur-md  // ← Change blur amount
    ${className}
  `}
>
```

### Disabling the Component

To temporarily disable without removing code:

#### Option 1: Comment out in Speak page

Edit `/app/speak/page.tsx`:

```typescript
{
  /* Token Usage Display */
}
{
  /* inputText.trim() && (
  <div className="flex justify-center">
    <TokenUsageDisplay
      model={selectedModel as TTSModel}
      text={inputText}
    />
  </div>
) */
}
```

#### Option 2: Add feature flag

```typescript
const SHOW_TOKEN_USAGE = false;  // ← Add at top of file

// Then in JSX:
{SHOW_TOKEN_USAGE && inputText.trim() && (
  <div className="flex justify-center">
    <TokenUsageDisplay
      model={selectedModel as TTSModel}
      text={inputText}
    />
  </div>
)}
```

### Testing Changes

After making changes:

1. **Check TypeScript types**

```bash
npm run build
```

2. **Check linting**

```bash
npm run lint
```

3. **Manual testing checklist**

- [ ] Empty textarea (component should hide)
- [ ] Type some text (component should appear)
- [ ] Switch models (cost should update)
- [ ] Very short text (check <$0.001 display)
- [ ] Long text (check comma formatting)
- [ ] Hover each metric (tooltips should appear)
- [ ] Mobile view (responsive layout)

### Common Issues & Fixes

#### Component doesn't appear

- Check if `inputText.trim()` has content
- Verify imports are correct
- Check console for errors

#### Wrong cost calculation

- Verify `PRICING_CONFIG` has correct values
- Check `costPerMillionChars` calculation
- Ensure model key matches exactly

#### Tooltip doesn't show

- Verify `@heroui/tooltip` is installed
- Check tooltip delay setting
- Ensure proper tooltip wrapper

#### Styling looks wrong

- Verify `glass()` function is imported
- Check Tailwind classes are valid
- Ensure backdrop-blur is supported

### File Locations Quick Reference

```
/lib/tts/
  └── token-calculator.ts         # Core calculation logic

/components/tts/
  └── TokenUsageDisplay.tsx       # UI component

/app/speak/
  └── page.tsx                    # Integration point

/components/chat/
  └── speech-model-selector.tsx  # Model selection

/docs/
  ├── tts-token-tracker.md              # Full documentation
  ├── tts-token-tracker-summary.md      # Quick summary
  ├── tts-token-tracker-visual-guide.md # Visual guide
  └── tts-token-tracker-maintenance.md  # This file
```

### Getting Help

If you need to modify the component:

1. Read the full documentation in `/docs/tts-token-tracker.md`
2. Check the visual guide for UI details
3. Look at similar components in `/components/` for patterns
4. Test changes in development mode first

### Version History

- **v1.0** (Jan 2026): Initial implementation
  - Token calculation utility
  - Main display component
  - Compact variant
  - Integration with Speak page
