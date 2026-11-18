import Link from "next/link";

import { BlogCode } from "@/components/blog/blog-code";
import { BlogFigure } from "@/components/blog/blog-figure";
import { BlogSection } from "@/components/blog/blog-section";
import { MessageFlowStepper, type FlowStep } from "@/components/blog/message-flow-stepper";
import { VoiceLayersFigure } from "@/components/blog/voice-layers-figure";
import { VoiceRibbonDemo } from "@/components/blog/voice-ribbon-demo";

const STEPS: readonly FlowStep[] = [
  {
    title: "You press the mic",
    seen: "The bar appears and the ribbon starts to move.",
    behind:
      "Before anything else, the browser checks it can capture audio and asks for the microphone. A denied permission shows recovery steps and costs nothing: no server session is created until the mic is ready.",
  },
  {
    title: "The server prepares a session",
    seen: "Nothing. It takes a moment.",
    behind:
      "Our server picks the thread to continue, writes the instructions (including a short recap of the thread and relevant memories when resuming), compiles the tools this session may use, and asks OpenAI for a short-lived client secret. The browser never holds a long-lived key.",
  },
  {
    title: "Audio flows directly",
    seen: "You talk; it listens.",
    behind:
      "The browser opens a WebRTC connection to OpenAI's Realtime API with that secret. Audio goes straight to the model and straight back, with no relay of ours in the middle, which keeps latency low.",
  },
  {
    title: "You are heard, and you can interrupt",
    seen: "It answers as you finish a sentence, and stops if you cut in.",
    behind:
      "OpenAI's model handles turn-taking. Our event classifier turns its stream of raw events into a small set of facts: you started speaking, it started answering, audio is actually playing, a tool was requested.",
  },
  {
    title: "It reaches for a tool",
    seen: "A card appears beside the conversation; if the lookup is quick, nothing is said about it.",
    behind:
      "The model asks for a tool by name. Our server runs it (a memory search, a generated interface block, a web preview) and returns the result as the next input. The rule we locked: stay silent if the tool returns in under a second, acknowledge before a longer wait, and show one visual anchor per turn.",
  },
  {
    title: "It is saved like any conversation",
    seen: "The thread shows the exchange later, in text.",
    behind:
      "Completed turns are written to the thread as ordinary messages, then the title and summary are refreshed and complete exchanges can be added to memory if you opted in. Voice and text are one history.",
  },
];

const TRANSPORT_SEAM = `export interface VoiceTransport {
  readonly kind: "webrtc" | "relay";
  readonly localStream: MediaStream | null;
  readonly remoteStream: MediaStream | null;
  /** Check browser support and ask for the mic before any server session exists. */
  prepare?(): Promise<void>;
  connect(args: { clientSecret: string }, events: VoiceTransportEvents): Promise<void>;
  /** Client event up to the model. Returns false when the channel is not open. */
  send(event: Record<string, unknown>): boolean;
  close(): void;
}`;

const EVENTS = `export type SpeakRealtimeEvent =
  | { kind: "user_speech_started" }
  | { kind: "user_speech_stopped" }
  | { kind: "assistant_started" }
  | { kind: "assistant_finished"; usage: RealtimeUsage | null }
  // WebRTC only: model audio actually reaching the speaker. Playback outlives
  // response.done, so these, not the response lifecycle, say whether it is still talking.
  | { kind: "assistant_playback_started" }
  | { kind: "assistant_playback_stopped" }
  | { kind: "user_transcript"; text: string; itemId: string | null }
  | { kind: "assistant_transcript_delta"; delta: string }
  | { kind: "tool_call"; callId: string; name: string; args: string }
  // …`;

const OURS: ReadonlyArray<readonly [piece: string, whose: string, what: string]> = [
  [
    "Speech recognition, voice, turn-taking",
    "OpenAI",
    "The Realtime API hears you, decides when you are done, and speaks.",
  ],
  [
    "Session minting",
    "Ours",
    "Chooses the thread, writes instructions, compiles tools, requests a short-lived secret.",
  ],
  [
    "Transport seam",
    "Ours",
    "One interface over how audio reaches the model, so the connection can change without touching the rest.",
  ],
  [
    "Event classifier",
    "Ours",
    "Turns the model's raw event stream into a few facts the app reacts to; pure and tested without a microphone.",
  ],
  [
    "Session that outlives pages",
    "Ours",
    "Lives in the root layout, so the call survives navigation and resumes after a reload.",
  ],
  [
    "Tools and their behaviour",
    "Ours",
    "The tool set, how each runs, and the rules for what is said and what is shown.",
  ],
  [
    "Threads, transcripts, memory",
    "Ours, on Supabase and Mem0",
    "Voice turns become ordinary thread messages; memory is a per-session opt-in.",
  ],
  [
    "Screen awareness",
    "Ours",
    "Pages tell the voice what is on screen, silently, so it can answer about it.",
  ],
  [
    "The ribbon and the stage",
    "Ours",
    "The live waveform, the glass material and the stage that shows cards and captions.",
  ],
];

export function RealtimeVoiceContent() {
  return (
    <>
      <BlogSection>
        <h1>Talking to Organic LLM</h1>
        <p className="text-lg leading-relaxed text-foreground/90">
          You can talk to Organic LLM the way you type to it. It is the same threads and the same
          memory, with many of the same tools, and the call keeps going while you move around the
          app. OpenAI supplies the speech model; everything around it is ours, and this post is
          about that part.
        </p>

        <h2>What it feels like</h2>
        <ul>
          <li>
            <strong>Hands-free and interruptible.</strong> Speak, and it answers as you finish a
            sentence. Cut in, and it stops.
          </li>
          <li>
            <strong>It carries on.</strong> The call survives navigating to another page and resumes
            after a reload, continuing the same thread and clock.
          </li>
          <li>
            <strong>It can see what you see.</strong> Open a chat, a Strata document or a Rabbit
            Hole, and the voice knows what is on screen without being told.
          </li>
          <li>
            <strong>It shows as well as tells.</strong> When a card helps, it appears beside the
            conversation, while the voice stays on the gist.
          </li>
          <li>
            <strong>It looks after itself.</strong> A call that goes quiet pauses and releases the
            microphone, and one tap resumes it.
          </li>
        </ul>
        <p>
          There is a scripted, no-microphone walkthrough at{" "}
          <Link href="/showcase/voice">the voice showcase</Link>.
        </p>

        <h2>Who does what</h2>
        <p>
          OpenAI&apos;s Realtime API listens, takes turns and speaks. Everything else is built here.
          The browser talks to OpenAI directly over WebRTC; our server never sits in the audio path.
          It prepares the session, runs the tools and keeps the record.
        </p>
      </BlogSection>

      <VoiceLayersFigure />

      <BlogFigure>
        <div className="overflow-hidden rounded-xl border border-border bg-secondary/40">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-inset-lg py-stack-md font-medium">Piece</th>
                <th className="px-inset-lg py-stack-md font-medium">Whose</th>
                <th className="hidden px-inset-lg py-stack-md font-medium @xl:table-cell">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {OURS.map(([piece, whose, what]) => (
                <tr key={piece} className="align-top">
                  <th className="px-inset-lg py-stack-md font-medium text-foreground">
                    {piece}
                    <span className="mt-stack-xs block text-xs font-normal text-muted-foreground @xl:hidden">
                      {what}
                    </span>
                  </th>
                  <td className="px-inset-lg py-stack-md text-foreground/90">{whose}</td>
                  <td className="hidden px-inset-lg py-stack-md text-muted-foreground @xl:table-cell">
                    {what}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BlogFigure>

      <BlogSection>
        <h2>Follow one spoken turn</h2>
        <p>Each step says what you notice and what is happening underneath.</p>
      </BlogSection>

      <MessageFlowStepper caption="Click through one spoken exchange." steps={STEPS} />

      <BlogSection>
        <h2>The pieces we built</h2>

        <h3>A call that outlives the page</h3>
        <p>
          The voice session lives in the app&apos;s root layout, because the App Router keeps that
          layout across client-side navigation. Held inside a page, the connection would die on
          every route change. A hard reload is covered too: the server reports the live session, and
          the new one inherits the thread and the clock, so reloading cannot extend a session. The
          cost is about a second of audio.
        </p>

        <h3>A seam for the connection</h3>
        <p>
          The hook that owns the session&apos;s lifecycle, from minting to heartbeats to
          transcripts, does not decide how audio reaches the model. That sits behind one small
          interface. Today the browser holds the peer connection; a server-side relay could replace
          it without the hook or any screen changing.
        </p>
        <BlogCode
          caption="The transport interface, trimmed."
          code={TRANSPORT_SEAM}
          language="typescript"
        />

        <h3>Turning a firehose into facts</h3>
        <p>
          OpenAI&apos;s stream is a flood of low-level events whose names have changed between API
          versions. One pure function classifies them into a few things the app cares about. It also
          encodes a lesson learned the hard way: a response can finish well before its audio does,
          so &ldquo;is it still talking?&rdquo; is answered by playback events, not by the end of
          the response.
        </p>
        <BlogCode
          caption="The facts the app reacts to, trimmed."
          code={EVENTS}
          language="typescript"
        />

        <h3>Shared tools, with manners</h3>
        <p>
          Voice shares Organic LLM&apos;s memory and its generated-interface blocks. It has eight
          tools today: memory search, display text, generated UI, refreshing a component, shared UI
          state, a web preview, and thread title and summary. What matters as much is how they
          behave. Speech carries the relationship and visuals carry the evidence. A fast lookup is
          never narrated, because saying &ldquo;let me check&rdquo; on a 300 ms memory hit makes the
          agent feel slower than it is.
        </p>

        <h3>One history, in two modes</h3>
        <p>
          A new call continues the latest voice thread by default. On resume, the instructions
          include the thread summary, memories seeded from it and the last few turns, under a size
          cap. Finished turns are saved as ordinary messages, so you can read what you said later,
          and memory stays a per-session opt-in, mirroring the text composer.
        </p>

        <h3>Awareness without chatter</h3>
        <p>
          Pages register what is on screen: a chat&apos;s title and latest messages, a Strata
          document, an open Rabbit Hole and its map. The server turns that into text and the client
          sends it as a silent system item that replaces the last one, so the voice can answer
          &ldquo;what is this?&rdquo; without ever announcing that the screen changed.
        </p>

        <h3>Quiet calls end themselves</h3>
        <p>
          A call that has gone silent, with nothing playing and no tool running, settles and
          releases the microphone, then waits, paused. Resume continues the same thread. It exists
          because a call that outlives its page is easy to forget, and an open microphone is
          something a person should not have to remember.
        </p>

        <h3>The ribbon</h3>
        <p>
          The live bar&apos;s waveform is a band of thin strokes interpolated between three
          wandering curves, one each for volume, treble and bass. Where the curves converge the
          strokes pack into solid light; where they spread you see the individual lines. It floors
          at a gentle drift so a silent call never looks disconnected, and it writes path data
          straight to the DOM each frame, so the app does not re-render sixty times a second. Below
          is the real geometry on sliders.
        </p>
      </BlogSection>

      <VoiceRibbonDemo />

      <BlogSection>
        <h2>Checked, not hoped</h2>
        <p>
          The risky logic is pure on purpose: the event classifier, the visual-state reducer, the
          idle rule, the usage meter and the ribbon geometry are all functions of their inputs, so
          they are tested without a peer connection or a microphone. More than two dozen test files
          cover voice. Usage is measured honestly, including cached audio and quiet intervals,
          rather than estimated and hoped for.
        </p>

        <h2>What it is not yet</h2>
        <ul>
          <li>
            <strong>Fewer tools than text chat.</strong> Web search, tasks, restaurants and diagrams
            are not reachable by voice yet.
          </li>
          <li>
            <strong>A small gap on reload.</strong> A resumed call has about a second of silence.
          </li>
          <li>
            <strong>Older detail fades.</strong> The live model keeps a bounded window of the
            conversation; the saved transcript and the resume recap keep the rest.
          </li>
        </ul>
        <p>
          Voice is the newest of the surfaces. For the others, see{" "}
          <Link href="/blog/surfaces">Surfaces</Link>.
        </p>
      </BlogSection>
    </>
  );
}
