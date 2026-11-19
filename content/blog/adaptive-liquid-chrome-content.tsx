import { BlogProse } from "@/components/blog/blog-prose";
import { BlogSection } from "@/components/blog/blog-section";
import { LiquidChromeTimingDemo } from "@/components/blog/liquid-chrome-timing-demo";

const USAGE = `\`\`\`tsx
<AdaptiveLiquidChrome />

<div data-dim-background>
  <Input placeholder="Focus or hover to dim the background" />
</div>
\`\`\``;

export function AdaptiveLiquidChromeContent() {
  return (
    <>
      <BlogSection>
        <h1>A background that steps back</h1>
        <p className="text-lg leading-relaxed text-foreground/90">
          Organic LLM has a slowly moving, liquid-metal background. When you reach for the input it
          dims, so the words come forward. When you let go it does not snap back. It returns slowly,
          like it is waiting for you.
        </p>

        <h2>Try it</h2>
        <p>
          Hover the box or click into the field. The background dims quickly, because you asked for
          attention. Then move away and watch it come back in two stages.
        </p>
      </BlogSection>

      <LiquidChromeTimingDemo />

      <BlogSection>
        <h2>Why two stages</h2>
        <p>
          Coming back at one steady speed feels either abrupt or sluggish. We split it. The
          background rises <strong>quickly to 65%</strong>, so the page never feels stuck dim, then
          takes the rest of the way <strong>slowly to full</strong>. The long second leg is the
          point: it reads as a calm exhale, the product waiting for you, without hurrying you.
        </p>
        <p>
          Brightening starts the moment hover and focus are both gone. There is no rest delay, and
          moving back in during either leg dims it again at once.
        </p>

        <h2>Using it</h2>
        <p>
          The background is a full-viewport layer. Any element marked{" "}
          <code>data-dim-background</code> dims it while hovered or while anything inside has focus.
        </p>
        <BlogProse content={USAGE} />
        <p>
          Mark an element <code>data-dim-background=&quot;full&quot;</code> for a gentler dim, about
          40% opacity instead of the default 30%.
        </p>

        <h2>Kind to people and devices</h2>
        <ul>
          <li>
            <strong>Reduced motion.</strong> With <em>Reduce motion</em> on, the animated canvas is
            not mounted at all. Light mode shows a still paper texture, dark mode keeps a quiet
            gradient, and dimming still works.
          </li>
          <li>
            <strong>Battery and heat.</strong> The animation stops when the tab is hidden, the
            canvas is capped at 1.5 times the display&apos;s pixel density, and phones use a lighter
            shading pass than desktops.
          </li>
          <li>
            <strong>No per-element listeners.</strong> Hover and focus are watched once at the page
            level, so marking an element costs nothing.
          </li>
        </ul>

        <h2>What is ours</h2>
        <p>
          The liquid shader underneath is the open-source LiquidChrome from reactbits. The dimming
          behaviour, the two-stage return, the reduced-motion and performance handling, and the
          light-mode paper-and-ink material are our own.
        </p>
      </BlogSection>
    </>
  );
}
