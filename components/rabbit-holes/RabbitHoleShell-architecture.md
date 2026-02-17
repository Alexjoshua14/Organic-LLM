# RabbitHoleShell — State & Flow

Concise view of how **RabbitHoleShell** wires routing, context, the `useRabbitHoles` hook, and UI (lines 41–163).

```mermaid
flowchart TB
  subgraph inputs["Inputs"]
    R["useRouter()"]
    SP["useSearchParams()"]
    C["RabbitHoleContext\n(sessionId, setSessionId)"]
    H["useRabbitHoles()"]
  end

  subgraph hook_state["Hook state (from useRabbitHoles)"]
    session["session"]
    isLoading["isLoading"]
    isGen["isGeneratingNode"]
    genId["generatingNodeId"]
    preview["preview"]
    err["error"]
    explore["exploreQuestion"]
    follow["followBranch"]
    setNode["setActiveNode"]
    selSrc["selectedSourceId"]
    srcAnalysis["sourceAnalysis"]
    isAnalyzing["isAnalyzingSource"]
    selectSrc["selectSource"]
    clearSrc["clearSourceSelection"]
    reset["reset"]
    save["saveSessionToStorage"]
    load["loadExistingSession"]
  end

  subgraph shell_state["Shell-local state"]
    takeaway["activeTakeawayIndex"]
  end

  subgraph derived["Derived"]
    isBusy["isBusy = isLoading ∨ isGeneratingNode ∨ generatingNodeId"]
    sessionToLoad["sessionIdToLoad = searchParams.sessionId ?? contextSessionId"]
    activeNode["activeNode = session.nodesById[session.activeNodeId]"]
    pathIdx["getCurrentPathIndex()"]
    canBack["canGoBack()"]
    canFwd["canGoForward()"]
  end

  subgraph effects["Effects"]
    E1["Load past session when sessionIdToLoad set\n→ loadExistingSession()\n→ clear ?sessionId from URL & context"]
    E2["error → toast.error()"]
  end

  subgraph handlers["Event handlers → hook actions"]
    backArt["handleBackToArticle → clearSourceSelection"]
    handleReset["handleReset → reset"]
    handleStart["handleStart(question) → exploreQuestion(question)"]
    navBack["handleNavigateBack → setActiveNode(prev in path)"]
    navFwd["handleNavigateForward → setActiveNode(next in path)"]
  end

  R --> sessionToLoad
  SP --> sessionToLoad
  C --> sessionToLoad
  sessionToLoad --> E1
  E1 --> load

  H --> hook_state
  session --> activeNode
  isLoading --> isBusy
  isGen --> isBusy
  genId --> isBusy
  session --> pathIdx
  pathIdx --> canBack
  pathIdx --> canFwd
  canBack --> navBack
  canFwd --> navFwd
  setNode --> navBack
  setNode --> navFwd
  err --> E2
  clearSrc --> backArt
  reset --> handleReset
  explore --> handleStart
```

## Data flow (summary)

| Source                  | Used for                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| **URL** `?sessionId=`   | Opening a past session from browse; cleared after load.                                                     |
| **Context** `sessionId` | Same ID passed from browse when navigating in-app.                                                          |
| **useRabbitHoles**      | All session/node state, loading flags, and actions (explore, follow, select source, path nav, reset, save). |
| **Derived**             | `activeNode` (current article/sources), `isBusy`, path index and back/forward eligibility.                  |

## Center content (which panel?)

```mermaid
flowchart LR
  A{selectedSourceId?} -->|yes| B[Source Analysis]
  A -->|no| C{activeNode?}
  C -->|no & isBusy| D[Loading initial]
  C -->|no & !isBusy| E[Empty state]
  C -->|yes & isBusy & genId=activeNode| F[Loading branch]
  C -->|yes & loaded| G[Article]
  G --> H[Path back/forward]
```

- **Path navigation** uses `session.path` and `session.activeNodeId`; back/forward just call `setActiveNode(prev|next)`.
- **Prompt bar** calls `exploreQuestion` (start) or `reset` (new rabbit hole); disabled when `isBusy`.
