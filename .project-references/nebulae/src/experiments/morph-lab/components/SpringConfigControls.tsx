"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { Button } from "@/components/base";
import { GlassOverlay } from "@/components/base";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SpringConfig } from "@/lib/morphTest/schemas/springSolverSchemas";
import { SPRING_PRESETS, SpringPreset } from "@/lib/morphTest/constants";
import { ChevronDownIcon } from "lucide-react";

interface SpringConfigControlsProps {
  config: SpringConfig;
  onConfigChange: (config: SpringConfig) => void;
  onPresetSelect: (preset: SpringPreset | "custom") => void;
  activePreset: SpringPreset | "custom";
}

export function SpringConfigControls({
  config,
  onConfigChange,
  onPresetSelect,
  activePreset,
}: SpringConfigControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const [hoveredPreset, setHoveredPreset] = useState<SpringPreset | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Function to update overlay position
  const updateOverlayPosition = useCallback(() => {
    if (activePreset === "custom" || !containerRef.current) {
      setOverlayStyle({ opacity: 0, pointerEvents: "none" });
      return;
    }

    const activeButton = buttonRefs.current[activePreset];
    if (!activeButton) {
      setOverlayStyle({ opacity: 0, pointerEvents: "none" });
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    // Calculate base position
    const baseTop = buttonRect.top - containerRect.top;
    const baseLeft = buttonRect.left - containerRect.left;

    // Calculate hover offset (5px towards hovered button)
    let offsetX = 0;
    let offsetY = 0;

    if (hoveredPreset && hoveredPreset !== activePreset) {
      const hoveredButton = buttonRefs.current[hoveredPreset];
      if (hoveredButton) {
        const hoveredRect = hoveredButton.getBoundingClientRect();
        const hoveredTop = hoveredRect.top - containerRect.top;
        const hoveredLeft = hoveredRect.left - containerRect.left;

        // Calculate direction vector from active to hovered
        const dx = hoveredLeft - baseLeft;
        const dy = hoveredTop - baseTop;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Normalize and scale to 5px
          offsetX = (dx / distance) * 5;
          offsetY = (dy / distance) * 5;
        }
      }
    }

    setOverlayStyle({
      opacity: 1,
      top: `${baseTop + offsetY}px`,
      left: `${baseLeft + offsetX}px`,
      width: `${buttonRect.width}px`,
      height: `${buttonRect.height}px`,
      right: "auto",
      bottom: "auto",
    });
  }, [activePreset, hoveredPreset]);

  // Update overlay position when active preset or hover state changes
  useLayoutEffect(() => {
    updateOverlayPosition();
  }, [activePreset, hoveredPreset]);

  // Update overlay position on window resize
  useEffect(() => {
    const handleResize = () => {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        updateOverlayPosition();
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateOverlayPosition]);

  const handlePresetSelect = (preset: SpringPreset) => {
    onPresetSelect(preset);
    onConfigChange(SPRING_PRESETS[preset]);
  };

  const handleSliderChange = (
    key: keyof SpringConfig,
    value: number
  ) => {
    onConfigChange({
      ...config,
      [key]: value,
    });
    // When manually adjusting, set preset to custom
    if (activePreset !== "custom") {
      onPresetSelect("custom");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Preset Selection Buttons */}
      <div ref={containerRef} className="relative flex gap-10 items-center">
        {Object.entries(SPRING_PRESETS).map(([presetKey, presetConfig]) => {
          const preset = presetKey as SpringPreset;

          return (
            <div
              key={preset}
              ref={(el) => {
                buttonRefs.current[preset] = el;
              }}
              className="relative"
            >
              <Button
                variant="inset"
                size="default"
                onClick={() => handlePresetSelect(preset)}
                onMouseEnter={() => setHoveredPreset(preset)}
                onMouseLeave={() => setHoveredPreset(null)}
                className="capitalize"
              >
                {preset}
              </Button>
            </div>
          );
        })}
        {/* Single sliding glass overlay */}
        {activePreset !== "custom" && (
          <GlassOverlay
            className="transition-all duration-300 ease-out"
            style={overlayStyle}
          />
        )}
      </div>

      {/* Manual Controls Collapsible */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="secondary"
            size="default"
            className="w-full justify-between"
          >
            <span>Manual Configuration</span>
            <ChevronDownIcon
              className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                }`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="flex flex-col gap-4 p-4 rounded-lg border bg-card">
            {/* Stiffness Slider */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="stiffness-slider"
                className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Stiffness: {config.stiffness}
              </label>
              <input
                id="stiffness-slider"
                type="range"
                min="1"
                max="500"
                step="1"
                value={config.stiffness}
                onChange={(e) =>
                  handleSliderChange("stiffness", Number(e.target.value))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
              />
              <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
                <span>1</span>
                <span>500</span>
              </div>
            </div>

            {/* Damping Slider */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="damping-slider"
                className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Damping: {config.damping}
              </label>
              <input
                id="damping-slider"
                type="range"
                min="1"
                max="100"
                step="1"
                value={config.damping}
                onChange={(e) =>
                  handleSliderChange("damping", Number(e.target.value))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
              />
              <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
                <span>1</span>
                <span>100</span>
              </div>
            </div>

            {/* Mass Slider */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="mass-slider"
                className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Mass: {config.mass}
              </label>
              <input
                id="mass-slider"
                type="range"
                min="0.1"
                max="20"
                step="0.1"
                value={config.mass}
                onChange={(e) =>
                  handleSliderChange("mass", Number(e.target.value))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
              />
              <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
                <span>0.1</span>
                <span>20</span>
              </div>
            </div>

            {/* Precision Slider */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="precision-slider"
                className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                Precision: {config.precision}
              </label>
              <input
                id="precision-slider"
                type="range"
                min="0.001"
                max="0.1"
                step="0.001"
                value={config.precision}
                onChange={(e) =>
                  handleSliderChange("precision", Number(e.target.value))
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-accent-nebula"
              />
              <div className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
                <span>0.001</span>
                <span>0.1</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

