# Organic Presence - Integration Examples

## Example 1: Home Page with Simple Presence

Add a subtle, always-visible presence indicator to the home page:

```tsx
// components/pages/home.tsx
import { AIInput } from "../chat-experimental/ai-input";
import Page from "../layout/page";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { OrganicPresence } from "@/components/ambient/OrganicPresence";

export default function Home() {
  return (
    <Page transparentBackground>
      <AdaptiveLiquidChrome dimIntensity={0.45} restDelay={2400} />

      {/* Simple organic presence in corner */}
      <OrganicPresence
        show={true}
        position="bottom-left"
        size={70}
        intensity={0.25}
        color="rgb(139, 92, 246)"
      />

      <div className="fixed inset-0 flex flex-col items-center justify-center h-full w-full gap-10">
        <div
          data-dim-background
          className="flex flex-col items-center justify-center rounded-xl w-full max-w-sm sm:max-w-xl"
        >
          <AIInput />
        </div>
      </div>
    </Page>
  );
}
```

## Example 2: Speak Page with State-Aware Presence

Show presence that responds to generation state:

```tsx
// app/speak/page.tsx
import { useState } from "react";
import { OrganicPresence } from "@/components/ambient/OrganicPresence";

export default function SpeakPage() {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSpeech = async () => {
    setIsGenerating(true);
    try {
      await generateSpeech();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Page>
      {/* Show presence when generating */}
      <OrganicPresence
        show={isGenerating}
        position="top-right"
        size={60}
        intensity={0.35}
        color="rgb(168, 85, 247)"
      />

      {/* Your existing content */}
    </Page>
  );
}
```

## Example 3: Chat with Full State Management

Use `AdaptiveOrganicPresence` for rich state feedback:

```tsx
// app/chat/page.tsx
import { useState } from "react";
import {
  AdaptiveOrganicPresence,
  useOrganicPresenceState,
} from "@/components/ambient/AdaptiveOrganicPresence";

export default function ChatPage() {
  const { state, setActive, setThinking, setResponding, setIdle } =
    useOrganicPresenceState();

  const handleInputFocus = () => {
    setActive();
  };

  const handleInputBlur = () => {
    setIdle();
  };

  const handleSubmit = async (message: string) => {
    setThinking();

    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    });

    setResponding();

    const stream = response.body;
    // ... handle streaming

    // When stream completes
    setIdle();
  };

  return (
    <Page>
      <AdaptiveOrganicPresence
        state={state}
        position="bottom-right"
        size={90}
      />

      <ChatInterface
        onInputFocus={handleInputFocus}
        onInputBlur={handleInputBlur}
        onSubmit={handleSubmit}
      />
    </Page>
  );
}
```

## Example 4: Toggle Visibility Based on User Preference

Allow users to enable/disable the organic presence:

```tsx
// app/settings/page.tsx
import { useState, useEffect } from "react";
import { OrganicPresence } from "@/components/ambient/OrganicPresence";

export default function MyPage() {
  const [showPresence, setShowPresence] = useState(true);

  // Load preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("show-organic-presence");
    if (saved !== null) {
      setShowPresence(JSON.parse(saved));
    }
  }, []);

  const togglePresence = () => {
    const newValue = !showPresence;
    setShowPresence(newValue);
    localStorage.setItem("show-organic-presence", JSON.stringify(newValue));
  };

  return (
    <Page>
      <OrganicPresence show={showPresence} />

      <button onClick={togglePresence}>
        {showPresence ? "Hide" : "Show"} Organic Presence
      </button>
    </Page>
  );
}
```

## Example 5: Multiple Positions for Different States

Use different positions to indicate different activities:

```tsx
export default function ComplexPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);

  return (
    <Page>
      {/* Processing indicator - bottom right */}
      <OrganicPresence
        show={isProcessing}
        position="bottom-right"
        size={80}
        color="rgb(168, 85, 247)" // purple
      />

      {/* Notification indicator - top right */}
      <CompactOrganicPresence
        show={hasNotification}
        position="top-right"
        color="rgb(34, 197, 94)" // green
      />

      {/* Your content */}
    </Page>
  );
}
```

## Example 6: Coordinated with Background Dimming

Create a fully coordinated organic experience:

```tsx
export default function CoordinatedPage() {
  const { state, setActive, setIdle } = useOrganicPresenceState();
  const [inputValue, setInputValue] = useState("");

  return (
    <Page>
      {/* Adaptive background dims on hover */}
      <AdaptiveLiquidChrome dimIntensity={0.4} restDelay={3000} />

      {/* Presence responds to same interactions */}
      <AdaptiveOrganicPresence state={state} />

      {/* Input triggers both systems */}
      <div data-dim-background>
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={setActive}
          onBlur={setIdle}
          placeholder="Type here..."
        />
      </div>
    </Page>
  );
}
```

## Best Practices Summary

### Do's

✅ Use one presence indicator per page
✅ Position away from interactive elements  
✅ Keep size between 50-100px
✅ Use intensity 0.2-0.4 for subtle feel
✅ Match colors to your theme
✅ Coordinate with other organic elements

### Don'ts

❌ Don't add multiple overlapping indicators
❌ Don't use very large sizes (>120px)
❌ Don't place over critical content
❌ Don't animate position changes
❌ Don't make it too intense (>0.5 intensity)

## Quick Integration Checklist

1. Import the component
2. Choose position (usually bottom corners)
3. Set appropriate size (50-100px)
4. Configure intensity (0.2-0.4)
5. Connect to relevant state changes
6. Test visibility against your content
7. Adjust blur/opacity if needed

## Performance Notes

- All examples use absolutely positioned elements
- No layout reflows or shifts
- GPU-accelerated animations only
- Minimal JavaScript (just state changes)
- Can be rendered conditionally for better performance
