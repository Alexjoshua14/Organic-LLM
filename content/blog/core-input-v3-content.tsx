import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";

import styles from "./core-input-v3.module.css";

import { BlogSection } from "@/components/blog/blog-section";
import { glass } from "@/components/design-system/primitives";
import {
  LUMEN_KELVIN_BASE,
  LUMEN_KELVIN_DEEP,
  LUMEN_KELVIN_RIM,
  kelvinToCss,
} from "@/lib/design/kelvin-color";
import { cn } from "@/lib/utils";

const SHOTS = "/blog/core-input-v3";

/** Phone captures are 423 CSS px wide; every one renders at the same width so v2 and v3 compare fairly. */
const PHONE = { width: 423, frame: "mx-auto w-full max-w-md" } as const;

/** Section wrapper: one owner for vertical rhythm (the article's stack), so headings start flush. */
function Section({ children }: { children: ReactNode }) {
  return <BlogSection className="[&>h2:first-child]:mt-0">{children}</BlogSection>;
}

/** Inline code in JSX gets the same chip as Markdown inline code in `BlogProse`. */
function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-card/50 px-1.5 py-0.5 font-mono text-sm text-foreground/90">
      {children}
    </code>
  );
}

type Shot = { src: string; height: number; alt: string };

/** A screenshot in a glass frame; the dark and light captures follow the reader's theme. */
function Screenshot({
  dark,
  light,
  caption,
  badge,
  width = PHONE.width,
  frame = PHONE.frame,
}: {
  dark: Shot;
  light: Shot;
  caption: ReactNode;
  badge?: "v2" | "v3";
  width?: number;
  frame?: string;
}) {
  return (
    <figure className={cn("not-prose", frame)}>
      <div className={cn(glass({ opaque: true }), "overflow-hidden rounded-2xl")}>
        <Image
          alt={dark.alt}
          className="hidden h-auto w-full dark:block"
          height={dark.height}
          src={dark.src}
          width={width}
        />
        <Image
          alt={light.alt}
          className="h-auto w-full dark:hidden"
          height={light.height}
          src={light.src}
          width={width}
        />
      </div>
      <Caption badge={badge}>{caption}</Caption>
    </figure>
  );
}

function Caption({ badge, children }: { badge?: "v2" | "v3"; children: ReactNode }) {
  return (
    <figcaption className="mt-stack-sm flex items-baseline gap-inline-sm px-inset-sm text-xs leading-relaxed text-muted-foreground">
      {badge ? (
        <span
          className={cn(
            "shrink-0 rounded-full border px-inset-sm text-2xs font-medium uppercase tracking-wider",
            badge === "v2"
              ? "border-border text-muted-foreground"
              : "border-[color:rgb(var(--lumen-rim)/0.4)] text-foreground"
          )}
        >
          {badge}
        </span>
      ) : null}
      <span>{children}</span>
    </figcaption>
  );
}

/** The stacking transition, recorded in dark mode. Reduced motion shows the end state instead. */
function StackingClip() {
  return (
    <figure className={cn("not-prose", PHONE.frame)}>
      <div className="dark overflow-hidden rounded-2xl border border-border/60 bg-background">
        <video
          aria-label="Typing a long message into CoreInput v3: it starts as one line, then stacks"
          autoPlay
          className="h-auto w-full motion-reduce:hidden"
          height={252}
          loop
          muted
          playsInline
          preload="metadata"
          src={`${SHOTS}/v3-stacking-dark.mp4`}
          width={PHONE.width}
        />
        <Image
          alt="CoreInput v3 stacked around a long message"
          className="hidden h-auto w-full motion-reduce:block"
          height={252}
          src={`${SHOTS}/v3-phone-draft-dark.png`}
          width={PHONE.width}
        />
      </div>
      <Caption badge="v3">
        Typing past the end of the line: the text, the buttons and the box move together.
      </Caption>
    </figure>
  );
}

function Issue({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="border-b border-border/50 py-stack-md last:border-b-0">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-stack-xs text-sm leading-relaxed text-muted-foreground">{children}</p>
    </li>
  );
}

const CHOSEN = {
  name: "Tiptap",
  detail: "built on ProseMirror",
  take: "A toolkit for formatted text that leaves the look entirely to me: inline formatting, code blocks, typing shortcuts and custom slash menus.",
  verdict:
    "Its Markdown support is still in beta, so keeping your text intact had to be tested, not assumed.",
};

const WEIGHED: Array<{ name: string; take: string; verdict: string }> = [
  {
    name: "Keep the textarea",
    take: "Simplest, and the most native on phones. I'd just clean up drafts, sizing and the effects around it.",
    verdict:
      "Can't format part of a message while you type, so no inline code and no real Markdown.",
  },
  {
    name: "Lexical",
    take: "A modular editor framework with strong React support.",
    verdict: "The best fit if Tiptap fails a test, with more of the pieces left for me to build.",
  },
  {
    name: "Milkdown",
    take: "Markdown-first, formatted as you see it.",
    verdict: "The pick if keeping the exact Markdown source mattered most.",
  },
  {
    name: "CodeMirror",
    take: "Excellent for editing raw Markdown.",
    verdict: "Formatted-by-default would mean building the whole presentation myself.",
  },
  {
    name: "BlockNote",
    take: "Already in the app: a block-based document editor.",
    verdict:
      "Built for documents, and it loses detail converting Markdown. Wrong shape for a chat box.",
  },
];

function Options() {
  return (
    <div className="not-prose space-y-stack-sm">
      <div
        className={cn(
          glass({ opaque: true }),
          "rounded-xl border-[color:rgb(var(--lumen-rim)/0.35)] p-inset-lg"
        )}
      >
        <div className="flex items-baseline justify-between gap-inline-sm">
          <p className="font-medium text-foreground">
            {CHOSEN.name}{" "}
            <span className="text-sm font-normal text-muted-foreground">{CHOSEN.detail}</span>
          </p>
          <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            Prototyped
          </p>
        </div>
        <p className="mt-stack-xs text-sm leading-relaxed text-muted-foreground">{CHOSEN.take}</p>
        <p className="mt-stack-xs text-sm leading-relaxed text-muted-foreground/80">
          {CHOSEN.verdict}
        </p>
      </div>
      <ul className="list-none divide-y divide-border/50 rounded-xl border border-border/60 p-0">
        {WEIGHED.map((option) => (
          <li
            key={option.name}
            className="grid gap-stack-xs px-inset-md py-inset-md sm:grid-cols-[10rem_1fr] sm:gap-inline-md sm:px-inset-lg"
          >
            <p className="text-sm font-medium text-foreground">{option.name}</p>
            <div className="space-y-stack-xs text-sm leading-relaxed">
              <p className="text-muted-foreground">{option.take}</p>
              <p className="text-muted-foreground/80">{option.verdict}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Timing() {
  const rows: [string, string, string][] = [
    ["Stacking", "220ms", "Long enough to follow where things went"],
    ["Back to one line", "170ms", "Leaving is quicker than arriving"],
    ["Stagger", "24ms", "Text first, then Send, mic and attachments, then settings"],
    [
      "Curve",
      "cubic-bezier(0.32, 0.72, 0, 1)",
      "How the speed changes over the move: a gentle start and a long, soft landing",
    ],
  ];

  return (
    <dl className="not-prose divide-y divide-border/50 rounded-xl border border-border/60">
      {rows.map(([term, value, why]) => (
        <div
          key={term}
          className="grid gap-stack-xs px-inset-md py-inset-md text-sm sm:grid-cols-[9rem_auto_1fr] sm:items-baseline sm:gap-inline-md sm:px-inset-lg"
        >
          <div className="flex items-baseline justify-between gap-inline-sm sm:contents">
            <dt className="font-medium text-foreground">{term}</dt>
            <dd className="font-mono text-xs text-foreground/90">{value}</dd>
          </div>
          <dd className="text-muted-foreground">{why}</dd>
        </div>
      ))}
    </dl>
  );
}

const KELVINS = [
  { kelvin: LUMEN_KELVIN_DEEP, label: "Deep" },
  { kelvin: LUMEN_KELVIN_BASE, label: "Base" },
  { kelvin: LUMEN_KELVIN_RIM, label: "Rim" },
];

/** The self-contained Lumen explainer: what it is in each theme, shown rather than told. */
function WhatIsLumen() {
  return (
    <aside className="not-prose overflow-hidden rounded-2xl border border-border/60">
      <div className="grid sm:grid-cols-2">
        <div className="dark bg-background p-inset-lg text-foreground sm:p-stack-2xl">
          <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            Dark · natural light
          </p>
          <div className="mt-stack-xl flex justify-center">
            <span className="composer-tool-chip-host inline-flex overflow-visible">
              <span className="composer-tool-chip-stage relative inline-flex">
                <span aria-hidden className="lumen-rim-backlight lumen-rim-backlight--on" />
                <span
                  className={cn(
                    glass({ chip: true }),
                    "composer-tool-chip composer-tool-chip-active relative z-10 rounded-lg px-inset-lg py-inset-sm text-sm"
                  )}
                >
                  Enabled
                </span>
              </span>
            </span>
          </div>
          <div className="mt-stack-xl flex justify-center gap-inline-lg">
            {KELVINS.map(({ kelvin, label }) => (
              <div key={kelvin} className="flex flex-col items-center gap-stack-xs">
                <span
                  aria-hidden
                  className="size-8 rounded-full"
                  style={{ background: kelvinToCss(kelvin) }}
                />
                <span className="text-2xs text-foreground/80">{label}</span>
                <span className="text-2xs text-muted-foreground">{kelvin.toLocaleString()}K</span>
              </div>
            ))}
          </div>
        </div>
        <div className="light bg-background p-inset-lg text-foreground sm:p-stack-2xl">
          <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            Light · the absence of light
          </p>
          <div className="mt-stack-xl flex justify-center">
            <span
              className={cn(
                glass({ chip: true }),
                styles.shadowDemo,
                "rounded-lg px-inset-lg py-inset-sm text-sm"
              )}
            >
              Enabled
            </span>
          </div>
          <p className="mt-stack-xl text-center text-2xs text-muted-foreground">
            The shadow&apos;s colour is dark mode&apos;s background
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 bg-secondary/30 p-inset-lg text-sm leading-relaxed text-muted-foreground sm:p-stack-2xl">
        <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          What is Lumen?
        </p>
        <p className="mt-stack-sm">
          Lumen is how I add an organic aspect to Organic LLM. In dark mode it is real light: its
          colour comes from the Kelvin scale, the warm 2,800K to 3,200K of an incandescent bulb, and
          I use it to draw your attention. It tells you what you&apos;re hovering over, what&apos;s
          active, what&apos;s enabled.
        </p>
        <p className="mt-stack-sm">
          Its light mode counterpart struggled to find its footing, but it has now settled. It is
          the absence of light in a space flooded with it. Shadows add dimensionality to the UI in
          an organic way, and their colour is pulled from dark mode&apos;s primary background to tie
          them back into the application. Working in tandem with my glass surfaces, Lumen blurs the
          line between technology and nature.
        </p>
      </div>
    </aside>
  );
}

export function CoreInputV3Content() {
  return (
    <div className="space-y-stack-3xl">
      <header className="not-prose space-y-stack-md">
        <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          Design · November 2026
        </p>
        <h1 className="text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
          CoreInput v3
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-foreground/85 sm:text-lg">
          Organic LLM is an AI workspace for chat, memory and research that I design and build.
          CoreInput is its message box, the place you type to the assistant. Every conversation
          starts there, so its flaws are the ones you hit most.
        </p>
        <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
          This is the story of rebuilding it: what wasn&apos;t working, what I weighed, and the
          composer I landed on. Along the way I also settled what Lumen, the app&apos;s warm glow
          for whatever is active, should be in light mode.
        </p>
      </header>

      <Section>
        <h2>Where v2 was struggling</h2>
        <p>
          v2 was the browser&apos;s standard text box (a <Code>textarea</Code>) that grew as you
          typed, inside a frame holding the model settings, attachments, the mic and the Send
          button. On a desktop it held up. On a phone, the cracks were hard to ignore.
        </p>
      </Section>

      <div className="not-prose rounded-2xl border border-border/60 bg-secondary/20 px-inset-lg py-inset-sm">
        <ul className="list-none p-0">
          <Issue title="Mic and Send sat side by side">
            Reaching for the mic could hit Send instead, and a message sent too early is the
            costliest mistake a message box can make.
          </Issue>
          <Issue title="The typing area was squeezed">
            On a phone the mic and attachments took roughly a third of the row.
          </Issue>
          <Issue title="Long drafts disappeared">
            Only about the last 23 words were visible. I couldn&apos;t reread what I&apos;d written
            before sending.
          </Issue>
          <Issue title="Buttons floated in the middle">
            Settings, mic and Send were centred against the whole draft, not lined up with the text.
          </Issue>
          <Issue title="Typed text ghosted">
            Bits of what I&apos;d typed sometimes lingered as a faint copy for a moment before
            clearing. I never pinned down the cause, which was one more reason to leave the
            textarea.
          </Issue>
          <Issue title="The first line break jumped">
            Going from one line to two shifted the whole box, and on narrow screens the placeholder
            wrapped onto a second line.
          </Issue>
          <Issue title="It could only ever be plain text">
            I wanted slash commands, inline code, code blocks and formatting as you type, with room
            for micro-animation and, eventually, turning into the controls bar of Speak, the
            app&apos;s voice mode.
          </Issue>
        </ul>
      </div>

      <Screenshot
        badge="v2"
        caption="A long draft on a phone: the start is cut off, and the buttons sit in the middle of the text."
        dark={{
          src: `${SHOTS}/legacy-phone-draft-dark.png`,
          height: 198,
          alt: "CoreInput v2 on a phone with a long draft whose first lines are cut off",
        }}
        light={{
          src: `${SHOTS}/legacy-phone-draft-light.png`,
          height: 198,
          alt: "CoreInput v2 on a phone with a long draft whose first lines are cut off, light mode",
        }}
      />

      <Screenshot
        badge="v2"
        caption="On a desktop: the full row of labelled controls under the text."
        dark={{
          src: `${SHOTS}/legacy-desktop-dark.png`,
          height: 348,
          alt: "CoreInput v2 at desktop width in dark mode",
        }}
        frame="w-full"
        light={{
          src: `${SHOTS}/legacy-desktop-light.png`,
          height: 348,
          alt: "CoreInput v2 at desktop width in light mode",
        }}
        width={912}
      />

      <Section>
        <h2>The options I weighed</h2>
        <p>
          The first question was whether to patch the textarea or rebuild on a real editor. Patches
          could fix the bugs, but not the bigger wish: formatting as you type. Markdown is the
          shorthand many apps use for that (asterisks for <em>emphasis</em>, backticks for{" "}
          <Code>code</Code>), and I wanted messages to look formatted while you write them, with a
          way to see and edit the shorthand underneath. A plain text box can&apos;t do that.
        </p>
        <p>
          Each option trades how much formatting comes for free against how much I&apos;d build
          myself, and how faithfully it keeps your text.
        </p>
      </Section>

      <Options />

      <Section>
        <p>
          I picked Tiptap for the prototype. Not because it&apos;s proven faster (it isn&apos;t,
          yet), but because it got me inline code, lists, slash menus and a custom look the
          quickest. Lexical stays the fallback, and Milkdown the one to reach for if exact Markdown
          comes first. Tiptap still has to pass four tests before it ships everywhere: it must be
          reliable on phones, keep your formatting intact, feel instant as you type, and not make
          the app slower to load.
        </p>
      </Section>

      <Section>
        <h2>A mobile panel I didn&apos;t build</h2>
        <p>
          Alongside the editor I explored a phone-only panel for settings, attachments and the mic,
          opened with a flick up on the message box. Every way to open it failed. A grip handle was
          ugly. Swiping on the thin border around the box was too small a target. Swiping up from
          the bottom edge fought the iPhone&apos;s home bar. A long press added a delay I
          wouldn&apos;t accept. So I dropped it.
        </p>
        <p>
          One piece survived: on narrow screens the settings panel now opens directly above the
          message box, its lower edge tucked just beneath it, so it reads as part of the composer
          rather than a menu floating over the conversation.
        </p>
      </Section>

      <Screenshot
        caption="Kept from the dropped panel: settings open just above the message box."
        dark={{
          src: `${SHOTS}/legacy-phone-options-dark.png`,
          height: 212,
          alt: "The compact settings panel open just above the message box",
        }}
        light={{
          src: `${SHOTS}/legacy-phone-options-light.png`,
          height: 212,
          alt: "The compact settings panel open just above the message box, light mode",
        }}
      />

      <Section>
        <h2>The v3 composer</h2>
        <p>
          v3 is one line by default: settings on the left, then your text, then attachments, the mic
          and Send. The moment your thought needs more room (it wraps, or you add a line break, a
          list or a code block), the composer stacks. The text takes the full width, settings,
          attachments and the mic settle along the left underneath it, and Send stands alone on the
          right.
        </p>
      </Section>

      <Screenshot
        badge="v3"
        caption="One line by default, every control centred on the line of text."
        dark={{
          src: `${SHOTS}/v3-phone-oneline-dark.png`,
          height: 90,
          alt: "CoreInput v3 on one line with the placeholder Drop a thought",
        }}
        light={{
          src: `${SHOTS}/v3-phone-oneline-light.png`,
          height: 90,
          alt: "CoreInput v3 on one line with the placeholder Drop a thought, light mode",
        }}
      />

      <StackingClip />

      <Screenshot
        badge="v3"
        caption="The same long draft that v2 cut off, all of it visible, with Send on its own."
        dark={{
          src: `${SHOTS}/v3-phone-draft-dark.png`,
          height: 252,
          alt: "CoreInput v3 stacked around a long draft, every line visible",
        }}
        light={{
          src: `${SHOTS}/v3-phone-draft-light.png`,
          height: 252,
          alt: "CoreInput v3 stacked around a long draft, every line visible, light mode",
        }}
      />

      <Section>
        <h3>What changed for v2&apos;s problems</h3>
        <ul>
          <li>
            <strong>Accidental sends.</strong> Once you&apos;re writing more than a line, the mic
            and Send sit at opposite ends of the box.
          </li>
          <li>
            <strong>The squeeze.</strong> A long message gets the full width, with the buttons on
            their own row beneath it.
          </li>
          <li>
            <strong>Disappearing drafts.</strong> The box grows to show far more of what you&apos;ve
            written before it scrolls.
          </li>
          <li>
            <strong>Floating buttons.</strong> On one line they sit on the text&apos;s line;
            stacked, they sit on a row of their own.
          </li>
          <li>
            <strong>The jump.</strong> Going from one line to two is now a short, deliberate
            movement, and a placeholder too long for one line stacks the box instead of wrapping.
          </li>
          <li>
            <strong>Ghosting.</strong> v3 doesn&apos;t use the textarea at all; real phones will
            tell me whether the effect is gone.
          </li>
        </ul>
        <p>
          The stacking is choreographed. In early builds only the buttons glided while the text and
          the box snapped into place, and it read as a jolt. Now everything moves in one gesture:
          the text, the buttons and the box&apos;s own height. With reduced motion turned on, the
          layout simply changes.
        </p>
      </Section>

      <Timing />

      <Section>
        <h3>Writing in it</h3>
        <ul>
          <li>
            <strong>Formatting as you type</strong>, with the raw Markdown one tap away and a
            snapshot to restore if switching between the two changes something.
          </li>
          <li>
            <strong>Inline code</strong> marked by subtle backticks while you edit, removed with a
            single Backspace.
          </li>
          <li>
            <strong>Code blocks</strong> with the same look as code in the assistant&apos;s replies,
            coloured by meaning as you type. They default to Python, and picking another language
            puts you back where you were typing.
          </li>
          <li>
            <strong>Slash commands</strong> (<Code>/code</Code>, <Code>/list</Code>,{" "}
            <Code>/quote</Code>, <Code>/heading</Code>) and Markdown shortcuts that work on any
            line, not just the first, and only change the line they&apos;re on.
          </li>
          <li>
            <strong>Wired to the real app</strong>: the same model and tool settings, the same
            attachments menu, and Lumen on every button, including Send.
          </li>
        </ul>
        <p>
          Every size, gap and colour comes from the app&apos;s shared design system, so nothing is a
          one-off. Where a value was missing (a tighter gap for a cluster of icon buttons), I added
          it to the system instead of fixing it in one place.
        </p>
      </Section>

      <Screenshot
        badge="v3"
        caption="Stacked, with a Python code block, coloured as you type."
        dark={{
          src: `${SHOTS}/v3-phone-stacked-dark.png`,
          height: 282,
          alt: "CoreInput v3 stacked with a question and a highlighted Python code block",
        }}
        light={{
          src: `${SHOTS}/v3-phone-stacked-light.png`,
          height: 282,
          alt: "CoreInput v3 stacked with a question and a highlighted Python code block, light mode",
        }}
      />

      <Section>
        <h2>Lumen, settled</h2>
        <p>
          Building v3 forced a question I&apos;d been avoiding: what should Lumen be in light mode?
          The warm rim that glows so naturally out of the dark just looked like a stain on a light
          surface.
        </p>
      </Section>

      <WhatIsLumen />

      <Section>
        <p>
          So light mode now has no rim at all. Every Lumen surface (the composer&apos;s buttons, the
          message box itself, selected cards) lifts on a gentle shadow instead. It has a resting
          depth and a deeper one on hover, and eases in on the same timing as the rim. Dark mode is
          unchanged, and both come from the same shared values, so anything new that uses Lumen gets
          both.
        </p>
      </Section>

      <Section>
        <h2>What&apos;s next</h2>
        <p>
          v3 is moving from its prototype page into the message box people actually use. Everything
          the old box did (saving drafts, voice dictation, pasting, redirecting the assistant
          mid-reply, previewing formatting) moves over to the new editor, and every part of the app
          that uses the composer comes along.
        </p>
        <p>
          Then come the four tests on real phones and tablets: keyboards, autocorrect, IME (the
          input systems for languages like Japanese and Chinese), screen readers, and how instantly
          letters appear compared with v2. After that, the step I&apos;ve been designing towards
          from the start: the message box turning into Speak&apos;s controls when you talk instead
          of type.
        </p>
      </Section>

      <footer className="not-prose border-t border-border/50 pt-stack-2xl text-sm text-muted-foreground">
        <Link className="text-foreground underline-offset-4 hover:underline" href="/blog">
          ← More from the blog
        </Link>
      </footer>
    </div>
  );
}
