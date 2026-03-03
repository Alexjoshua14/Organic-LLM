"use client";

export type SettingsRowProps = {
  /** Section header (e.g. "Zero Data Retention") */
  title: string;
  /** Control placed in the interaction slot (e.g. Switch, checkbox) */
  children: React.ReactNode;
  /** Main line text, aligned with the control */
  mainText: React.ReactNode;
  /** Subtext in xs font below, aligned with main text */
  subtext: React.ReactNode;
};

export function SettingsRow({
  title,
  children,
  mainText,
  subtext,
}: SettingsRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
        <div className="col-start-1 row-start-1">{children}</div>
        <span className="text-sm text-muted-foreground col-start-2 row-start-1 min-w-0">
          {mainText}
        </span>
        <p className="text-xs font-light text-muted-foreground col-start-2 row-start-2 min-w-0">
          {subtext}
        </p>
      </div>
    </div>
  );
}
