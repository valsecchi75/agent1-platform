# Design: JWT Edge Runtime Fix + Storage Consolidation

**Date:** 2026-03-25
**Status:** Approved
**Author:** Brainstorming session with Sergio Valsecchi

---

## Problem Statement

Two blocking issues prevent the app from starting correctly:

1. **Edge Runtime error:** `src/middleware.ts` imports `src/lib/auth/jwt.ts`, which uses Node.js-only APIs (`process.cwd()`, `fs`, `crypto.randomBytes`, `path`). Next.js middleware runs in the Edge Runtime, which only supports Web APIs. Result: warning at startup, middleware silently disabled.

2. **Storage path inconsistency (bug):** Two sets of paths point to different directories:
   - `fileNaming.ts` writes generated files to `app/app/output/`
   - `output-browser/route.ts` reads from `app/output/`
   - `input-images/route.ts` reads from `app/input/`
   - `fileNaming.ts` writes uploads to `app/app/input/`

   This means generated files are invisible to the output browser. Additionally, the `app/app/` directory name is identical to the Next.js App Router directory, causing confusion.

---

## Goals

- Fix the Edge Runtime error so authentication works in middleware
- Unify all storage paths under a single, clearly named `storage/` directory
- Remove completed development artifacts (R4 refactor docs)
- Eliminate duplicate empty input/output directories

---

## Non-Goals

- Changing authentication logic
- Refactoring the workflow execution system
- Changes to `src/lib/auth/jwt.ts` (left intact for server-side use)
- Database path changes (`data/` stays as-is)

---

## Design

### Assumptions

- `process.cwd()` in all path operations refers to the Next.js project root (`app/` directory), which is where `start.sh` launches the server from. All relative paths in code are anchored to this directory.

---

### Part 1: JWT Edge Runtime Fix

**New file: `src/lib/auth/jwt-edge.ts`**

A minimal, Edge Runtime-compatible JWT verification module. Uses only `jose` (already a dependency, fully edge-compatible) and `process.env` (available in Edge Runtime).

Responsibilities:
- Single exported function: `verifyTokenEdge(token: string): Promise<Record<string, unknown> | null>`
- Reads `JWT_SECRET` from `process.env`
- Returns `null` if token is invalid or secret is missing/too short (middleware treats null as unauthenticated → redirect to `/login`)
- No fallback secret generation (that requires Node.js fs)

**Modified file: `src/middleware.ts`**

Change one import line:
```ts
// Before:
import { verifyToken } from '@/lib/auth/jwt';
// After:
import { verifyTokenEdge } from '@/lib/auth/jwt-edge';
```

Replace all calls to `verifyToken(token)` with `verifyTokenEdge(token)`.

**Modified file: `src/lib/auth/jwt.ts`**

No changes. Continues to handle token signing and secret auto-generation for server-side API routes.

**Modified file: `src/app/api/login-assets/route.ts`**

This route serves static login page assets and is in `PUBLIC_PATHS` — no authentication change needed. However, it must be verified to not import from `jwt.ts` directly. If it does, it must be updated to use server-side imports only (not `jwt-edge.ts`).

**Modified file: `start.sh`**

Add a JWT_SECRET auto-generation step using Node.js (`node -e "require('crypto').randomBytes(32).toString('hex')"` — avoids dependency on `openssl` which may not be present on all systems). This ensures `.env` always has a valid secret before the server starts, since the edge version can no longer auto-generate at runtime.

Logic:
1. Check if `JWT_SECRET` is already set and valid in `.env` (using `grep -q "^JWT_SECRET=.\{32,\}"`)
2. If missing or too short (< 32 chars), generate a new 64-char hex string using Node.js crypto and append `JWT_SECRET=<value>` to `.env`
3. If `.env` does not exist, create it with the generated secret
4. If Node.js `crypto` fails (extremely unlikely), print a clear error message and exit with code 1 — do not start the server with a missing secret

---

### Part 2: Storage Directory Consolidation

**Rename:** `app/app/` → `storage/` (at the Next.js project root)

**New canonical structure:**
```
storage/
├── input/              ← uploaded source images
├── output/
│   ├── images/         ← generated images (agent1_XXXX.jpg/png)
│   ├── videos/         ← generated videos (agent1_XXXX.mp4)
│   └── audio/          ← generated audio files
└── workflows/          ← saved workflow JSON files
```

**Migrate existing data:**
- `app/app/output/images/agent1_0001.jpg` → `storage/output/images/agent1_0001.jpg`
- Any other files in `app/app/` subdirectories

**Remove:**
- `input/` directory (root-level, empty, only contained `.gitkeep`) — replaced by `storage/input/`
- `output/` directory (root-level, only `.gitkeep` files) — replaced by `storage/output/`
- `app/app/` directory (empty after migration)

**Code changes (1-liner each):**

| File | Change |
|------|--------|
| `src/lib/storage/fileNaming.ts` line 18 | `resolve(process.cwd(), "app")` → `resolve(process.cwd(), "storage")` |
| `src/lib/storage/fileNaming.ts` (header comment) | Update JSDoc/comment referencing `app/app/` paths to reference `storage/` |
| `src/app/api/output-browser/route.ts` | `path.resolve(process.cwd(), "output")` → `path.resolve(process.cwd(), "storage", "output")` |
| `src/app/api/input-images/route.ts` | `path.resolve(process.cwd(), "input")` → `path.resolve(process.cwd(), "storage", "input")` |

**Modified file: `start.sh`**

Replace `mkdir -p data/generations` with expanded directory creation (storage dirs added after JWT_SECRET generation):
```bash
mkdir -p data/generations
mkdir -p storage/input
mkdir -p storage/output/images
mkdir -p storage/output/videos
mkdir -p storage/output/audio
mkdir -p storage/workflows
```

**Migration of existing data (one-time, in `start.sh`):**

Before renaming, migrate any existing files from `app/app/` to `storage/`:
```bash
# Migrate app/app/ → storage/ (one-time, safe to run on every start)
if [ -d "app/app" ]; then
  cp -rn app/app/output/. storage/output/ 2>/dev/null || true
  cp -rn app/app/input/. storage/input/ 2>/dev/null || true
  cp -rn app/app/workflows/. storage/workflows/ 2>/dev/null || true
  echo "Migrated app/app/ to storage/ (app/app/ can be removed manually)"
fi
```

Note: `cp -rn` (no-clobber) ensures existing files in `storage/` are not overwritten. After confirming migration, `app/app/` can be deleted manually or in a future cleanup step.

**Modified file: `.gitignore`**

Add storage directories (user-generated data should not be committed). The glob excludes (`!`) are listed immediately after their corresponding wildcard excludes so git processes them in the correct order:
```
# Generated output files
/storage/input/*
!/storage/input/.gitkeep
/storage/output/images/*
!/storage/output/images/.gitkeep
/storage/output/videos/*
!/storage/output/videos/.gitkeep
/storage/output/audio/*
!/storage/output/audio/.gitkeep
/storage/workflows/*
!/storage/workflows/.gitkeep
```

---

### Part 3: Documentation Cleanup

**Remove (completed refactor artifacts):**
- `R4_CHECKLIST.md` — refactor task checklist, all items complete
- `R4_REFACTOR_SUMMARY.md` — refactor completion summary, no longer needed at root

**Create:**
- `docs/` directory for project documentation

**Move:**
- `prd-image-workflow.md` → `docs/prd-image-workflow.md`

**Keep at root (standard locations):**
- `CLAUDE.md` — Claude Code project context
- `README.md` — user-facing setup guide
- `CHANGELOG.md` — version history
- `LICENSE` — open source license

---

## File Inventory

### New files
| File | Purpose |
|------|---------|
| `src/lib/auth/jwt-edge.ts` | Edge-compatible JWT verification |
| `docs/prd-image-workflow.md` | (moved) Product requirements |
| `storage/` directory tree | (renamed from app/app/) |

### Modified files
| File | Change |
|------|--------|
| `src/middleware.ts` | Import from jwt-edge, call verifyTokenEdge |
| `src/lib/storage/fileNaming.ts` | Path: "app" → "storage"; update header comment |
| `src/app/api/output-browser/route.ts` | Path: "output" → "storage/output" |
| `src/app/api/input-images/route.ts` | Path: "input" → "storage/input" |
| `src/app/api/login-assets/route.ts` | Verify no direct jwt.ts import (read-only check; update if needed) |
| `start.sh` | Add JWT_SECRET generation (Node.js crypto) + storage dir creation + migration |
| `.gitignore` | Add storage/* entries with correct exclude ordering |

### Deleted files/directories
| Path | Reason |
|------|--------|
| `R4_CHECKLIST.md` | Completed refactor artifact |
| `R4_REFACTOR_SUMMARY.md` | Completed refactor artifact |
| `prd-image-workflow.md` | Moved to docs/ |
| `input/` | Replaced by storage/input/ |
| `output/` | Replaced by storage/output/ |
| `app/app/` | Renamed to storage/ |

---

## Error Handling

- **JWT secret missing at runtime:** `verifyTokenEdge` returns `null` → middleware redirects to `/login`. The `start.sh` auto-generation ensures this is rare in practice.
- **JWT_SECRET generation failure in start.sh:** If Node.js crypto fails (e.g., corrupted Node installation), `start.sh` prints `ERROR: Failed to generate JWT_SECRET. Please set it manually in .env` and exits with code 1. The server is not started.
- **Storage dir missing:** `fileNaming.ts` already calls `mkdirSync({ recursive: true })` before writing — no change needed.
- **Migration of existing files:** `start.sh` runs `cp -rn` (no-clobber copy) from `app/app/` to `storage/` on every start. If `app/app/` doesn't exist (fresh install or already migrated), the `if [ -d "app/app" ]` guard prevents any error.

---

## Testing Checklist

**JWT / Auth:**
- [ ] App starts without Edge Runtime warning (`⚠ A Node.js API is used...` should be gone)
- [ ] Unauthenticated requests to `/` redirect to `/login`
- [ ] Unauthenticated API requests return `401 Unauthorized` (not redirect)
- [ ] Authenticated users (valid cookie) can access the main app
- [ ] Expired/invalid JWT cookie redirects to `/login`
- [ ] `JWT_SECRET` is present in `.env` after first `start.sh` run (value ≥ 32 chars)
- [ ] Re-running `start.sh` does NOT regenerate `JWT_SECRET` if already valid

**Storage paths:**
- [ ] Image generation writes to `storage/output/images/` (check filesystem after running a generation)
- [ ] Output browser API (`/api/output-browser`) lists generated images from `storage/output/images/`
- [ ] Input image upload writes to `storage/input/`
- [ ] Input images route (`/api/input-images`) lists uploaded files from `storage/input/`
- [ ] `app/app/` directory no longer exists (or is empty after migration)
- [ ] Root-level `input/` and `output/` directories removed

**Build:**
- [ ] TypeScript: 0 errors in `src/` (run `npx tsc --noEmit`)
- [ ] `npm run build` completes without errors
- [ ] No new ESLint warnings introduced

**Cleanup:**
- [ ] `R4_CHECKLIST.md` removed from project root
- [ ] `R4_REFACTOR_SUMMARY.md` removed from project root
- [ ] `prd-image-workflow.md` accessible at `docs/prd-image-workflow.md`
