# TTS Token Usage Tracker

A beautiful, low-key UI component that displays token usage and cost estimates for Text-to-Speech generation.

## Features

- **Real-time calculation**: Automatically calculates tokens and costs as you type
- **Multi-model support**: Works with OpenAI and ElevenLabs models
- **Beautiful design**: Uses glass morphism and subtle animations
- **Low-key presentation**: Informative without being distracting
- **Responsive**: Adapts to different screen sizes

## Components

### `TokenUsageDisplay`

The main component that displays three key metrics:

- **Characters**: Total character count
- **Est. Tokens**: Estimated token count (1:1 ratio for TTS)
- **Est. Cost**: Estimated cost based on model pricing

Usage:

```tsx
import { TokenUsageDisplay } from "@/components/tts/TokenUsageDisplay";
import { TTSModel } from "@/lib/tts/token-calculator";

<TokenUsageDisplay text={inputText} model={selectedModel as TTSModel} />;
```

### `CompactTokenUsageDisplay`

A minimal version that shows only the cost estimate with a tooltip containing full details.

Usage:

```tsx
import { CompactTokenUsageDisplay } from "@/components/tts/TokenUsageDisplay";

<CompactTokenUsageDisplay text={inputText} model={selectedModel as TTSModel} />;
```

## Supported Models

### OpenAI

- `gpt-4o-mini-tts`: $15 per million characters

### ElevenLabs

- `eleven_flash_v2_5`: $100 per million characters (Flash tier)
- `eleven_multilingual_v2`: $300 per million characters (Pro tier)
- `eleven_v3`: $400 per million characters (Premium tier)

## Pricing Updates

To update pricing, edit `/lib/tts/token-calculator.ts`:

```typescript
const PRICING_CONFIG: Record<
  TTSModel,
  {
    costPerMillionChars: number;
    provider: string;
    displayName: string;
  }
> = {
  "gpt-4o-mini-tts": {
    costPerMillionChars: 15, // Update this value
    provider: "OpenAI",
    displayName: "GPT-4o Mini TTS",
  },
  // ... other models
};
```

## Design Philosophy

The component follows these design principles:

1. **Subtle presence**: Uses glass morphism and muted colors to blend naturally
2. **Contextual information**: Tooltips provide deeper insights without cluttering
3. **Responsive design**: Adapts layout based on screen size
4. **Progressive disclosure**: Shows essential info at a glance, details on hover
5. **Visual hierarchy**: Uses color, size, and spacing to guide attention

## Implementation Details

### Token Calculation

- Character count is exact
- Token estimation uses 1:1 ratio (common for TTS models)
- Cost calculation: `(characters / 1,000,000) * costPerMillionChars`

### Performance

- Uses `useMemo` to prevent unnecessary recalculations
- Only renders when text is present
- Tooltip loading is delayed to prevent accidental triggers

### Accessibility

- Includes ARIA labels via tooltips
- Keyboard navigable
- Clear visual feedback on hover
- Color contrast meets WCAG standards
