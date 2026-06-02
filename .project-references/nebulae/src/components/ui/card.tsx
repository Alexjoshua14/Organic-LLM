"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { useState } from "react"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "relative overflow-hidden flex flex-col gap-6 transition-all duration-[350ms] ease-out",
  {
    variants: {
      variant: {
        default:
          "bg-card text-card-foreground rounded-xl border py-6 shadow-sm",
        glass:
          "rounded-2xl backdrop-blur-xl border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/5 shadow-lg shadow-neutral-900/5 dark:shadow-black/20 p-8",
      },
      interactive: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "glass",
        interactive: true,
        class: "cursor-pointer",
      },
    ],
    defaultVariants: {
      variant: "default",
      interactive: false,
    },
  }
)

interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {}

function Card({
  className,
  variant,
  interactive,
  children,
  ...props
}: CardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const hoverClasses = interactive && isHovered
    ? variant === "glass"
      ? "scale-[1.02] shadow-2xl shadow-neutral-900/10 dark:shadow-black/40"
      : ""
    : ""

  const hoverStyle =
    interactive && variant === "glass"
      ? {
          transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        }
      : undefined

  return (
    <div
      data-slot="card"
      onMouseEnter={interactive ? () => setIsHovered(true) : undefined}
      onMouseLeave={interactive ? () => setIsHovered(false) : undefined}
      className={cn(cardVariants({ variant, interactive }), hoverClasses, className)}
      style={hoverStyle}
      {...props}
    >
      {/* Subtle glow on hover for glass variant */}
      {interactive && variant === "glass" && (
        <div
          className={cn(
            "absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-transparent dark:from-white/5 transition-opacity duration-[350ms] pointer-events-none",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
