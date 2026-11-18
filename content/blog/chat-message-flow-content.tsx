import { BlogFigure } from "@/components/blog/blog-figure";
import { BlogSection } from "@/components/blog/blog-section";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { MessageFlowStepper, type FlowStep } from "@/components/blog/message-flow-stepper";
import { Term } from "@/components/blog/term-with-definition";

/** Top-down, plain labels. The answer is created before the model speaks; saving happens on the side. */
const CHAT_FLOW_MERMAID = `flowchart TD
  send["You press send"]
  check["Check who you are"]
  save["Save your message"]
  context["Gather context: recent messages, summary, memories"]
  model["The model answers, streaming"]
  screen["The answer appears on your screen"]
  after["Save the answer, then tidy up: title, summary, memory"]
  send --> check
  check --> save
  save --> context
  context --> model
  model --> screen
  model --> after
`;

const STEPS: readonly FlowStep[] = [
  {
    title: "You press send",
    seen: "Your message appears in the thread at once.",
    behind:
      "The chat component, built on Vercel's AI SDK, sends one POST request with your message, the model you picked, and whether web search, memory and zero data retention are on.",
  },
  {
    title: "We check who you are",
    seen: "Nothing. This takes a moment.",
    behind:
      "Clerk confirms your sign-in and Supabase maps it to your account. The server validates the request and checks that you may start a response. The identity comes from your session, never from the request body.",
  },
  {
    title: "We save your message first",
    seen: "If you refresh now, your message is still there.",
    behind:
      "The message is written to the database before the model is called, so the thread and its saved history never disagree.",
  },
  {
    title: "We gather context",
    seen: "A short status such as “Gathering context.”",
    behind:
      "The server selects the latest 10 messages, the conversation summary and any relevant memories, then builds the system prompt from them with your persona and settings.",
  },
  {
    title: "The model starts answering",
    seen: "Words begin to stream in.",
    behind:
      "The server prepares the tools for this turn (web search, memory lookup, chat-history lookup) and starts the stream. Alongside the words it sends small status events, such as thinking or using a tool, so the interface can show them without reading the raw output.",
  },
  {
    title: "You can leave and come back",
    seen: "Refresh the page mid-answer and the same answer continues.",
    behind:
      "The active stream is recorded. A separate resume request returns it when the page reconnects, so the answer picks up where it was instead of starting over.",
  },
  {
    title: "We save the answer and tidy up",
    seen: "A title appears for a new thread; the thread list updates.",
    behind:
      "On finish the answer is persisted and the stream marked done. Title generation, summary updates and optional memory writes run afterwards and never hold up the stream.",
  },
];

export function ChatMessageFlowContent() {
  return (
    <>
      <BlogSection>
        <h1>What happens when you press send</h1>
        <p className="text-lg leading-relaxed text-foreground/90">
          A message has to survive a refresh. Here is how we make sure it does: your words are saved
          first, the answer streams back as it is written, and if your connection drops the same
          answer picks up again.
        </p>

        <BlogFigure>
          <MermaidDiagram code={CHAT_FLOW_MERMAID} interactive />
        </BlogFigure>

        <h2>Follow one message</h2>
        <p>
          Each step below says what you notice and what the server is doing. Click through them.
        </p>
      </BlogSection>

      <MessageFlowStepper steps={STEPS} />

      <BlogSection>
        <h2>Why it holds up</h2>
        <ul>
          <li>
            <strong>Save first.</strong> Your message is written before the model is called, so no
            answer can exist for a message the database never saw.
          </li>
          <li>
            <strong>One way in.</strong> Sending goes through a single request. Resuming is a
            separate read, so reconnecting can never send your message twice.
          </li>
          <li>
            <strong>Status without parsing.</strong> The server tells the interface what it is doing
            through dedicated events, so “Thinking…” and “Using a tool…” are facts, not guesses from
            the text.
          </li>
          <li>
            <strong>Nothing slows the stream.</strong> Titles, summaries and memory writes happen
            after the answer is finished and saved.
          </li>
        </ul>

        <h2>A few terms</h2>
        <p>
          The chat sends a <Term>POST</Term> request and receives the answer over an{" "}
          <Term>SSE</Term> connection, which the server keeps open and writes to as the model
          produces words. A <Term>resumable stream</Term> is one the client can reconnect to by id.
        </p>
        <p>
          The 10-message window is the default for main Chat. Arcadia and Strata use different
          history budgets; the note on each surface says which.
        </p>
      </BlogSection>
    </>
  );
}
