# JWT Edge Fix + Storage Consolidation + Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Edge Runtime error blocking middleware auth, unify all storage paths under `storage/`, and remove completed-refactor artifacts.

**Architecture:** Three independent changes applied in sequence: (1) create an edge-compatible JWT verification module and wire it into middleware, (2) rename the `app/` storage directory to `storage/` and update all three path references plus `start.sh`, (3) delete R4 docs and move `prd-image-workflow.md`. Each task produces a working, committable change.

**Tech Stack:** Next.js 16 (Edge Runtime / App Router), `jose` (JWT, edge-compatible), Node.js `crypto` (secret generation in bash), TypeScript

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/lib/auth/jwt-edge.ts` | **Create** | Edge-compatible `verifyTokenEdge` using only `jose` + `process.env` |
| `src/middleware.ts` | **Modify** | Import `verifyTokenEdge` from `jwt-edge`, replace `verifyToken` call |
| `start.sh` | **Modify** | Add JWT_SECRET auto-generation + storage dir creation + migration |
| `src/lib/storage/fileNaming.ts` | **Modify** | Path `"app"` → `"storage"`, update header comment |
| `src/app/api/output-browser/route.ts` | **Modify** | `resolve(cwd, "output")` → `resolve(cwd, "storage", "output")` |
| `src/app/api/input-images/route.ts` | **Modify** | `resolve(cwd, "input")` → `resolve(cwd, "storage", "input")` |
| `.gitignore` | **Modify** | Replace old `input/*` / `output/*` entries with `storage/` entries |
| `R4_CHECKLIST.md` | **Delete** | Completed refactor artifact |
| `R4_REFACTOR_SUMMARY.md` | **Delete** | Completed refactor artifact |
| `prd-image-workflow.md` | **Move** | → `docs/prd-image-workflow.md` |
| `docs/` | **Create dir** | Project documentation directory |

---

## Task 1: Create `jwt-edge.ts` — Edge-compatible JWT verification

**Files:**
- Create: `src/lib/auth/jwt-edge.ts`

This new file must use ONLY Web APIs and the `jose` library. It must NOT import from Node.js modules (`fs`, `path`, `crypto`, `util`, etc.). `process.env` is available in Edge Runtime.

- [ ] **Step 1: Create `src/lib/auth/jwt-edge.ts`**

```typescript
/**
 * Edge Runtime-compatible JWT verification.
 *
 * Uses only `jose` (Web Crypto) and process.env.
 * No Node.js APIs (fs, path, crypto, process.cwd) — safe for Next.js middleware.
 *
 * Used by: src/middleware.ts
 * Server-side signing still uses: src/lib/auth/jwt.ts
 */
import * as jose from 'jose';

/**
 * Verify a JWT token using JWT_SECRET from environment.
 * Returns the decoded payload, or null if invalid/missing secret.
 */
export async function verifyTokenEdge(
  token: string
): Promise<Record<string, unknown> | null> {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    console.warn('[jwt-edge] JWT_SECRET missing or too short — treating as unauthenticated');
    return null;
  }

  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, key);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd app
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors (or same errors as before — none introduced by the new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/jwt-edge.ts
git commit -m "feat: add edge-compatible JWT verification module (jwt-edge.ts)"
```

---

## Task 2: Wire `jwt-edge.ts` into `src/middleware.ts`

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Replace the import line**

In `src/middleware.ts`, change line 2:

```typescript
// Before:
import { verifyToken } from '@/lib/auth/jwt';

// After:
import { verifyTokenEdge } from '@/lib/auth/jwt-edge';
```

- [ ] **Step 2: Replace the function call**

In `src/middleware.ts`, change line 43:

```typescript
// Before:
const payload = await verifyToken(token);

// After:
const payload = await verifyTokenEdge(token);
```

- [ ] **Step 3: Verify the full updated middleware.ts content is correct**

The complete file should look like this:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth/jwt-edge';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/credits',
  '/api/auth',
  '/api/login-assets',
  '/_next',
  '/favicon.ico',
  '/brands/',
  '/login/',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets
  if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/)) {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = req.cookies.get('agent1_session')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.authenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
};
```

- [ ] **Step 4: Verify TypeScript — no errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 new errors.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts
git commit -m "fix: use verifyTokenEdge in middleware — resolves Edge Runtime warning"
```

---

## Task 3: Add JWT_SECRET auto-generation to `start.sh`

**Files:**
- Modify: `start.sh`

The secret generation must run AFTER `.env` is created (Task 3 runs after the existing `.env` creation block). Uses Node.js `crypto` — no `openssl` dependency.

- [ ] **Step 1: Add the JWT_SECRET block to `start.sh`**

Insert these lines after the `# ── Create .env if missing ──` block (after line 71, before the `# ── Create data directories` comment):

```bash
# ── Ensure JWT_SECRET is set in .env ───────────────────────────
if [ -f ".env" ]; then
    # Check if JWT_SECRET is already valid (exists and >= 32 chars)
    if ! grep -qE "^JWT_SECRET=.{32,}" .env; then
        echo "Generating JWT_SECRET..."
        JWT_SECRET_VAL=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null)
        if [ -z "$JWT_SECRET_VAL" ]; then
            echo "ERROR: Failed to generate JWT_SECRET. Please add 'JWT_SECRET=<64-char-hex>' to .env manually."
            exit 1
        fi
        # Replace existing JWT_SECRET line or append
        if grep -q "^JWT_SECRET=" .env; then
            sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET_VAL}/" .env && rm -f .env.bak
        else
            echo "JWT_SECRET=${JWT_SECRET_VAL}" >> .env
        fi
        echo "JWT_SECRET generated and saved to .env."
        echo ""
    fi
fi
```

Note: `sed -i.bak` + `rm .env.bak` is macOS-compatible (BSD sed requires a backup extension with `-i`).

- [ ] **Step 2: Test the JWT_SECRET block manually (dry run)**

```bash
# Temporarily remove JWT_SECRET from .env to test generation
grep -v "^JWT_SECRET=" .env > .env.test && mv .env.test .env
bash start.sh 2>&1 | head -20
# Should print "Generating JWT_SECRET..." then start normally
# Verify it was added:
grep "JWT_SECRET" .env
```

Expected: `JWT_SECRET=<64-char hex string>` present in `.env`.

- [ ] **Step 3: Test idempotency — running again should NOT regenerate**

```bash
bash start.sh 2>&1 | head -20
# Should NOT print "Generating JWT_SECRET..."
```

- [ ] **Step 4: Commit**

```bash
git add start.sh
git commit -m "feat: auto-generate JWT_SECRET in start.sh if missing or too short"
```

---

## Task 4: Rename storage directory and update path references

**Files:**
- Modify: `src/lib/storage/fileNaming.ts`
- Modify: `src/app/api/output-browser/route.ts`
- Modify: `src/app/api/input-images/route.ts`

All three changes swap an old root-level directory name for `storage/`. They are grouped in one task since they all affect storage and should be committed together with the directory rename.

- [ ] **Step 1: Update `fileNaming.ts` — path constant and header comment**

Change line 18:
```typescript
// Before:
const APP_DIR = resolve(process.cwd(), "app");

// After:
const STORAGE_DIR = resolve(process.cwd(), "storage");
```

Update `STORAGE_PATHS` to use `STORAGE_DIR`:
```typescript
export const STORAGE_PATHS = {
  input: join(STORAGE_DIR, "input"),
  images: join(STORAGE_DIR, "output", "images"),
  videos: join(STORAGE_DIR, "output", "videos"),
  audio: join(STORAGE_DIR, "output", "audio"),
  workflows: join(STORAGE_DIR, "workflows"),
};
```

Update the file header comment (lines 1–13):
```typescript
/**
 * AGENT 1 File Naming & Storage Paths
 *
 * All generated files follow the naming convention: agent1_XXXX.ext
 * where XXXX is a zero-padded progressive number.
 *
 * Storage structure:
 *   storage/input/          — uploaded source images
 *   storage/output/images/  — generated images (agent1_0001.jpg, agent1_0002.png, ...)
 *   storage/output/videos/  — generated videos (agent1_0001.mp4, ...)
 *   storage/output/audio/   — generated audio files
 *   storage/workflows/      — workflow JSON templates
 */
```

- [ ] **Step 2: Update `output-browser/route.ts` — base dir path**

Change line 40:
```typescript
// Before:
const outputBaseDir = path.resolve(process.cwd(), "output");

// After:
const outputBaseDir = path.resolve(process.cwd(), "storage", "output");
```

Also update the path strings returned in the `files.push(...)` call (line 63) to reflect `storage/output/...`:
```typescript
// Before:
path: `app/output/${fileType === "image" ? "images" : fileType === "video" ? "videos" : "audio"}/${entry}`,

// After:
path: `storage/output/${fileType === "image" ? "images" : fileType === "video" ? "videos" : "audio"}/${entry}`,
```

Also update the JSDoc comment at line 13:
```
// Before: * Lists all files in app/output/images/, app/output/videos/, app/output/audio/
// After:  * Lists all files in storage/output/images/, storage/output/videos/, storage/output/audio/
```

- [ ] **Step 3: Update `input-images/route.ts` — input dir path (both GET and POST)**

Change line 19 (GET handler):
```typescript
// Before:
const inputDir = path.resolve(process.cwd(), "input");

// After:
const inputDir = path.resolve(process.cwd(), "storage", "input");
```

Change line 81 (POST handler):
```typescript
// Before:
const inputDir = path.resolve(process.cwd(), "input");

// After:
const inputDir = path.resolve(process.cwd(), "storage", "input");
```

Also update the path string in the GET `map()` return (line 37):
```typescript
// Before:
path: `app/input/${file}`,

// After:
path: `storage/input/${file}`,
```

Also update the JSDoc comment at line 6:
```
// Before: * Lists all images in app/input/ with filenames and sizes.
// After:  * Lists all images in storage/input/ with filenames and sizes.
```

- [ ] **Step 4: Verify TypeScript — no errors**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 new errors.

- [ ] **Step 5: Commit code changes**

```bash
git add src/lib/storage/fileNaming.ts src/app/api/output-browser/route.ts src/app/api/input-images/route.ts
git commit -m "refactor: update storage paths from root-level dirs to storage/ directory"
```

---

## Task 5: Update `start.sh` for storage directories + migration

**Files:**
- Modify: `start.sh`

This extends the start.sh changes from Task 3 (add storage dir creation and one-time migration from `app/` to `storage/`).

- [ ] **Step 1: Replace the data directory creation block**

Change the `# ── Create data directories if missing ──` block (line 73–74):

```bash
# ── Create storage directories if missing ──────────────────────
mkdir -p data/generations
mkdir -p storage/input
mkdir -p storage/output/images
mkdir -p storage/output/videos
mkdir -p storage/output/audio
mkdir -p storage/workflows

# Create .gitkeep files to preserve empty dirs in git
touch storage/input/.gitkeep 2>/dev/null || true
touch storage/output/images/.gitkeep 2>/dev/null || true
touch storage/output/videos/.gitkeep 2>/dev/null || true
touch storage/output/audio/.gitkeep 2>/dev/null || true
touch storage/workflows/.gitkeep 2>/dev/null || true

# ── One-time migration: app/app/ → storage/ ────────────────────
if [ -d "app" ]; then
    if [ -d "app/output" ] || [ -d "app/input" ] || [ -d "app/workflows" ]; then
        echo "Migrating existing files from app/ to storage/ ..."
        [ -d "app/output" ] && cp -rn app/output/. storage/output/ 2>/dev/null || true
        [ -d "app/input" ] && cp -rn app/input/. storage/input/ 2>/dev/null || true
        [ -d "app/workflows" ] && cp -rn app/workflows/. storage/workflows/ 2>/dev/null || true
        echo "Migration complete. The app/ storage directory can be removed manually."
        echo ""
    fi
fi
```

Note: `cp -rn` is macOS/Linux compatible. The `2>/dev/null || true` prevents errors on empty dirs.

- [ ] **Step 2: Verify start.sh runs without errors**

```bash
bash -n start.sh
```

Expected: No syntax errors printed.

- [ ] **Step 3: Commit**

```bash
git add start.sh
git commit -m "feat: create storage/ directories and migrate from app/ in start.sh"
```

---

## Task 6: Update `.gitignore` for storage directories

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Replace the old `input/*` / `output/*` entries**

Remove these lines from `.gitignore`:
```
# User content
input/*
!input/.gitkeep
output/*
!output/.gitkeep
!output/images/.gitkeep
!output/videos/.gitkeep
!output/audio/.gitkeep
```

Replace with:
```
# User content (generated files — not committed, but directory structure is)
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

Note: The `!` (negation) entries must appear immediately after their corresponding wildcard in `.gitignore` so git processes them in the correct order. The leading `/` anchors each pattern to the repo root.

- [ ] **Step 2: Verify `.gitignore` is working**

```bash
# Create storage dirs first if they don't exist yet (start.sh handles this, but run manually here)
mkdir -p storage/input storage/output/images storage/output/videos storage/output/audio storage/workflows
touch storage/input/.gitkeep storage/output/images/.gitkeep storage/output/videos/.gitkeep storage/output/audio/.gitkeep storage/workflows/.gitkeep

# Check git status — .gitkeep files should show as untracked (to be added), dirs excluded
git status --short storage/
```

Expected: `.gitkeep` files appear as untracked. No other storage files tracked.

- [ ] **Step 3: Add storage directory structure to git**

```bash
git add storage/
git status
```

Expected: Only `.gitkeep` files staged, not the directories themselves (git tracks files, not dirs).

- [ ] **Step 4: Commit**

```bash
git add .gitignore storage/
git commit -m "chore: update .gitignore for storage/ dirs and commit directory structure"
```

---

## Task 7: Documentation cleanup

**Files:**
- Delete: `R4_CHECKLIST.md`
- Delete: `R4_REFACTOR_SUMMARY.md`
- Move: `prd-image-workflow.md` → `docs/prd-image-workflow.md`

The `docs/` directory already exists (created when the spec was written). No need to create it.

- [ ] **Step 1: Move `prd-image-workflow.md` to `docs/`**

```bash
mv prd-image-workflow.md docs/prd-image-workflow.md
```

- [ ] **Step 2: Delete R4 refactor artifacts**

```bash
rm R4_CHECKLIST.md R4_REFACTOR_SUMMARY.md
```

- [ ] **Step 3: Verify only expected files remain at project root**

```bash
ls -1
```

Expected at root: `CHANGELOG.md`, `CLAUDE.md`, `LICENSE`, `README.md`, `app/`, `data/`, `docs/`, `eslint.config.js`, `examples/`, `input/`, `logs/`, `next-env.d.ts`, `next.config.ts`, `node_modules/`, `output/`, `package-lock.json`, `package.json`, `postcss.config.mjs`, `public/`, `scripts/`, `server.js`, `src/`, `start.bat`, `start.sh`, `storage/`, `tsconfig.json`, `tsconfig.tsbuildinfo`, `vitest.config.ts`.

NOT expected: `R4_CHECKLIST.md`, `R4_REFACTOR_SUMMARY.md`, `prd-image-workflow.md`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove R4 refactor artifacts, move prd to docs/"
```

---

## Task 8: Full verification

- [ ] **Step 1: TypeScript check — 0 errors**

```bash
npx tsc --noEmit 2>&1
```

Expected: No output (0 errors). Anything in `.next/` is excluded automatically.

- [ ] **Step 2: Start the app and check for Edge Runtime warning**

```bash
bash start.sh 2>&1 | head -40
```

Expected: The following warning should be GONE:
```
⚠ ./src/lib/auth/jwt.ts:7:26
A Node.js API is used (process.cwd at line: 7) which is not supported in the Edge Runtime.
```

- [ ] **Step 3: Manual auth checks**

Open browser to `http://localhost:3000`:
- Without cookie → should redirect to `/http://localhost:3000/login`
- After login → should reach the main app

Make a direct API request without auth:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/db/reports
```
Expected: `401`

- [ ] **Step 4: Storage path verification**

Run a generation (or manually create a test file):
```bash
mkdir -p storage/output/images
echo "test" > storage/output/images/agent1_0001.txt
curl -s http://localhost:3000/api/output-browser | head -c 200
```
Expected: Response contains `agent1_0001.txt` in the files list.

```bash
curl -s http://localhost:3000/api/input-images | head -c 200
```
Expected: Response is `{"images":[]}` (or lists actual input files if any exist).

- [ ] **Step 5: Confirm storage directories exist and are tracked**

```bash
git status storage/
ls storage/
```

Expected: `storage/` has subdirectories with `.gitkeep` files. Status shows clean.

- [ ] **Step 6: Final commit if any straggling changes**

```bash
git status
# If anything is unstaged:
git add -A && git commit -m "chore: final cleanup after jwt-edge + storage consolidation"
```
