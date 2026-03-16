# TTS Token Usage Tracker - Implementation Summary

## What Was Added

### 1. Token Calculator Utility (`/lib/tts/token-calculator.ts`)

A comprehensive utility that:

- Calculates character count and token estimates
- Computes cost estimates based on TTS model pricing
- Supports all available TTS models (OpenAI + ElevenLabs)
- Provides formatting helpers for display

### 2. Token Usage Display Component (`/components/tts/TokenUsageDisplay.tsx`)

Two beautiful, low-key UI components:

#### `TokenUsageDisplay` (Main Component)

Displays three key metrics side-by-side:

- **Characters**: Total character count
- **Est. Tokens**: Estimated token usage
- **Est. Cost**: Estimated generation cost

Features:

- Glass morphism design that blends with the Speak page aesthetic
- Color-coded icons for each metric
- Tooltips with detailed information
- Hover effects for interactivity
- Responsive layout

#### `CompactTokenUsageDisplay` (Compact Version)

A minimal badge showing only the cost estimate, with full details in a tooltip.

### 3. Integration with Speak Page (`/app/speak/page.tsx`)

- Added imports for the token tracker components
- Integrated `TokenUsageDisplay` in the input mode
- Positioned between the textarea and controls for optimal visibility
- Only displays when text is present (non-intrusive)
- Automatically updates as the user types

## Design Philosophy

The implementation follows these principles:

✨ **Beautiful**: Uses glass morphism, gradients, and subtle animations
🎯 **Low-key**: Doesn't call for attention, blends naturally with the UI
📊 **Insightful**: Provides readily viewable deeper insights via tooltips
⚡ **Performant**: Uses React.useMemo to prevent unnecessary calculations
📱 **Responsive**: Adapts to different screen sizes

## Usage Location

The token usage display appears in the Speak page:

```
/app/speak/page.tsx (Main TTS interface)
```

It's positioned:

1. **After** the textarea input
2. **After** error messages (if any)
3. **Before** the controls row (model selector, switches, generate button)

This placement ensures:

- Visibility without obstruction
- Natural reading flow
- Context-appropriate positioning

## Cost Estimates

Current pricing (per million characters):

- **OpenAI GPT-4o Mini TTS**: $15
- **ElevenLabs Flash v2.5**: $100
- **ElevenLabs Multilingual v2**: $300
- **ElevenLabs v3**: $400

## Key Features

1. **Real-time calculation**: Updates as you type
2. **Model-aware pricing**: Automatically adjusts based on selected model
3. **Formatted display**: Smart formatting for very small costs (<$0.001)
4. **Tooltips**: Hover for detailed information about each metric
5. **Conditional rendering**: Only shows when there's text to analyze
6. **Tabular numbers**: Uses monospace digits for better readability

## Example Display

When you type "Hello, world!" with ElevenLabs Flash v2.5:

```
[Type Icon] Characters: 13
[Zap Icon] Est. Tokens: 13
[Dollar Icon] Est. Cost: <$0.001
```

For longer text (e.g., 5000 characters):

```
[Type Icon] Characters: 5,000
[Zap Icon] Est. Tokens: 5,000
[Dollar Icon] Est. Cost: $0.500
```

## Future Enhancements

Potential improvements:

- Add historical cost tracking across sessions
- Show cost comparison between models
- Add budget warnings for large texts
- Export cost reports
- Track cumulative spend
