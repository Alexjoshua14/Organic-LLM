"use client";

import { useEffect, useRef, useState } from "react";
import { BackLink } from "@/foundations/layout";
import { Badge } from "@/components/ui/badge";
import { GlassSurfacePrototype } from "@/experiments/glass-surface/components/GlassSurfacePrototype";
import { GlassSurfaceControls } from "@/experiments/glass-surface/components/GlassSurfaceControls";

export default function GlassSurface() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Glass surface properties state
  const [blur, setBlur] = useState(24);
  const [backgroundOpacity, setBackgroundOpacity] = useState(40);
  const [border, setBorder] = useState(true);
  const [borderOpacity, setBorderOpacity] = useState(20);
  const [shadowIntensity, setShadowIntensity] = useState(50);
  const [borderRadius, setBorderRadius] = useState("2xl");
  const [interactive, setInteractive] = useState(true);

  // Reset handler with smooth animation
  const handleReset = () => {
    const duration = 300; // milliseconds
    const startTime = performance.now();
    
    // Default values
    const defaults = {
      blur: 24,
      backgroundOpacity: 40,
      borderOpacity: 20,
      shadowIntensity: 50,
    };
    
    // Starting values
    const start = {
      blur,
      backgroundOpacity,
      borderOpacity,
      shadowIntensity,
    };
    
    // Easing function (ease-out)
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOut(progress);
      
      // Interpolate values
      setBlur(Math.round(start.blur + (defaults.blur - start.blur) * eased));
      setBackgroundOpacity(
        Math.round(start.backgroundOpacity + (defaults.backgroundOpacity - start.backgroundOpacity) * eased)
      );
      setBorderOpacity(
        Math.round(start.borderOpacity + (defaults.borderOpacity - start.borderOpacity) * eased)
      );
      setShadowIntensity(
        Math.round(start.shadowIntensity + (defaults.shadowIntensity - start.shadowIntensity) * eased)
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
    
    // Set non-animated values immediately
    setBorder(true);
    setBorderRadius("2xl");
    setInteractive(true);
    
    // Start animation
    requestAnimationFrame(animate);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollPosition = 0;
    let animationFrameId: number;
    let isScrolling = true;

    // Prevent manual scrolling
    const preventScroll = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    container.addEventListener("wheel", preventScroll, { passive: false });
    container.addEventListener("touchmove", preventScroll, { passive: false });
    container.addEventListener("scroll", preventScroll, { passive: false });

    const scroll = () => {
      if (!isScrolling) return;

      const maxScroll = container.scrollHeight - container.clientHeight;

      if (maxScroll <= 0) {
        // Not enough content to scroll, try again later
        animationFrameId = requestAnimationFrame(scroll);
        return;
      }

      scrollPosition += 0.5; // Adjust speed here (pixels per frame)

      if (scrollPosition >= maxScroll) {
        // Reset to top when reaching bottom
        scrollPosition = 0;
        container.scrollTop = 0;
      } else {
        container.scrollTop = scrollPosition;
      }

      animationFrameId = requestAnimationFrame(scroll);
    };

    // Start scrolling
    animationFrameId = requestAnimationFrame(scroll);

    return () => {
      isScrolling = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      container.removeEventListener("wheel", preventScroll);
      container.removeEventListener("touchmove", preventScroll);
      container.removeEventListener("scroll", preventScroll);
    };
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center p-8 pt-14 sm:pt-16 md:pt-20 lg:pt-20 bg-linear-to-br from-neutral-100 via-neutral-50 to-neutral-200 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-800">
      <div className="max-w-6xl w-full space-y-12">
        {/* Back link and Header */}
        <div className="flex flex-col gap-3">
          <BackLink href="/experiments" label="Back to Experiments" />

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-light tracking-tight text-neutral-900 dark:text-neutral-50">
              Glass Surface
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              A simple interactive surface with liquid glass aesthetic
            </p>
          </div>
        </div>

        {/* Split Container with Two Surfaces */}
        <div className="w-full flex justify-center">
          <div className="flex flex-row gap-8 min-h-[400px] max-w-5xl w-full">
            {/* Left Side - Normal Background */}
            <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-900">
              <GlassSurfacePrototype
                blur={blur}
                backgroundOpacity={backgroundOpacity}
                border={border}
                borderOpacity={borderOpacity}
                shadowIntensity={shadowIntensity}
                borderRadius={borderRadius}
                interactive={interactive}
                className="w-full max-w-md"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-neutral-400 to-neutral-600 dark:from-neutral-500 dark:to-neutral-300" />

                  <h2 className="text-2xl font-medium text-neutral-900 dark:text-neutral-50">
                    Interactive Surface
                  </h2>

                  <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    This surface demonstrates the liquid glass aesthetic with subtle depth,
                    gentle motion, and a calm dimensional quality.
                  </p>

                  <div className="pt-4 flex gap-3">
                    <Badge variant="glass-default">Hover me</Badge>
                    <Badge variant="glass-subtle">Gentle lift</Badge>
                  </div>
                </div>
              </GlassSurfacePrototype>
            </div>

            {/* Right Side - Message Thread Background */}
            <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-900 relative overflow-hidden min-h-[400px]">
              {/* Message Thread Background - Auto-scrolling, extends beyond frame */}
              <div
                ref={scrollContainerRef}
                className="absolute inset-0 overflow-y-auto scrollbar-hide pointer-events-none"
              >
                <div className="p-6 -m-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Alex</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        Hey, have you seen the new glass surface component?
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Jordan</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        Not yet! What does it look like?
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Alex</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        It has this beautiful backdrop blur effect. The text behind it gets this soft, frosted look.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Jordan</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        That sounds amazing! Can you show me?
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Alex</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        Sure! Scroll behind the card to see how the blur effect works with different text.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Jordan</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        Wow, that's really cool! The blur makes everything look so smooth.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Alex</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        Yeah, and notice how the text stays readable even through the blur. It's perfect for overlays.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Jordan</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        I can see the messages scrolling behind it. The effect is really elegant.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Alex</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        Exactly! The glass surface creates depth while keeping the content visible. It's a great pattern for modern UIs.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Jordan</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        I'm definitely going to use this in my next project. Thanks for showing me!
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 dark:bg-neutral-700" />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">Alex</div>
                      <div className="text-sm text-neutral-700 dark:text-neutral-300">
                        No problem! Try hovering over the card too - there are some nice interactive effects.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glass Surface Card - Positioned over message thread */}
              <GlassSurfacePrototype
                blur={blur}
                backgroundOpacity={backgroundOpacity}
                border={border}
                borderOpacity={borderOpacity}
                shadowIntensity={shadowIntensity}
                borderRadius={borderRadius}
                interactive={interactive}
                className="w-full max-w-md relative z-10"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-neutral-400 to-neutral-600 dark:from-neutral-500 dark:to-neutral-300" />

                  <h2 className="text-2xl font-medium text-neutral-900 dark:text-neutral-50">
                    Interactive Surface
                  </h2>

                  <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    This surface demonstrates the liquid glass aesthetic with subtle depth,
                    gentle motion, and a calm dimensional quality.
                  </p>

                  <div className="pt-4 flex gap-3">
                    <Badge variant="glass-default">Hover me</Badge>
                    <Badge variant="glass-subtle">Gentle lift</Badge>
                  </div>
                </div>
              </GlassSurfacePrototype>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="max-w-2xl mx-auto">
          <GlassSurfaceControls
            blur={blur}
            onBlurChange={setBlur}
            backgroundOpacity={backgroundOpacity}
            onBackgroundOpacityChange={setBackgroundOpacity}
            border={border}
            onBorderChange={setBorder}
            borderOpacity={borderOpacity}
            onBorderOpacityChange={setBorderOpacity}
            shadowIntensity={shadowIntensity}
            onShadowIntensityChange={setShadowIntensity}
            borderRadius={borderRadius}
            onBorderRadiusChange={setBorderRadius}
            interactive={interactive}
            onInteractiveChange={setInteractive}
            onReset={handleReset}
          />
        </div>

        {/* Notes */}
        <div className="max-w-2xl mx-auto space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
          <div className="space-y-2">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-50">
              Interaction Pattern
            </h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Subtle scale and lift on hover</li>
              <li>Smooth shadow transition for depth</li>
              <li>Gentle gradient glow effect</li>
              <li>350ms duration with ease-out timing</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-50">
              Visual Properties
            </h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Backdrop blur for glass effect</li>
              <li>Semi-transparent surfaces with border</li>
              <li>Organic rounded corners (2xl radius)</li>
              <li>Dimensional shadow system</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

