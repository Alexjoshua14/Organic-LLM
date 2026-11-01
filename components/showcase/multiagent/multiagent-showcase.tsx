import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Braces,
  GitBranch,
  Layers3,
  Radio,
} from "lucide-react";

import { AgentMaterialStudy } from "./agent-material-study";
import { ContextWorkbench } from "./context-workbench";
import { HeartbeatDemo } from "./heartbeat-demo";
import { SourceLink } from "./source-link";
import { SpecialistExplorer } from "./specialist-explorer";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { CHAPTERS, sourceHref } from "@/lib/showcase/multiagent/content";

function Chapter({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className="ma-chapter-heading">
      <div>
        <span className="ma-chapter-number">{number}</span>
        <h2>{title}</h2>
      </div>
      <p>{children}</p>
    </header>
  );
}

function OverviewDiagram() {
  return (
    <div
      className="ma-overview"
      role="img"
      aria-label="The orchestrator sends a brief and selected context to specialist threads. Their results return through heartbeat notices and thread reads."
    >
      <div className="ma-overview-top">
        <span className="ma-mono">ONE SHARED INTENT</span>
        <span className="ma-overview-mark">
          <OrganicActivityMark size="lg" seed="showcase-overview-orchestrator" />
        </span>
        <strong>Orchestrator</strong>
        <small>The conversation stays with you.</small>
      </div>
      <div className="ma-overview-bus">
        <span>authored brief</span>
        <ArrowDown size={16} aria-hidden />
        <span>selected context</span>
      </div>
      <div className="ma-overview-workers">
        {["Reed", "Lyra", "Archer"].map((name, index) => (
          <div key={name}>
            <span className="ma-overview-worker-mark">
              <OrganicActivityMark size="lg" seed={`showcase-overview-${name}`} />
            </span>
            <strong>{name}</strong>
            <small>{["Build", "Investigate", "Design"][index]}</small>
          </div>
        ))}
      </div>
      <div className="ma-overview-return">
        <Radio size={14} aria-hidden />
        <span>Meaningful changes return.</span>
        <span className="ma-return-line" />
      </div>
      <span className="ma-overview-caption">Independent threads. Deliberate connections.</span>
    </div>
  );
}

export function MultiagentShowcase() {
  return (
    <article className="ma-page showcase-scroll" aria-labelledby="multiagent-title">
      <div className="ma-shell">
        <a className="ma-back" href="/showcase">
          ← The showcase
        </a>
        <header className="ma-hero">
          <div className="ma-hero-copy">
            <p className="ma-eyebrow">ORGANIC LLM / ENGINEERING & INTERACTION</p>
            <h1 id="multiagent-title">
              One conversation.
              <br />
              Many minds.
            </h1>
            <p className="ma-hero-lede">
              A closer look at the multiagent system I built: how work branches, how context
              travels, and how separate threads become one coherent conversation.
            </p>
            <a className="ma-enter" href="#heartbeat">
              Explore the system <ArrowDown size={17} aria-hidden />
            </a>
          </div>
          <OverviewDiagram />
        </header>
        <nav className="ma-chapter-nav" aria-label="Multiagent chapters">
          {CHAPTERS.map(([id, label], index) => (
            <a key={id} href={`#${id}`}>
              <span>0{index + 1}</span>
              {label}
            </a>
          ))}
        </nav>
        <div className="ma-thesis">
          <p>An agent needs more than a prompt.</p>
          <p>
            It needs a place to work, the right context, a clear boundary, and a way to bring its
            work back. These are the pieces that make the system hold together.
          </p>
        </div>

        <section className="ma-chapter" id="heartbeat">
          <Chapter number="01" title="Attention has a heartbeat.">
            The parent should know when something matters. It should not need a model call just to
            discover that nothing happened.
          </Chapter>
          <div className="ma-trigger-strip">
            <div>
              <Radio size={18} aria-hidden />
              <strong>What starts it?</strong>
              <p>
                A client-side probe while a thread family with subagents is open. It checks when
                mounted, on a local timer, and when the tab becomes visible.
              </p>
            </div>
            <div>
              <span className="ma-mono">USER-SELECTED CADENCE</span>
              <div className="ma-cadences">
                <span>
                  <b>30s</b>Performance
                </span>
                <span>
                  <b>60s</b>Default
                </span>
                <span>
                  <b>5m</b>Saver
                </span>
                <span>
                  <b>24h</b>Daily
                </span>
              </div>
              <p>
                Hidden tabs, five minutes of inactivity, or detected low power pause the probe. This
                is an in-view check, not a server cron.
              </p>
            </div>
          </div>
          <HeartbeatDemo />
          <div className="ma-notes-grid">
            <article>
              <span className="ma-mono">THE GUARANTEED PATH</span>
              <h3>Check before thinking.</h3>
              <p>
                Every valid, owned request checks the plan budget and target. Eligible runs discover
                children, load heartbeat state and enforce a 30-second server floor. Only then do
                they build snapshots, compare the digest and attempt an atomic claim. Each gate can
                return early.
              </p>
              <SourceLink path="lib/llm/subagents/heartbeat/run-heartbeat.ts">
                Follow the heartbeat
              </SourceLink>
            </article>
            <article>
              <span className="ma-mono">THE INTELLIGENT BRANCH</span>
              <h3>Jev supplies judgment.</h3>
              <p>
                A changed digest and a successful claim trigger Jev. It distinguishes meaningful
                results, blockers and new requests from noise. Per-thread probability must exceed
                0.8; the call has a five-second deadline and requires zero data retention. A quiet
                result updates the digest, not the last-notified baseline.
              </p>
              <SourceLink path="lib/llm/subagents/heartbeat/evaluate.ts">
                Read the evaluation gate
              </SourceLink>
            </article>
          </div>
          <details className="ma-disclosure">
            <summary>
              <span>What gets measured?</span>
              <span>
                Telemetry, without conversation content <PlusMark />
              </span>
            </summary>
            <div className="ma-telemetry">
              <dl>
                <div>
                  <dt>Execution</dt>
                  <dd>
                    Start time, total duration, status and last stage; snapshot and evaluation
                    duration.
                  </dd>
                </div>
                <div>
                  <dt>Workload</dt>
                  <dd>
                    Child and working-agent counts, snapshot character count, evaluation attempted,
                    notable event count.
                  </dd>
                </div>
                <div>
                  <dt>Usage</dt>
                  <dd>
                    Model, provider, generation ID, input/output/total tokens and provider-reported
                    cost.
                  </dd>
                </div>
                <div>
                  <dt>Failure & correlation</dt>
                  <dd>
                    Run, owner and thread IDs; sanitized timeout or operation-failed codes.
                    Unavailable measurements remain null.
                  </dd>
                </div>
              </dl>
              <p>
                Telemetry stores metadata, not prompts, snapshots, message text or raw exceptions.
                The separate system notice belongs to the owned conversation.
              </p>
              <SourceLink path="lib/llm/subagents/heartbeat/telemetry.ts">
                Inspect the telemetry schema
              </SourceLink>
            </div>
          </details>
        </section>

        <section className="ma-chapter" id="threads">
          <Chapter number="02" title="A thread is a thread.">
            The orchestrator and its specialists use the same database schema. Their relationship
            changes; their fundamental shape does not.
          </Chapter>
          <div className="ma-thread-study">
            <div className="ma-thread-tree">
              <span className="ma-mono">PUBLIC.THREADS / ILLUSTRATIVE ROWS</span>
              <div className="ma-db-row">
                <span>
                  <GitBranch size={17} aria-hidden /> Main conversation
                </span>
                <code>id: parent</code>
                <code>parent_thread_id: null</code>
              </div>
              <div className="ma-db-children">
                <div className="ma-db-row">
                  <span>Reed’s thread</span>
                  <code>id: child-a</code>
                  <code>parent_thread_id: parent</code>
                </div>
                <div className="ma-db-row">
                  <span>Lyra’s thread</span>
                  <code>id: child-b</code>
                  <code>parent_thread_id: parent</code>
                </div>
              </div>
              <p>
                Children are queried by <code>parent_thread_id</code>, not stored as an array on the
                parent.
              </p>
            </div>
            <div className="ma-schema">
              <div>
                <Braces size={18} aria-hidden />
                <span>One schema. Different positions.</span>
              </div>
              <dl>
                <div>
                  <dt>id · owner_id</dt>
                  <dd>Identity and ownership</dd>
                </div>
                <div>
                  <dt>parent_thread_id</dt>
                  <dd>Nullable self-reference</dd>
                </div>
                <div>
                  <dt>subagent_agent_id</dt>
                  <dd>Specialist identity / roster slot</dd>
                </div>
                <div>
                  <dt>subagent_status · subagent_status_at</dt>
                  <dd>Worker state and timestamp</dd>
                </div>
                <div>
                  <dt>subagent_heartbeat_*</dt>
                  <dd>Baseline, digest and claim time</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="ma-inline-note">
            <span className="ma-mono">RECURSIVE SHAPE ≠ RECURSIVE EXECUTION</span>
            <p>
              Any thread can structurally have children. That makes future subagent-to-subagent
              delegation possible without inventing a second thread type. Today, worker shells do
              not receive orchestration tools, and the heartbeat endpoint rejects child targets. The
              schema is ready for hierarchy; the runtime still controls who may delegate.
            </p>
          </div>
          <div className="ma-source-row">
            <SourceLink path="docs/migrations/threads_subagent_threads.sql">
              Read the migration and integrity guards
            </SourceLink>
            <SourceLink path="lib/llm/subagents/hard-set/README.md">
              Understand the current worker boundary
            </SourceLink>
          </div>
        </section>

        <section className="ma-chapter" id="context">
          <Chapter number="03" title="The handoff is the work.">
            A worker cannot see the parent conversation. I built a context workbench so delegation
            can carry the right evidence, not just a task name.
          </Chapter>
          <ol className="ma-dispatch-steps">
            <li>
              <span>01</span>
              <h3>Decide whether to delegate.</h3>
              <p>
                Answer inline when existing tools and context are enough. Delegate for an explicit
                specialist request, required tools or expertise, or a substantial deliverable that
                benefits from isolation.
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>Choose the smallest useful specialist.</h3>
              <p>
                Match the task to the roster, tool access and current status. Reuse finished work;
                wait for a busy worker. A second dispatch must explain what independent work it
                adds.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Author, preflight, dispatch.</h3>
              <p>
                Write a standalone brief: task, purpose, constraints, deliverable and completion
                criteria. Select context, check budget and queue the assignment in a created or
                reused child thread.
              </p>
            </li>
          </ol>
          <ContextWorkbench />
          <div className="ma-workbench-features">
            <article>
              <span>01 / REUSE</span>
              <h3>Bundles that survive a handoff.</h3>
              <p>
                Save instructions, user excerpts, memories, notes and worker output. Update an item
                in place instead of rebuilding the same context every time.
              </p>
            </article>
            <article>
              <span>02 / PRECISION</span>
              <h3>Choose exactly what travels.</h3>
              <p>
                Select whole bundles, individual items or character ranges. Duplicate attachments
                are delivered once. Live output references resolve when the assignment is sent.
              </p>
            </article>
            <article>
              <span>03 / VISIBILITY</span>
              <h3>Inspect before spending.</h3>
              <p>
                A dry run reports the complete input budget, omissions, duplicates and truncation.
                It creates no child, queues no work and consumes no dispatch allowance.
              </p>
            </article>
            <article>
              <span>04 / DEPTH</span>
              <h3>Small previews. Recoverable detail.</h3>
              <p>
                Long attachments have marked 6,000-character previews. Workers can page the selected
                originals with <code>read_context_item</code>, scoped to their own assignment.
              </p>
            </article>
          </div>
          <div className="ma-inline-note">
            <Layers3 size={22} aria-hidden />
            <p>
              The workbench also gives the model compact shorthand and on-demand manpages.{" "}
              <code>msg:</code>, <code>out:</code>, <code>node:</code> and <code>connector:</code>{" "}
              identify sources; <code>worktable</code> maintains the bundles. Full originals stay in
              encrypted assignment metadata, outside automatic model-message conversion.
            </p>
          </div>
          <div className="ma-source-row">
            <SourceLink path="docs/aion/subagent-context.md">Read the context contract</SourceLink>
            <SourceLink path="lib/llm/subagents/worktable/manpages.ts">
              Open the model’s workbench manual
            </SourceLink>
            <SourceLink path="lib/llm/subagents/orchestrator/orchestrator-tools.ts">
              Trace dispatch_subagent
            </SourceLink>
          </div>
        </section>

        <section className="ma-chapter" id="specialists">
          <Chapter number="04" title="Different minds. Deliberate tools.">
            A subagent is a persistent thread with a bounded assignment, an identity, instructions,
            a model and a tool policy. The useful differences are designed into it.
          </Chapter>
          <SpecialistExplorer />
          <p className="ma-definition">
            <b>Chronos</b> is a connected, read-only bridge to the owner’s local repositories,
            exposing allowlisted Git inspection such as status, history, branches and refs.
          </p>
          <div className="ma-model-section">
            <div>
              <span className="ma-mono">MODEL CHOICE IS SEPARATE FROM IDENTITY</span>
              <h3>The right model for the assignment.</h3>
              <p>
                Worker selection is independent of the main chat model. Economy is the default;
                standard and frontier require a specific justification. Dispatch preflight checks
                estimated cost, the remaining turn and plan budget, and required zero data
                retention.
              </p>
              <SourceLink path="lib/llm/subagents/orchestrator/cost-policy.ts">
                Read the model and cost policy
              </SourceLink>
            </div>
            <div className="ma-model-table">
              <table>
                <caption>Configured worker tiers in this implementation snapshot</caption>
                <thead>
                  <tr>
                    <th scope="col">Tier</th>
                    <th scope="col">Model</th>
                    <th scope="col">Use</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Micro</th>
                    <td>Gemini 3.5 Flash Lite</td>
                    <td>Triage</td>
                  </tr>
                  <tr data-default="true">
                    <th scope="row">
                      Economy <span>default</span>
                    </th>
                    <td>Claude Haiku 5.5</td>
                    <td>General work</td>
                  </tr>
                  <tr>
                    <th scope="row">Standard</th>
                    <td>Claude Sonnet 5.5</td>
                    <td>Complex work</td>
                  </tr>
                  <tr>
                    <th scope="row">Frontier</th>
                    <td>Claude Opus 5.5</td>
                    <td>Hardest reasoning</td>
                  </tr>
                </tbody>
              </table>
              <SourceLink path="lib/schemas/chat-models.ts">See configured model IDs</SourceLink>
            </div>
          </div>
          <div className="ma-return-story">
            <div>
              <span className="ma-mono">YOU KEEP THE CONTROLS</span>
              <h3>
                Open the thread.
                <br />
                Change the direction.
              </h3>
              <p>
                Inspect a specialist’s own conversation, address it directly from the composer, or
                speak to it through the voice handoff. Watch its progress and inspect Lyra’s source
                cards and research reports. Background activity settings control heartbeat cadence.
              </p>
              <SourceLink path="app/sandbox/arcadia/_components/subagent-swipe-row.tsx">
                Explore the user controls
              </SourceLink>
            </div>
            <div>
              <span className="ma-mono">THE RETURN PATH</span>
              <ol>
                <li>
                  <span>1</span>
                  <p>
                    The worker persists its response in its own thread, including supported tool
                    output and usage metadata.
                  </p>
                </li>
                <li>
                  <span>2</span>
                  <p>
                    The parent receives compact status and outcome snapshots. A notable heartbeat
                    adds a system notice and queues a parent turn.
                  </p>
                </li>
                <li>
                  <span>3</span>
                  <p>
                    The orchestrator can use <code>read_subagent_thread</code> for deeper detail,
                    then synthesize the result into the main conversation. Another handoff can
                    explicitly attach that output.
                  </p>
                </li>
              </ol>
              <SourceLink path="lib/llm/subagents/orchestrator/read-subagent-thread-tool.ts">
                Follow results back to the parent
              </SourceLink>
            </div>
          </div>
        </section>

        <section className="ma-chapter" id="presence">
          <Chapter number="05" title="Give the system a presence.">
            I wanted work to feel alive without becoming visual noise. Organic Agent is a small,
            carefully tuned language of dots, motion and glass.
          </Chapter>
          <AgentMaterialStudy />
          <div className="ma-craft-grid">
            <article>
              <span className="ma-mono">01 / THE STRUCTURE</span>
              <h3>
                Eighteen dots.
                <br />
                Individual character.
              </h3>
            </article>
            <article>
              <span className="ma-mono">02 / THE MOTION</span>
              <h3>Physics, not a looping clip.</h3>
              <p>
                My custom <b>morphPhysics</b> spring solver drives each dot’s position and scale.
                Retargeting preserves velocity, so a change of state feels continuous. One
                page-level scheduler coordinates visible marks without per-frame React renders.
              </p>
            </article>
            <article>
              <span className="ma-mono">03 / THE MATERIAL</span>
              <h3>Glass with a purpose.</h3>
              <p>
                Refraction, a fine static grain and a glass cover sit above the dots. State-specific
                blur, alpha, brightness and tint shape the exact diffusion. Material values spring
                together using the same physics foundation.
              </p>
            </article>
          </div>
          <div className="ma-performance-note">
            <span className="ma-mono">CRAFT INCLUDES RESTRAINT</span>
            <p>
              Offscreen and hidden-tab work pauses. Settled marks unregister. Reduced motion,
              Lightweight Mode, unsupported APIs and sustained performance pressure select a
              fallback. The scheduler watches CPU work and frame cadence; those measurements do not
              claim to measure GPU blur cost or battery life.
            </p>
          </div>
          <div className="ma-source-row">
            <SourceLink path="components/agents/organic-activity-mark.tsx">
              OrganicActivityMark
            </SourceLink>
            <SourceLink path="llm/morph-physics/README.md">morphPhysics</SourceLink>
            <SourceLink path="docs/design/subagent-identity-mark.md">
              Motion & material design notes
            </SourceLink>
          </div>
        </section>
        <footer className="ma-footer">
          <span className="ma-mono">DESIGNED & BUILT BY ALEX JOSHUA</span>
          <h2>
            The surface is small.
            <br />
            The system behind it isn’t.
          </h2>
          <div>
            <a
              className="ma-enter"
              href={sourceHref("lib/llm/subagents/README.md")}
              target="_blank"
              rel="noreferrer"
            >
              Explore the source <ArrowUpRight size={18} aria-hidden />
            </a>
            <a className="ma-source" href="/showcase">
              Continue the showcase <ArrowRight size={16} aria-hidden />
            </a>
          </div>
          <p>
            Public implementation, explained. Source links are pinned to the reviewed revision. All
            interactive scenarios use fictional local data; they do not read conversations, call
            models or access connected accounts.
          </p>
        </footer>
      </div>
    </article>
  );
}

function PlusMark() {
  return (
    <span className="ma-disclosure-plus" aria-hidden>
      +
    </span>
  );
}
