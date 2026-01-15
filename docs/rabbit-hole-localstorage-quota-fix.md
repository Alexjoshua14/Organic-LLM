# RabbitHole localStorage Quota Fix

## Problem

Users were experiencing `QuotaExceededError` when trying to save RabbitHole sessions to localStorage.

## Root Cause

The `saveSession` function in `data/local/rabbitholes.ts` had a critical bug:

1. **Full sessions** are stored with keys like `rabbit-hole-session-{sessionId}` (each ~150-400 KB)
2. **Metadata list** is limited to 50 sessions in `rabbit-hole-sessions`
3. **BUT**: When the metadata list was trimmed to 50, the old full sessions were **never deleted**

### Impact

- After creating 50+ sessions, you'd have:
  - 50 entries in metadata list
  - 100+ full sessions still in localStorage
  - Total storage: 15-40+ MB (exceeding typical 5-10 MB localStorage limit)

## Solution

Added automatic cleanup of orphaned sessions:

1. **`cleanupOrphanedSessions()` function**: 
   - Finds all session keys in localStorage
   - Compares against valid session IDs from metadata
   - Deletes orphaned full sessions

2. **Automatic cleanup**:
   - Runs before saving new sessions
   - Runs when listing sessions (`getAllSessions`)
   - Prevents quota issues proactively

3. **Aggressive cleanup on quota error**:
   - If quota exceeded, automatically reduces to top 20 sessions
   - Retries the save operation
   - Provides better error recovery

## Code Changes

### Added Functions
- `cleanupOrphanedSessions()`: Exported cleanup utility
- Enhanced `saveSession()`: Automatic cleanup + quota error handling

### Behavior
- Sessions are automatically cleaned up when:
  - Saving a new session
  - Listing sessions
  - Quota exceeded (aggressive cleanup)

## Manual Cleanup

If you need to manually clean up orphaned sessions:

```typescript
import { cleanupOrphanedSessions } from "@/data/local/rabbitholes";

// Run cleanup
cleanupOrphanedSessions();
```

## Prevention

Going forward:
- Only sessions in the metadata list (top 50) are kept
- Old sessions are automatically deleted
- Quota errors trigger automatic cleanup
- Users should no longer hit quota limits under normal usage

## Storage Limits

With the fix:
- **Maximum stored**: 50 full sessions × 400 KB = ~20 MB
- **Typical usage**: 10-20 sessions × 300 KB = ~3-6 MB
- **Well within**: Typical 5-10 MB localStorage limit

## Migration Notes

Existing users with quota issues:
1. The cleanup will run automatically on next session save/list
2. Orphaned sessions will be removed
3. Only the top 50 sessions (by recency) will remain
