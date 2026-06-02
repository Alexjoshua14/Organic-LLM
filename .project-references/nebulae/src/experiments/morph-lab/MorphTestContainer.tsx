'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from "@/components/base";
import { BlueRectangle, TallRectangle, RedSquare } from './MorphTest';
import { MorphState } from './types';
import { snapshot, clearInlineStyles } from '@/lib/morphTest/morphUtils';
import { useMorphPhysics } from './hooks/useMorphPhysics';
import { Vector4 } from '@/lib/morphTest/schemas/physicsSchemas';
import { SpringConfig } from '@/lib/morphTest/schemas/springSolverSchemas';
import { DEFAULT_SPRING_CONFIG } from '@/lib/morphTest/constants';

interface MorphTestContainerProps {
  config?: SpringConfig;
}

/**
 * Demo component showcasing morph transitions between different shapes using spring physics.
 * 
 * Allows toggling between a RedSquare and BlueRectangle, with smooth animated transitions
 * that morph both position and size. Uses useMorphPhysics hook to drive the spring-based
 * animations, and useLayoutEffect to measure and coordinate the transitions.
 */
export default function MorphTestContainer({ config = DEFAULT_SPRING_CONFIG }: MorphTestContainerProps) {
  const [state, setState] = useState<MorphState>(MorphState.Red);

  // Stores the previous element's geometry (position and size) to calculate
  // the offset needed when transitioning between states
  const prevRect = useRef<Vector4 | null>(null)

  // Ref to the container element, used as a reference point for calculating
  // relative positions when taking snapshots of the morphing element
  const containerRef = useRef<HTMLDivElement>(null)

  const { elementRef, reset, morphTo } = useMorphPhysics({ config })

  /**
   * Cycles to the next state in sequence (Red -> Blue -> Red -> ...).
   * Used by the cycle button to advance through all available states.
   */
  const handleCycle = () => {
    setState(prev => {
      switch (prev) {
        case MorphState.Red:
          return MorphState.Blue
        case MorphState.Blue:
          return MorphState.Plasma
        case MorphState.Plasma:
          return MorphState.Red
      }
    })
  }

  /**
   * Handles the morph transition when the state changes (Red <-> Blue).
   * Runs synchronously after DOM mutations but before paint, ensuring we can
   * measure the element's natural layout before animations begin.
   * 
   * Process:
   * 1. Clears inline styles to get the element's natural dimensions
   * 2. Takes a snapshot of the new element's position and size
   * 3. If transitioning from a previous state, calculates the offset and
   *    resets the element to the old position, then morphs to the new position/size
   * 4. Saves the current state for the next transition
   */
  useLayoutEffect(() => {
    if (!elementRef.current || !containerRef.current)
      return;

    // Clear any existing transforms and inline size styles to get natural layout
    if (elementRef.current) {
      clearInlineStyles(elementRef.current);
    }

    // Force reflow to ensure layout is updated
    void elementRef.current.offsetHeight;

    const nextState = snapshot(elementRef.current, containerRef.current)

    // Only perform transition if we have a previous state (not the initial render).
    // On first render, prevRect.current is null, so we skip the transition and just
    // save the current state. On subsequent renders, we calculate the offset and animate.
    if (prevRect.current) {
      const initialState = prevRect.current

      console.log(`Initial State: ${JSON.stringify(initialState)}\nNext State: ${JSON.stringify(nextState)}`)

      // Initiate morph
      morphTo({
        x: 0,
        y: 0,
        w: nextState.w,
        h: nextState.h
      })
    } else {
      // On initial render, initialize physics state to match the element's actual position
      // This ensures the first morph starts from the correct position instead of zero
      reset({
        x: 0,
        y: 0,
        w: nextState.w,
        h: nextState.h
      })
    }

    // Save state for next transition
    prevRect.current = nextState
  }, [state, reset, morphTo]);

  return (
    <div
      className="w-full h-full p-6 rounded-2xl bg-transparent shadow-lg min-w-60 min-h-52 relative"
      ref={containerRef}
    >
      {/* Morph element */}
      {state === MorphState.Red
        ? <RedSquare ref={elementRef} />
        : state === MorphState.Blue ?
          <BlueRectangle ref={elementRef} />
          : <TallRectangle ref={elementRef} />
      }
      {/* Shape toggle buttons */}
      <div
        className="
          absolute bottom-4 left-1/2 -translate-x-1/2
          flex gap-3 items-center
        "
      >
        {/* Cycle button - advances to next state */}
        <Button
          variant="secondary"
          size="icon"
          aria-label="Cycle to next shape"
          onClick={handleCycle}
          className="
            rounded-full w-10 h-10 p-0
            border-2 border-muted-foreground/30 bg-transparent
            hover:border-foreground/50 hover:bg-muted/10
            transition-all duration-150
            flex items-center justify-center
          "
        >
          {/* Chevron right icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Button>
        <Button
          variant={state === MorphState.Red ? "destructive" : "secondary"}
          size="icon"
          aria-label="Red square"
          onClick={() => {
            if (state !== MorphState.Red) setState(MorphState.Red);
          }}
          className={`
            rounded-full w-10 h-10 p-0 group
            border-2 transition-all duration-150
            ${state === MorphState.Red
              ? 'border-destructive bg-destructive/30'
              : 'border-muted-foreground/30 bg-transparent hover:border-destructive/50 hover:bg-destructive/10 animate-subtle-pulse'}
            flex items-center justify-center
          `}
        >
          {/* Square shape indicator */}
          <span
            className={`
              block
              transition-colors duration-150
              ${state === MorphState.Red
                ? 'bg-destructive shadow'
                : 'bg-muted-foreground/20 group-hover:bg-destructive/40'}
              rounded-[5px] w-4 h-4
            `}
          />
        </Button>
        <Button
          variant={state === MorphState.Blue ? "primary" : "secondary"}
          size="icon"
          aria-label="Blue rectangle"
          onClick={() => {
            if (state !== MorphState.Blue) setState(MorphState.Blue);
          }}
          className={`
            rounded-full w-10 h-10 p-0 group
            border-2 transition-all duration-150
            ${state === MorphState.Blue
              ? 'border-accent-nebula bg-accent-nebula/30'
              : 'border-muted-foreground/30 bg-transparent hover:border-accent-nebula/50 hover:bg-accent-nebula/10 animate-subtle-pulse'}
            flex items-center justify-center
          `}
        >
          {/* Rectangle shape indicator */}
          <span
            className={`
              block
              transition-colors duration-150
              ${state === MorphState.Blue
                ? 'bg-accent-nebula shadow'
                : 'bg-muted-foreground/20 group-hover:bg-accent-nebula/40'}
              rounded-[7px] w-7 h-3
            `}
          />
        </Button>

        <Button
          variant={state === MorphState.Plasma ? "primary" : "secondary"}
          size="icon"
          aria-label="Blue rectangle"
          onClick={() => {
            if (state !== MorphState.Plasma) setState(MorphState.Plasma);
          }}
          className={`
            rounded-full w-10 h-10 p-0 group
            border-2 transition-all duration-150
            ${state === MorphState.Plasma
              ? 'border-accent-plasma bg-accent-plasma/30'
              : 'border-muted-foreground/30 bg-transparent hover:border-accent-plasma/50 hover:bg-accent-plasma/10 animate-subtle-pulse'}
            flex items-center justify-center
          `}
        >
          {/* Rectangle shape indicator */}
          <span
            className={`
              block
              transition-colors duration-150
              ${state === MorphState.Plasma
                ? 'bg-accent-plasma shadow'
                : 'bg-muted-foreground/20 group-hover:bg-accent-plasma/40'}
              w-4 h-8
            `}
          />
        </Button>
      </div>
    </div>
  )
}