"use client";

import { forwardRef, type ComponentProps } from "react";

import { PersonaPanel } from "./persona-panel";
import { PersonaSpark } from "./persona-spark";
import { usePersonaSessionOptional } from "./persona-session-provider";

import { ComposerActionButton } from "@/components/chat/composer-action-button";
import { glass } from "@/components/design-system/primitives";
import { PERSONAS } from "@/lib/personas/unified/registry";
import { cn } from "@/lib/utils";

/** Composer chip: the Spark, lit when the Artist assistant is on. Opens the persona panel. */
export function ComposerPersonaChip({ showLabel = false }: { showLabel?: boolean }) {
  const persona = usePersonaSessionOptional();

  if (!persona?.ready) return null;
  const active = Boolean(persona.session);
  const name = PERSONAS["artist-assistant"].name;

  return (
    <PersonaPanel
      trigger={
        <ComposerActionButton
          aria-label={active ? `${name} on for this chat — open personas` : "Choose a persona"}
          engaged={active}
          title={active ? `${name} is on for this chat` : "Personas"}
          type="button"
        >
          <PersonaSpark size={18} state={active ? "idle" : "inactive"} />
          {showLabel && active ? <span className="text-xs">{name}</span> : null}
        </ComposerActionButton>
      }
    />
  );
}

const SpeakTrigger = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { active: boolean }>(
  function SpeakTrigger({ active, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          glass({ border: "all" }),
          "inline-flex items-center gap-2 rounded-2xl px-2.5 py-1.5 text-xs transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          className
        )}
        type="button"
        {...props}
      >
        <PersonaSpark size={18} state={active ? "idle" : "inactive"} />
        {active ? PERSONAS["artist-assistant"].name : "Persona"}
      </button>
    );
  }
);

/** Speak toolbar variant, matching the Memory toggle beside it. */
export function SpeakPersonaChip({ locked }: { locked: boolean }) {
  const persona = usePersonaSessionOptional();

  if (!persona?.ready) return null;

  return (
    <PersonaPanel locked={locked} trigger={<SpeakTrigger active={Boolean(persona.session)} />} />
  );
}
