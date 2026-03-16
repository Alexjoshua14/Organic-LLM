# RabbitHole Session Data Size Estimate

## Structure Overview

A `RabbitHoleSession` contains:
- Session metadata (sessionId, rootQuestion, timestamps)
- Path segments (navigation history)
- Nodes (the main content - articles, sources, branches)
- Edges (relationships between nodes)

## Per-Node Breakdown

### Core Node Data
- **id**: UUID string (~36 bytes)
- **rawPrompt**: System prompt string (~500-2,000 chars = ~500-2,000 bytes)
- **userQuestion**: User-visible question (~50-200 chars = ~50-200 bytes)
- **keyTakeaways**: Array of 3-6 strings, each ~50-150 chars = ~300-900 bytes total
- **articleHtml**: **LARGEST COMPONENT** - HTML article content
  - Max output tokens: 7,000 (from `maxOutputTokens: 7000`)
  - Average chars per token: ~4
  - Estimated size: **~20,000-30,000 bytes** (20-30 KB)
- **createdAt**: ISO timestamp string (~24 bytes)

### Optional Node Data

#### Sources (typically 5-10 per node)
Each source contains:
- **id**: UUID (~36 bytes)
- **title**: ~50-200 bytes
- **url**: ~50-200 bytes
- **faviconUrl**: optional (~50-100 bytes)
- **snippet**: optional (~100-500 bytes)
- **publishedDate**: optional (~24 bytes)
- **author**: optional (~20-100 bytes)
- **highlights**: optional array (~200-1,000 bytes total)
- **analysis**: optional object (~500-2,000 bytes)

**Per source**: ~1,000-4,000 bytes
**5-10 sources**: ~5,000-40,000 bytes (5-40 KB)

#### Branch Suggestions (5-11 per node)
Each branch suggestion:
- **id**: UUID (~36 bytes)
- **label**: ~50-200 bytes
- **shortDescription**: optional (~50-200 bytes)

**Per branch**: ~100-400 bytes
**5-11 branches**: ~500-4,400 bytes (0.5-4.4 KB)

### Total Per Node
- **Minimum** (no sources, minimal content): ~25 KB
- **Typical** (5 sources, 8 branches): ~50-75 KB
- **Maximum** (10 sources, 11 branches, full article): ~75-100 KB

## Session-Level Data

### Session Metadata
- **sessionId**: UUID (~36 bytes)
- **rootQuestion**: ~50-200 bytes
- **activeNodeId**: UUID or null (~36 bytes)
- **createdAt**: ISO timestamp (~24 bytes)
- **updatedAt**: ISO timestamp (~24 bytes)

**Total**: ~200 bytes

### Path Segments
Each path segment:
- **nodeId**: UUID (~36 bytes)
- **label**: ~50-200 bytes
- **parentNodeId**: UUID or null (~36 bytes)

**Per segment**: ~120-270 bytes
**Typical session (3-5 nodes)**: ~360-1,350 bytes

### Edges
Each edge:
- **from**: UUID (~36 bytes)
- **to**: UUID (~36 bytes)
- **type**: optional enum (~10 bytes)

**Per edge**: ~80-90 bytes
**Typical session (2-4 edges)**: ~160-360 bytes

## Total Session Size Estimates

### Small Session (1 node, minimal sources)
- 1 node: ~25 KB
- Session metadata: ~0.2 KB
- Path: ~0.2 KB
- Edges: ~0.1 KB
- **Total: ~25-30 KB**

### Typical Session (3-5 nodes, moderate sources)
- 3-5 nodes: ~150-375 KB
- Session metadata: ~0.2 KB
- Path: ~0.5 KB
- Edges: ~0.3 KB
- **Total: ~150-380 KB (0.15-0.38 MB)**

### Large Session (10+ nodes, many sources)
- 10 nodes: ~500-1,000 KB
- Session metadata: ~0.2 KB
- Path: ~1 KB
- Edges: ~0.5 KB
- **Total: ~500-1,000 KB (0.5-1 MB)**

### Maximum Session (20 nodes, all sources analyzed)
- 20 nodes: ~1,500-2,000 KB
- Session metadata: ~0.2 KB
- Path: ~2 KB
- Edges: ~1 KB
- **Total: ~1.5-2 MB**

## JSON Serialization Overhead

When stored as JSON (e.g., in localStorage or database):
- JSON adds ~10-20% overhead for structure (quotes, brackets, commas)
- **Actual storage size**: Estimated size × 1.1-1.2

## Database Storage Considerations

If stored in a database:
- Text compression can reduce size by 30-50%
- Binary JSON (JSONB) is more efficient than text JSON
- Indexes add overhead but don't affect data size

## Recommendations

1. **Typical session**: Expect **150-400 KB** (0.15-0.4 MB) per session
2. **Storage limit**: localStorage has ~5-10 MB limit per domain
   - Can store ~10-25 typical sessions
   - Consider server-side storage for more sessions
3. **Database storage**: With compression, typical session ~100-300 KB
4. **Largest component**: `articleHtml` in each node (20-30 KB each)

## Notes

- Size varies significantly based on:
  - Number of nodes explored
  - Number of sources per node
  - Whether source analyses are included
  - Length of generated articles
- The `maxOutputTokens: 7000` limit caps article size at ~28,000 characters
- Source analyses are optional and only added when user explicitly requests them
