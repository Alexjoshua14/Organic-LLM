"use client";

import type { DossierField } from "@/lib/connectors/dossier-prompts";

import { BookOpen, Briefcase, Cpu, FileText } from "lucide-react";

import { DossierAiAction } from "./DossierAiAction";

import { SettingsHelp } from "@/components/settings/settings-help";
import { cn } from "@/lib/utils";

export const DOSSIER_FIELDS = [
  {
    field: "educationAndTranscripts",
    id: "education",
    label: "Education & Transcripts",
    Icon: BookOpen,
    helpTitle: "What to include in education",
    help: "Schools, degrees, coursework, or transcript notes.",
    connector: "education",
    placeholder: "Schools, degrees, and coursework",
  },
  {
    field: "careerHistory",
    id: "career",
    label: "Career History & Projects",
    Icon: Briefcase,
    helpTitle: "What to include in career history",
    help: "Roles, organizations, projects, and expertise.",
    connector: "career",
    placeholder: "Roles, projects, and accomplishments",
  },
  {
    field: "resumeText",
    id: "resume",
    label: "Resume / CV",
    Icon: FileText,
    helpTitle: "How your resume is used",
    help: "Paste plain text or Markdown so writing and research tasks can use exact dates, metrics, and accomplishments.",
    connector: "resume",
    placeholder: "Paste your resume or CV",
  },
  {
    field: "workingPreferences",
    id: "preferences",
    label: "Working Preferences",
    Icon: Cpu,
    helpTitle: "What to include in working preferences",
    help: "Hardware, servers, preferred languages, runtimes, and architecture choices.",
    connector: "preferences",
    placeholder: "Tools, hardware, and how you like to work",
  },
] as const;

type DossierFieldEditorProps = {
  field: DossierField;
  value: string;
  onValueChange: (value: string) => void;
};

export function DossierFieldEditor({ field, value, onValueChange }: DossierFieldEditorProps) {
  const config = DOSSIER_FIELDS.find((entry) => entry.field === field)!;
  const { Icon } = config;
  const isResume = field === "resumeText";
  const inputId = `dossier-${config.id}`;

  return (
    <div className="space-y-stack-xs">
      <div className="flex flex-wrap items-center justify-between gap-inline-sm">
        <label
          className="flex min-w-0 flex-1 items-center gap-inline-sm text-xs font-medium text-foreground"
          htmlFor={inputId}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          {config.label}
        </label>
        <DossierAiAction field={field} />
      </div>
      <SettingsHelp title={config.helpTitle}>
        <p>
          {config.help} Used as <code>connector:{config.connector}</code>.
        </p>
      </SettingsHelp>
      <textarea
        className={cn(
          "w-full rounded-lg border border-border bg-background px-inset-md py-inset-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          isResume ? "min-h-28 font-mono text-xs" : "min-h-24 text-sm"
        )}
        id={inputId}
        placeholder={config.placeholder}
        rows={isResume ? 4 : 3}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </div>
  );
}
