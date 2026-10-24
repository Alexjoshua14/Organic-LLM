# HLD: Extended Markdown Directive System

## 1. System Overview

This system extends standard Markdown (CommonMark/GFM) to support "Directives"—syntactical markers that signal the presence of dynamic, distinct UI components. These directives serve as the bridge between **text generation** (LLM output) and **application logic** (Knowledge Queries/UI Rendering).

### Core Design Principles

1.  **Parsing Efficiency:** The syntax must be identifiable via simple Regex or standard AST tokenizers without requiring a full DOM simulation.
2.  **Transport Agnostic:** The directives function as plain text payloads until hydrated by the client.
3.  **Declarative Intent:** The syntax defines _what_ data is needed (Props), not _how_ to fetch it (Implementation).

---´

## 2. Syntax Specification

The syntax follows the "Leaf Directive" pattern, using double colons (`::`) as the trigger token.

### 2.1 Grammar

```ebnf
Directive       ::= "::" ComponentName Attributes
ComponentName   ::= [a-z0-9-]+
Attributes      ::= "{" Whitespace? PropList Whitespace? "}"
PropList        ::= PropItem (Whitespace PropItem)*
PropItem        ::= Key "=" Value
Key             ::= [a-zA-Z0-9_]+
Value           ::= '"' [^"]* '"'
```

### 2.2 Example Payload

```markdown
::knowledge-card{ query="project alpha deadlines" limit="5" view="timeline" }
```

### 2.3 Semantic Parts

- **Marker (`::`)**: Signals the start of a custom leaf node.
- **Identifier (`knowledge-card`)**: Maps to a specific registered UI component in the frontend registry.
- **Props Block (`{ ... }`)**: A key-value pair list containing the arguments required to execute the component's logic (e.g., the search query, display limits).

---

## 3. Architecture & Data Flow

### 3.1 Logical Layers

1.  **Generation Layer (LLM)**

    - **Role:** Produces the directive string as part of the natural language stream.
    - **Constraint:** Must output valid directive syntax instead of hallucinated JSON blocks or plain text descriptions.

2.  **Processing Layer (Middleware/Parser)**

    - **Input:** Raw Markdown string.
    - **Processor:** A Markdown-to-AST parser (e.g., `unified`, `remark-directive`, or `markdown-it-container`).
    - **Transformation:** Converts the text string `::name{props}` into a Structured Node:
      ```json
      {
        "type": "leafDirective",
        "name": "knowledge-card",
        "attributes": {
          "query": "project alpha deadlines",
          "limit": "5",
          "view": "timeline"
        }
      }
      ```

3.  **Resolution Layer (Client/Server Hybrid)**
    - **Router:** Intercepts nodes with type `leafDirective`.
    - **Fetcher:** Executes the asynchronous logic defined by the props (e.g., performing the vector search for "project alpha").
    - **Hydration:** Replaces the AST node with the resolved React/Vue component, injecting the fetched data.

### 3.2 Sequence Diagram (Abstract)

```text
User Request -> LLM -> Markdown Stream
Markdown Stream -> Parser -> AST (Abstract Syntax Tree)
AST Traversal -> Detect '::' Node -> Trigger Component Loader
Component Loader -> Execute Query (based on props) -> Return Data
Renderer -> Swap Node for UI Component(Data) -> DOM
```

---

## 4. Integration Points

### 4.1 LLM System Prompt

The AI must be instructed to utilize this syntax explicitly.

- **Trigger:** "When data retrieval is better suited for a visual representation than text."
- **Output:** Strict adherence to the `::name{key="val"}` format.

### 4.2 Component Registry

The frontend application requires a mapping file:

```javascript
const COMPONENT_REGISTRY = {
  "knowledge-card": import("./components/KnowledgeCard"),
  timeline: import("./components/Timeline"),
  "data-table": import("./components/DataTable"),
};
```
