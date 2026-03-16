import { BlogSection } from "@/components/blog/blog-section";
import { MermaidDiagram } from "@/components/blog/mermaid-diagram";

const CHAT_FLOW_MERMAID = `flowchart LR
  subgraph client [Client]
    chatUi[Chat UI]
    chatInput[Chat Input]
    chatUi --> chatInput
  end

  subgraph route [Main chat endpoint]
    authStep[Auth Clerk to Supabase]
    saveUser[Save user message]
    buildContext[Build context]
    runModel[Run model stream]
    postProcess[Persist and post-process]
    authStep --> saveUser
    saveUser --> buildContext
    buildContext --> runModel
    runModel --> postProcess
  end

  subgraph response [Response]
    resumable[Resumable stream response]
  end

  chatInput -->|POST| authStep
  postProcess --> resumable
  resumable -->|SSE| chatUi
`;

export function ChatMessageFlowContent() {
  return (
    <BlogSection>
      <h1>Chat Message Flow</h1>
      <p>
        This page describes the main path a message takes from the chat UI to the API and back: how
        the client sends a message, how the server builds context and streams a response, and what
        makes this flow reliable and resumable.
      </p>

      <h2>Problem statement</h2>
      <p>
        We need a reliable, resumable chat flow: the user sends a message, the server builds context
        (history, summaries, memory), calls the LLM with tools, streams the response, and persists
        it—with minimal latency and support for refresh or reconnect. The design had to support
        multiple personas, optional tools (web search, memory), and post-response work (titles,
        summaries, memory) without blocking the stream.
      </p>

      <h2>What&apos;s implemented</h2>

      <h3>Client</h3>
      <ul>
        <li>
          The <strong>Chat</strong> component uses <code>useChat</code> from Vercel&apos;s AI SDK
          with a default chat transport.
        </li>
        <li>Requests go to the main chat endpoint (optionally scoped by persona).</li>
        <li>
          <strong>Chat input</strong> calls <code>sendMessage(&#123; text, files &#125;)</code>,
          which triggers a POST containing the user&apos;s latest message, selected model, and
          whether web search, memory, and zero data retention are enabled (plus additional chat
          settings).
        </li>
      </ul>

      <h3>Server</h3>
      <p>
        <strong>Main chat request flow:</strong>
      </p>
      <ol>
        <li>
          Auth: Clerk → Supabase.
          <span className="text-sm block mt-1">
            Clerk handles authentication.
            <br />
            Supabase provides the app-side user mapping and data authorization boundary.
          </span>
        </li>
        <li>Validate the request payload and settings.</li>
        <li>
          Save the user&apos;s message right away so the UI and persisted history stay in sync.
        </li>
        <li>
          In parallel: <strong>(a)</strong> Build context by gathering recent messages, conversation
          summary, optional memory retrieval, and optional persisted schemas. <strong>(b)</strong>{" "}
          Compile the system prompt using that context plus persona and request settings.
        </li>
        <li>
          Prepare tools for this turn (web search, memory lookup, and conversation-history retrieval
          when needed).
        </li>
        <li>Start model streaming with the selected model, prepared context, and tools.</li>
        <li>
          Stream tokens/events back to the UI, including side-channel status updates (for example:
          processing, reasoning, tool use).
        </li>
        <li>
          On finish, persist the final assistant response, clear active stream state, and kick off
          post-processing (title generation, summary updates, optional memory writes).
        </li>
        <li>
          Return a resumable stream response so the client can reconnect and continue reading output
          if needed.
        </li>
      </ol>

      <h3>Resume</h3>
      <ul>
        <li>
          <strong>Resume endpoint:</strong> Returns an existing active stream when the client
          reconnects (for example after a refresh).
        </li>
      </ul>

      <p>The following diagram summarizes the main flow in plain terms:</p>
      <MermaidDiagram code={CHAT_FLOW_MERMAID} />

      <h2>Key features</h2>
      <ul>
        <li>
          <strong>Optimistic save</strong> of the user message before the stream starts.
        </li>
        <li>
          <strong>Context assembly:</strong> The server gathers recent messages, conversation
          summary, optional memories, and optional persisted schemas, then builds the system prompt.
        </li>
        <li>
          <strong>Tools:</strong> Web search, memory search, and chat-history retrieval tools are
          compiled server-side and passed to the model stream with tool instructions.
        </li>
        <li>
          <strong>Side-channel events:</strong> The server emits structured UI events (for example:
          processing, reasoning, tool usage, memory updates, and title-ready notifications) so the
          interface can show live status without parsing raw model output.
        </li>
        <li>
          <strong>Resumable streams:</strong> Active stream state is saved so the client can
          reconnect after refresh/disconnect and continue the same response.
        </li>
        <li>
          <strong>Post-response:</strong> Ensure chat title (when ≥4 messages), update conversation
          summary, optionally add latest messages to memory.
        </li>
      </ul>

      <h2>Distinguishing pieces</h2>
      <ul>
        <li>
          <strong>Single write path:</strong> Message sends go through one primary POST flow, while
          resume reads use a separate GET endpoint.
        </li>
        <li>
          <strong>Resumable delivery:</strong> Stream progress is persisted and can be resumed,
          improving reliability on refresh or temporary network loss.
        </li>
        <li>
          <strong>Context and tools</strong> are fully server-side; no client-supplied identity
          beyond authentication.
        </li>
        <li>
          <strong>UI-friendly streaming protocol:</strong> The response includes dedicated
          status/event messages so the UI can show states like &quot;Thinking…&quot; or &quot;Using
          tool…&quot; cleanly.
        </li>
      </ul>
    </BlogSection>
  );
}
