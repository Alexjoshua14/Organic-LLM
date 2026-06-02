'use client'
import { forwardRef } from 'react'
import { MorphState } from './types';
import { cn } from '@/lib/utils';

/**
 * Shape components for the morph lab experiment.
 * 
 * These components represent the different states that can be morphed between:
 * - RedSquare: A 100x100px red square with rounded corners
 * - BlueRectangle: A 300x150px blue rectangle with rounded corners
 * 
 * Both components forward refs to allow the morph physics system to measure
 * and animate their geometry. The size and color differences create a visually
 * distinct morph transition when switching between states.
 */


// Accept standard ref pattern for HTMLDivElement
export const RedSquare = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-[25vw] h-[10vh] bg-destructive rounded-lg", className)}
      {...props}
    />
  )
);
RedSquare.displayName = "RedSquare";

export const BlueRectangle = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-[60vw] h-[35vh] bg-accent-nebula rounded-xl", className)}
      {...props}
    />
  )
);
BlueRectangle.displayName = "BlueRectangle";

export const TallRectangle = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-[20vw] h-[40vh] bg-accent-plasma rounded-2xl", className)}
      {...props}
    />
  )
);
TallRectangle.displayName = "TallRectangle";
