# Node Pack Manager Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node Pack Manager that lets users discover, install, update, and uninstall custom node packs from a remote registry, with startup badge notifications and dynamic node registration.

**Architecture:** Three-layer system — remote registry (`node-packs.json` in `agent1-registry` repo), backend API (3 endpoints + health + active-types), frontend UI (manager dialog + startup checker). Node components are pre-compiled in the bundle; "installing" a pack downloads manifest+specs to `custom_nodes/`, and the node becomes active after restart.

**Tech Stack:** Next.js 16 API routes, Zustand (uiSlice), Zod validation, semver comparison, React (dialog + cards), existing template registry pattern as reference.

**Spec:** `docs/superpowers/specs/2026-04-02-node-pack-manager-design.md`

---

### Task 1: Install Zod dependency

`semver` is already installed (package.json line 53). Only `zod` is needed.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zod**

```bash
npm install zod
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('zod'); console.log('zod OK')"
```
Expected: `zod OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod dependency for manifest validation"
```

---

### Task 2: TypeScript types for Node Pack system

**Files:**
- Create: `src/types/nodePacks.ts`
- Modify: `src/types/index.ts` (add re-export)

- [ ] **Step 1: Create type definitions**

Create `src/types/nodePacks.ts`:

```typescript
/** Schema for node-packs.json — the remote registry index */
export interface NodePackRegistry {
  registryVersion: string;
  updatedAt: string;
  baseUrl: string;
  packs: NodePackEntry[];
}

/** Single entry in the registry index */
export interface NodePackEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  nodeCount: number;
  minAppVersion: string;
  manifestPath: string;
  previewPath: string;
  createdAt: string;
  updatedAt: string;
  changelog: string;
}

/** Registry entry enriched with local install status */
export interface NodePackEntryWithStatus extends NodePackEntry {
  status: 'available' | 'installed' | 'update-available';
  installedVersion: string | null;
}

/** Manifest stored inside each pack folder (custom_nodes/{packId}/manifest.json) */
export interface NodePackManifest {
  id: string;
  name: string;
  displayName?: string;
  version: string;
  author: string;
  description: string;
  category: string;
  minAppVersion?: string;
  license?: string;
  repository?: string;
  isCore: boolean;
  removable: boolean;
  nodes: NodePackManifestNode[];
  hasSpecs?: boolean;
  dependencies: string[];
}

/** Single node declared inside a pack manifest */
export interface NodePackManifestNode {
  type: string;
  name: string;
  category: string;
  specFile?: string;
}
```

- [ ] **Step 2: Add re-export to types/index.ts**

Add at the end of `src/types/index.ts`:

```typescript
export * from './nodePacks';
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: no errors related to nodePacks

- [ ] **Step 4: Commit**

```bash
git add src/types/nodePacks.ts src/types/index.ts
git commit -m "feat: add TypeScript types for Node Pack Manager"
```

---

### Task 3: Zod validation schemas for manifests

**Files:**
- Create: `src/lib/nodePacks/validation.ts`
- Create: `src/lib/nodePacks/__tests__/validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/nodePacks/__tests__/validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateManifest } from '../validation';

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validateManifest({
      id: 'agent1_test_pack',
      name: 'Test Pack',
      version: '1.0.0',
      author: 'Test',
      description: 'A test pack',
      category: 'test',
      isCore: false,
      removable: true,
      nodes: [
        { type: 'testNode', name: 'Test Node', category: 'test', specFile: 'specs/testNode.json' }
      ],
      dependencies: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects manifest with missing id', () => {
    const result = validateManifest({
      name: 'Test Pack',
      version: '1.0.0',
      author: 'Test',
      description: 'A test pack',
      category: 'test',
      isCore: false,
      removable: true,
      nodes: [{ type: 'testNode', name: 'Test Node', category: 'test' }],
      dependencies: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects manifest with empty nodes array', () => {
    const result = validateManifest({
      id: 'agent1_test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      description: 'Test',
      category: 'test',
      isCore: false,
      removable: true,
      nodes: [],
      dependencies: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects node type with spaces', () => {
    const result = validateManifest({
      id: 'agent1_test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      description: 'Test',
      category: 'test',
      isCore: false,
      removable: true,
      nodes: [{ type: 'invalid node', name: 'Bad', category: 'test' }],
      dependencies: [],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/nodePacks/__tests__/validation.test.ts
```
Expected: FAIL — module `../validation` not found

- [ ] **Step 3: Write implementation**

Create `src/lib/nodePacks/validation.ts`:

```typescript
import { z } from 'zod';

/** Node type must be alphanumeric + underscores only (no spaces, no special chars) */
const nodeTypePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const manifestNodeSchema = z.object({
  type: z.string().min(1).regex(nodeTypePattern, 'Node type must be alphanumeric + underscores'),
  name: z.string().min(1),
  category: z.string().min(1),
  specFile: z.string().optional(),
});

const manifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().optional(),
  version: z.string().min(1),
  author: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  minAppVersion: z.string().optional(),
  license: z.string().optional(),
  repository: z.string().optional(),
  isCore: z.boolean(),
  removable: z.boolean(),
  nodes: z.array(manifestNodeSchema).min(1, 'Pack must declare at least one node'),
  hasSpecs: z.boolean().optional(),
  dependencies: z.array(z.string()).default([]),
});

export type ManifestValidationResult =
  | { success: true; data: z.infer<typeof manifestSchema> }
  | { success: false; errors: string[] };

export function validateManifest(data: unknown): ManifestValidationResult {
  const result = manifestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/nodePacks/__tests__/validation.test.ts
```
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/nodePacks/validation.ts src/lib/nodePacks/__tests__/validation.test.ts
git commit -m "feat: add Zod-based manifest validation for node packs"
```

---

### Task 4: App version utility

**Files:**
- Create: `src/lib/nodePacks/appVersion.ts`
- Create: `src/lib/nodePacks/__tests__/appVersion.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/nodePacks/__tests__/appVersion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isAppVersionCompatible } from '../appVersion';

describe('isAppVersionCompatible', () => {
  it('returns true when app version meets minimum', () => {
    expect(isAppVersionCompatible('0.9.7-alpha', '0.9.7-alpha')).toBe(true);
  });

  it('returns true when app version exceeds minimum', () => {
    expect(isAppVersionCompatible('0.9.8-alpha', '0.9.7-alpha')).toBe(true);
  });

  it('returns false when app version is below minimum', () => {
    expect(isAppVersionCompatible('0.9.6-alpha', '0.9.7-alpha')).toBe(false);
  });

  it('returns true when no minAppVersion specified', () => {
    expect(isAppVersionCompatible('0.9.7-alpha', undefined)).toBe(true);
  });

  it('handles stable vs prerelease correctly', () => {
    // 0.9.7 > 0.9.7-alpha in semver
    expect(isAppVersionCompatible('0.9.7', '0.9.7-alpha')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/nodePacks/__tests__/appVersion.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/lib/nodePacks/appVersion.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';

let cachedVersion: string | null = null;

/** Read the current app version from package.json (server-side only) */
export function getAppVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    cachedVersion = pkg.version || '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion!;
}

/**
 * Check if current app version satisfies the pack's minAppVersion requirement.
 * Uses semver.gte() with includePrerelease option.
 */
export function isAppVersionCompatible(
  appVersion: string,
  minAppVersion: string | undefined
): boolean {
  if (!minAppVersion) return true;
  const coercedApp = semver.coerce(appVersion, { includePrerelease: true });
  const coercedMin = semver.coerce(minAppVersion, { includePrerelease: true });
  if (!coercedApp || !coercedMin) return true; // be permissive if versions can't be parsed
  // For prerelease comparison, parse full strings
  const parsedApp = semver.parse(appVersion) || coercedApp;
  const parsedMin = semver.parse(minAppVersion) || coercedMin;
  return semver.gte(parsedApp, parsedMin, { includePrerelease: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/nodePacks/__tests__/appVersion.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/nodePacks/appVersion.ts src/lib/nodePacks/__tests__/appVersion.test.ts
git commit -m "feat: add app version utility with semver comparison"
```

---

### Task 5: Node Registry — dynamic nodeTypes builder

**Files:**
- Create: `src/lib/nodePacks/nodeRegistry.ts`
- Create: `src/lib/nodePacks/__tests__/nodeRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/nodePacks/__tests__/nodeRegistry.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveNodeTypes, buildNodeTypes } from '../nodeRegistry';

// Mock fs to control what manifests are found
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import * as fs from 'fs';

describe('getActiveNodeTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns core node types when only foundation pack exists', () => {
    // Mock scanning custom_nodes/
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'agent1-foundation', isDirectory: () => true },
    ]);
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify({
      id: 'agent1-foundation',
      isCore: true,
      nodes: [
        { type: 'imageInput', name: 'Image Input' },
        { type: 'prompt', name: 'Prompt' },
      ],
    }));

    const types = getActiveNodeTypes();
    expect(types).toContain('imageInput');
    expect(types).toContain('prompt');
  });

  it('skips duplicate node types across packs', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
      { name: 'agent1-foundation', isDirectory: () => true },
      { name: 'agent1_duplicate', isDirectory: () => true },
    ]);
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(JSON.stringify({
        id: 'agent1-foundation', isCore: true,
        nodes: [{ type: 'imageInput', name: 'Image Input' }],
      }))
      .mockReturnValueOnce(JSON.stringify({
        id: 'agent1_duplicate', isCore: false,
        nodes: [{ type: 'imageInput', name: 'Duplicate' }],
      }));

    const types = getActiveNodeTypes();
    // imageInput should appear only once
    expect(types.filter(t => t === 'imageInput')).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate node type')
    );
    consoleSpy.mockRestore();
  });
});

describe('buildNodeTypes', () => {
  it('returns only entries for types in COMPONENT_REGISTRY', () => {
    // buildNodeTypes filters by what's in the static registry
    const result = buildNodeTypes(['imageInput', 'nonExistentType']);
    expect(result).toHaveProperty('imageInput');
    expect(result).not.toHaveProperty('nonExistentType');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/nodePacks/__tests__/nodeRegistry.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/lib/nodePacks/nodeRegistry.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { NodeTypes } from '@xyflow/react';
import type { NodePackManifest } from '@/types/nodePacks';

// Import all node components — these are compiled into the bundle
import {
  ImageInputNode, AudioInputNode, VideoInputNode, AnnotationNode,
  PromptNode, ArrayNode, PromptConstructorNode, GenerateImageNode,
  GenerateVideoNode, Generate3DNode, GenerateAudioNode, LLMGenerateNode,
  SplitGridNode, OutputNode, OutputGalleryNode, ImageCompareNode,
  VideoStitchNode, EaseCurveNode, VideoTrimNode, VideoFrameGrabNode,
  RouterNode, SwitchNode, ConditionalSwitchNode,
  NASketchToPhotoNode, NAStylingDetailNode, NARecolorNode,
  MorpheusModelManagementNode, PreviewImageNode, ShowAnythingNode,
} from '@/components/nodes';

/**
 * Static lookup: all components that COULD be registered.
 * Compiled into the bundle — dormant until their pack is installed.
 */
export const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  imageInput: ImageInputNode,
  audioInput: AudioInputNode,
  videoInput: VideoInputNode,
  annotation: AnnotationNode,
  prompt: PromptNode,
  array: ArrayNode,
  promptConstructor: PromptConstructorNode,
  nanoBanana: GenerateImageNode,
  generateVideo: GenerateVideoNode,
  generate3d: Generate3DNode,
  generateAudio: GenerateAudioNode,
  llmGenerate: LLMGenerateNode,
  splitGrid: SplitGridNode,
  output: OutputNode,
  outputGallery: OutputGalleryNode,
  imageCompare: ImageCompareNode,
  videoStitch: VideoStitchNode,
  easeCurve: EaseCurveNode,
  videoTrim: VideoTrimNode,
  videoFrameGrab: VideoFrameGrabNode,
  router: RouterNode,
  switch: SwitchNode,
  conditionalSwitch: ConditionalSwitchNode,
  naSketchToPhoto: NASketchToPhotoNode,
  naStylingDetail: NAStylingDetailNode,
  naRecolor: NARecolorNode,
  morpheusModelManagement: MorpheusModelManagementNode,
  previewImage: PreviewImageNode,
  showAnything: ShowAnythingNode,
};

// NOTE: GLBViewerNode is lazy-loaded. It must be added separately in WorkflowCanvas.tsx
// via dynamic import, not included here.

const CUSTOM_NODES_DIR = path.resolve(process.cwd(), 'custom_nodes');

function readManifest(manifestPath: string): NodePackManifest | null {
  try {
    if (!fs.existsSync(manifestPath)) return null;
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw) as NodePackManifest;
  } catch {
    console.warn(`[nodeRegistry] Failed to read manifest: ${manifestPath}`);
    return null;
  }
}

/**
 * Scan custom_nodes/ and return the list of active node type strings.
 * Core nodes are always included. Non-core nodes only if their pack is installed
 * AND the component exists in COMPONENT_REGISTRY.
 */
export function getActiveNodeTypes(): string[] {
  const activeTypes: string[] = [];
  const seenTypes = new Set<string>();

  try {
    const entries = fs.readdirSync(CUSTOM_NODES_DIR, { withFileTypes: true });

    // Process agent1-foundation first (core), then others
    const sorted = [...entries].sort((a, b) => {
      if (a.name === 'agent1-foundation') return -1;
      if (b.name === 'agent1-foundation') return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (!entry.isDirectory()) continue;
      // Skip temp directories from interrupted installs
      if (entry.name.startsWith('.tmp-')) continue;

      const manifestPath = path.join(CUSTOM_NODES_DIR, entry.name, 'manifest.json');
      const manifest = readManifest(manifestPath);
      if (!manifest) continue;

      for (const node of manifest.nodes) {
        if (seenTypes.has(node.type)) {
          console.warn(
            `[nodeRegistry] Duplicate node type "${node.type}" in pack "${manifest.id}" — skipped`
          );
          continue;
        }
        if (COMPONENT_REGISTRY[node.type]) {
          activeTypes.push(node.type);
          seenTypes.add(node.type);
        } else {
          console.warn(
            `[nodeRegistry] Node type "${node.type}" from pack "${manifest.id}" not in bundle — skipped`
          );
        }
      }
    }
  } catch (err) {
    console.error('[nodeRegistry] Failed to scan custom_nodes/', err);
  }

  return activeTypes;
}

/**
 * Build the nodeTypes object for ReactFlow from a list of active type strings.
 * Only includes types that exist in COMPONENT_REGISTRY.
 */
export function buildNodeTypes(activeTypes: string[]): NodeTypes {
  const result: NodeTypes = {};
  for (const type of activeTypes) {
    const component = COMPONENT_REGISTRY[type];
    if (component) {
      result[type] = component;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/nodePacks/__tests__/nodeRegistry.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/nodePacks/nodeRegistry.ts src/lib/nodePacks/__tests__/nodeRegistry.test.ts
git commit -m "feat: add nodeRegistry with dynamic nodeTypes builder"
```

---

### Task 6: Barrel export for nodePacks lib

**Files:**
- Create: `src/lib/nodePacks/index.ts`

- [ ] **Step 1: Create barrel export**

Create `src/lib/nodePacks/index.ts`:

```typescript
export { validateManifest } from './validation';
export type { ManifestValidationResult } from './validation';
export { getAppVersion, isAppVersionCompatible } from './appVersion';
export { getActiveNodeTypes, buildNodeTypes, COMPONENT_REGISTRY } from './nodeRegistry';
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/nodePacks/index.ts
git commit -m "chore: add barrel export for nodePacks lib"
```

---

### Task 7: Zustand uiSlice — add node pack state

**Files:**
- Modify: `src/store/slices/uiSlice.ts`

- [ ] **Step 1: Add state properties to UISlice interface**

In `src/store/slices/uiSlice.ts`, add to the `UISlice` interface (after line 55, before the closing `}`):

```typescript
  // Node Pack Manager
  nodePackBadgeActive: boolean;
  activeNodeTypes: string[];
  setNodePackBadge: (active: boolean) => void;
  setActiveNodeTypes: (types: string[]) => void;
```

- [ ] **Step 2: Add initial state values and actions**

In the `createUISlice` function, add initial state (after `updateDismissed: false,` on line 77):

```typescript
  nodePackBadgeActive: false,
  activeNodeTypes: [],
```

And add the actions (after the `dismissUpdate` action, before the final `});`):

```typescript
  setNodePackBadge: (active: boolean) => set({ nodePackBadgeActive: active }),
  setActiveNodeTypes: (types: string[]) => set({ activeNodeTypes: types }),
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/store/slices/uiSlice.ts
git commit -m "feat: add nodePackBadge and activeNodeTypes to Zustand uiSlice"
```

---

### Task 8: API — `GET /api/node-registry/active-types`

**Files:**
- Create: `src/app/api/node-registry/active-types/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/node-registry/active-types/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getActiveNodeTypes } from '@/lib/nodePacks/nodeRegistry';

/**
 * GET /api/node-registry/active-types
 * Returns the list of active node types based on installed packs.
 * Called once on app mount to hydrate the Zustand store.
 */
export async function GET() {
  try {
    const nodeTypes = getActiveNodeTypes();
    return NextResponse.json({ nodeTypes });
  } catch (error) {
    console.error('[active-types] Error:', error);
    return NextResponse.json(
      { nodeTypes: [], error: 'Failed to scan installed packs' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/node-registry/active-types/route.ts
git commit -m "feat: add GET /api/node-registry/active-types endpoint"
```

---

### Task 9: API — `GET /api/health`

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getAppVersion } from '@/lib/nodePacks/appVersion';

/**
 * GET /api/health
 * Simple health check endpoint. Used by frontend to detect server restart completion.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: getAppVersion(),
    timestamp: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: add GET /api/health endpoint for restart detection"
```

---

### Task 10: API — `GET /api/node-packs/registry`

**Files:**
- Create: `src/app/api/node-packs/registry/route.ts`

Reference: `src/app/api/templates/registry/route.ts` (same fetch+fallback pattern)

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/node-packs/registry/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';
import type { NodePackRegistry, NodePackEntryWithStatus } from '@/types/nodePacks';

/** Load node-packs.json from local agent1-registry folder (fallback) */
function loadLocalRegistry(): NodePackRegistry | null {
  try {
    const localPath = path.resolve(process.cwd(), '..', 'agent1-registry', 'node-packs.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf-8');
      const registry = JSON.parse(raw) as NodePackRegistry;
      if (registry && Array.isArray(registry.packs)) return registry;
    }
  } catch { /* ignore */ }
  return null;
}

/** Read installed pack manifest version from custom_nodes/{packId}/manifest.json */
function getInstalledVersion(packId: string): string | null {
  try {
    const manifestPath = path.resolve(process.cwd(), 'custom_nodes', packId, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return manifest.version || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/node-packs/registry?url={registryUrl}
 * Fetch remote node pack registry, enriched with local install status.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const registryUrl = searchParams.get('url');

    let registry: NodePackRegistry | null = null;
    let source = 'local-fallback';

    // Try remote fetch first
    if (registryUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(registryUrl, {
          headers: { Accept: 'application/json', 'User-Agent': 'AGENT1/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = (await response.json()) as NodePackRegistry;
          if (data && Array.isArray(data.packs)) {
            registry = data;
            source = 'remote';
          }
        }
      } catch { /* remote failed, try local */ }
    }

    // Local fallback
    if (!registry) {
      registry = loadLocalRegistry();
      if (registry) {
        console.log('[node-packs] Remote unavailable — serving local node-packs.json');
      }
    }

    if (!registry) {
      return NextResponse.json(
        { success: false, error: 'Registry unavailable (remote and local fallback both failed)' },
        { status: 502 }
      );
    }

    // Enrich each pack with install status
    const packs: NodePackEntryWithStatus[] = registry.packs.map((pack) => {
      const installedVersion = getInstalledVersion(pack.id);
      let status: NodePackEntryWithStatus['status'] = 'available';

      if (installedVersion) {
        const installed = semver.parse(installedVersion);
        const remote = semver.parse(pack.version);
        if (installed && remote && semver.gt(remote, installed)) {
          status = 'update-available';
        } else {
          status = 'installed';
        }
      }

      return { ...pack, status, installedVersion };
    });

    return NextResponse.json({
      success: true,
      packs,
      source,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[node-packs/registry] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/node-packs/registry/route.ts
git commit -m "feat: add GET /api/node-packs/registry endpoint with status enrichment"
```

---

### Task 11: API — `POST /api/node-packs/install`

**Files:**
- Create: `src/app/api/node-packs/install/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/node-packs/install/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { NodePackRegistry } from '@/types/nodePacks';
import { validateManifest } from '@/lib/nodePacks/validation';
import { getAppVersion, isAppVersionCompatible } from '@/lib/nodePacks/appVersion';
import { COMPONENT_REGISTRY } from '@/lib/nodePacks/nodeRegistry';

const CUSTOM_NODES_DIR = path.resolve(process.cwd(), 'custom_nodes');

/** Core pack IDs that can never be modified via install/uninstall */
const CORE_PACK_IDS = ['agent1-foundation'];

/** Load node-packs.json from local fallback */
function loadLocalRegistry(): NodePackRegistry | null {
  try {
    const localPath = path.resolve(process.cwd(), '..', 'agent1-registry', 'node-packs.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf-8');
      return JSON.parse(raw) as NodePackRegistry;
    }
  } catch { /* ignore */ }
  return null;
}

/** Recursively delete a directory */
function rmDirSync(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/** Download a file from URL and return its content as string */
async function downloadFile(url: string, maxSizeBytes = 512000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const text = await res.text();
    if (text.length > maxSizeBytes) throw new Error(`File exceeds max size (${maxSizeBytes} bytes)`);
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  const tmpDir: string[] = []; // track temp dirs for cleanup

  try {
    const body = await request.json();
    const { packId, registryUrl } = body as { packId: string; registryUrl?: string };

    if (!packId) {
      return NextResponse.json({ success: false, error: 'packId is required' }, { status: 400 });
    }

    if (CORE_PACK_IDS.includes(packId)) {
      return NextResponse.json({ success: false, error: 'Cannot reinstall core packs' }, { status: 400 });
    }

    // 1. Load registry to find pack entry
    let registry: NodePackRegistry | null = null;
    if (registryUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(registryUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) registry = (await res.json()) as NodePackRegistry;
      } catch { /* fallback below */ }
    }
    if (!registry) registry = loadLocalRegistry();
    if (!registry) {
      return NextResponse.json({ success: false, error: 'Cannot reach registry' }, { status: 502 });
    }

    const packEntry = registry.packs.find((p) => p.id === packId);
    if (!packEntry) {
      return NextResponse.json({ success: false, error: `Pack "${packId}" not found in registry` }, { status: 404 });
    }

    // 2. Check minAppVersion
    const appVersion = getAppVersion();
    if (!isAppVersionCompatible(appVersion, packEntry.minAppVersion)) {
      return NextResponse.json({
        success: false,
        error: `Requires app v${packEntry.minAppVersion}+ (current: v${appVersion})`,
      }, { status: 409 });
    }

    const baseUrl = registry.baseUrl.replace(/\/$/, '');

    // 3. Download manifest to temp dir
    const tempPath = path.join(CUSTOM_NODES_DIR, `.tmp-${packId}`);
    rmDirSync(tempPath); // clean any previous failed attempt
    fs.mkdirSync(tempPath, { recursive: true });
    tmpDir.push(tempPath);

    const manifestUrl = `${baseUrl}/${packEntry.manifestPath}`;
    const manifestRaw = await downloadFile(manifestUrl);
    const manifestData = JSON.parse(manifestRaw);

    // 4. Validate manifest
    const validation = validateManifest(manifestData);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid manifest',
        details: validation.errors,
      }, { status: 400 });
    }

    // 5. Check component availability
    const unsupportedTypes = validation.data.nodes
      .map((n) => n.type)
      .filter((t) => !COMPONENT_REGISTRY[t]);

    if (unsupportedTypes.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Update AGENT 1 to the latest version first',
        unsupportedTypes,
      }, { status: 400 });
    }

    // 6. Write manifest
    fs.writeFileSync(path.join(tempPath, 'manifest.json'), manifestRaw, 'utf-8');

    // 7. Download specs
    const specsDir = path.join(tempPath, 'specs');
    fs.mkdirSync(specsDir, { recursive: true });

    for (const node of validation.data.nodes) {
      if (node.specFile) {
        const packDir = packEntry.manifestPath.replace('/manifest.json', '');
        const specUrl = `${baseUrl}/${packDir}/${node.specFile}`;
        try {
          const specRaw = await downloadFile(specUrl);
          const specFileName = path.basename(node.specFile);
          fs.writeFileSync(path.join(specsDir, specFileName), specRaw, 'utf-8');
        } catch (err) {
          return NextResponse.json({
            success: false,
            error: `Failed to download spec file: ${node.specFile}`,
            details: err instanceof Error ? err.message : 'Unknown error',
          }, { status: 502 });
        }
      }
    }

    // 8. Download preview (non-blocking)
    if (packEntry.previewPath) {
      try {
        const previewDir = path.join(tempPath, 'preview');
        fs.mkdirSync(previewDir, { recursive: true });
        const previewUrl = `${baseUrl}/${packEntry.previewPath}`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(previewUrl, { signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.length <= 512000) { // 500KB max
            const filename = path.basename(packEntry.previewPath);
            fs.writeFileSync(path.join(previewDir, filename), buffer);
          }
        }
      } catch {
        console.warn(`[install] Preview download failed for ${packId} — continuing`);
      }
    }

    // 9. Atomic move: temp → final
    const finalPath = path.join(CUSTOM_NODES_DIR, packId);
    rmDirSync(finalPath); // remove old version if updating
    fs.renameSync(tempPath, finalPath);
    tmpDir.length = 0; // clear cleanup since rename succeeded

    return NextResponse.json({ success: true, restartRequired: true, version: validation.data.version });
  } catch (error) {
    console.error('[node-packs/install] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Install failed',
    }, { status: 500 });
  } finally {
    // Cleanup temp dirs on failure
    for (const dir of tmpDir) {
      rmDirSync(dir);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/node-packs/install/route.ts
git commit -m "feat: add POST /api/node-packs/install with atomic download + validation"
```

---

### Task 12: API — `POST /api/node-packs/uninstall`

**Files:**
- Create: `src/app/api/node-packs/uninstall/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/node-packs/uninstall/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const CUSTOM_NODES_DIR = path.resolve(process.cwd(), 'custom_nodes');
const CORE_PACK_IDS = ['agent1-foundation'];

export async function POST(request: Request) {
  try {
    const { packId } = (await request.json()) as { packId: string };

    if (!packId) {
      return NextResponse.json({ success: false, error: 'packId is required' }, { status: 400 });
    }

    // Hardcoded core protection by ID
    if (CORE_PACK_IDS.includes(packId)) {
      return NextResponse.json({ success: false, error: 'Cannot uninstall core packs' }, { status: 403 });
    }

    const packPath = path.join(CUSTOM_NODES_DIR, packId);

    if (!fs.existsSync(packPath)) {
      return NextResponse.json({ success: false, error: `Pack "${packId}" not found` }, { status: 404 });
    }

    // Additional manifest-based protection
    try {
      const manifestPath = path.join(packPath, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifest.isCore || manifest.removable === false) {
          return NextResponse.json({ success: false, error: 'This pack cannot be removed' }, { status: 403 });
        }
      }
    } catch { /* proceed with removal if manifest can't be read */ }

    // Remove pack directory
    fs.rmSync(packPath, { recursive: true, force: true });

    return NextResponse.json({ success: true, restartRequired: true });
  } catch (error) {
    console.error('[node-packs/uninstall] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Uninstall failed',
    }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/node-packs/uninstall/route.ts
git commit -m "feat: add POST /api/node-packs/uninstall with core protection"
```

---

### Task 13: API — `POST /api/restart`

**Files:**
- Create: `src/app/api/restart/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/restart/route.ts`:

```typescript
import { NextResponse } from 'next/server';

/**
 * POST /api/restart
 * Triggers a graceful server restart. The external process manager (start.bat/start.sh)
 * wraps the server in a loop and will relaunch after process.exit(0).
 */
export async function POST() {
  try {
    // Schedule exit after response is sent
    setTimeout(() => {
      console.log('[restart] Shutting down for restart...');
      process.exit(0);
    }, 500);

    return NextResponse.json({ success: true, message: 'Restarting...' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to initiate restart' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/restart/route.ts
git commit -m "feat: add POST /api/restart endpoint for graceful server restart"
```

---

### Task 14: Frontend — `NodePackChecker` component (startup badge)

**Files:**
- Create: `src/components/node-packs/NodePackChecker.tsx`
- Modify: `src/app/layout.tsx` (mount the checker)

- [ ] **Step 1: Create NodePackChecker**

Create `src/components/node-packs/NodePackChecker.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';

const LAST_SEEN_KEY = 'agent1-node-packs-lastSeen';

/**
 * Mounts once in the app layout. On mount:
 * 1. Fetches active node types → stores in Zustand
 * 2. Fetches registry → compares timestamps → sets badge
 */
export function NodePackChecker() {
  const setActiveNodeTypes = useWorkflowStore((s) => s.setActiveNodeTypes);
  const setNodePackBadge = useWorkflowStore((s) => s.setNodePackBadge);

  useEffect(() => {
    // 1. Fetch active node types
    fetch('/api/node-registry/active-types')
      .then((res) => res.json())
      .then((data) => {
        if (data.nodeTypes) {
          setActiveNodeTypes(data.nodeTypes);
        }
      })
      .catch(() => {
        // Silently fail — nodes will use fallback
      });

    // 2. Check registry for new packs
    // Build registry URL from stored config or use default
    const url = '/api/node-packs/registry';

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.packs) return;

        const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
        const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);

        const hasNew = data.packs.some((pack: { updatedAt: string }) => {
          return new Date(pack.updatedAt) > lastSeenDate;
        });

        if (hasNew) {
          setNodePackBadge(true);
        }

        // Update lastSeen to current fetch time
        localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      })
      .catch(() => {
        // Offline — no badge, no error
      });
  }, [setActiveNodeTypes, setNodePackBadge]);

  return null; // This component renders nothing
}
```

- [ ] **Step 2: Mount in layout.tsx**

In `src/app/layout.tsx`, add the import and component:

Add import after line 4:
```typescript
import { NodePackChecker } from '@/components/node-packs/NodePackChecker';
```

Add component after `<DashboardEntrance />` (line 36):
```typescript
        <NodePackChecker />
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/node-packs/NodePackChecker.tsx src/app/layout.tsx
git commit -m "feat: add NodePackChecker for startup badge and active types hydration"
```

---

### Task 15: Frontend — `NodePackCard` component

**Files:**
- Create: `src/components/node-packs/NodePackCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/node-packs/NodePackCard.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { NodePackEntryWithStatus } from '@/types/nodePacks';

interface NodePackCardProps {
  pack: NodePackEntryWithStatus;
  isNew?: boolean;
  appVersion: string;
  onInstall: (packId: string) => Promise<void>;
  onUninstall: (packId: string) => Promise<void>;
  onUpdate: (packId: string) => Promise<void>;
}

export function NodePackCard({
  pack,
  isNew,
  appVersion,
  onInstall,
  onUninstall,
  onUpdate,
}: NodePackCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const versionCompatible = !pack.minAppVersion || appVersion >= pack.minAppVersion;

  const handleAction = async (action: (id: string) => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action(pack.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700/50 hover:border-neutral-600/50 transition-colors">
      {/* Preview image */}
      <div className="w-16 h-16 flex-shrink-0 rounded-md bg-neutral-700/50 overflow-hidden flex items-center justify-center">
        {pack.previewPath ? (
          <img
            src={`/api/node-packs/preview?path=${encodeURIComponent(pack.previewPath)}`}
            alt={pack.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-neutral-500 text-xs">No preview</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-neutral-200 truncate">{pack.name}</span>
          {isNew && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500/20 text-orange-400 rounded">NEW</span>
          )}
          {pack.status === 'installed' && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded">Installed</span>
          )}
          {pack.status === 'update-available' && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded">Update</span>
          )}
        </div>
        <div className="text-xs text-neutral-400 mt-0.5">
          {pack.nodeCount} node{pack.nodeCount !== 1 ? 's' : ''} · v{pack.version} · by {pack.author}
        </div>
        <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{pack.description}</div>
        {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
        {!versionCompatible && (
          <div className="text-xs text-amber-400 mt-1">Requires app v{pack.minAppVersion}+</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-start">
        {pack.status === 'available' && (
          <button
            onClick={() => handleAction(onInstall)}
            disabled={loading || !versionCompatible}
            className="px-3 py-1.5 text-xs font-medium rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Installing...' : 'Install'}
          </button>
        )}
        {pack.status === 'update-available' && (
          <button
            onClick={() => handleAction(onUpdate)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Updating...' : 'Update'}
          </button>
        )}
        {pack.status === 'installed' && !pack.installedVersion?.startsWith('core') && (
          <button
            onClick={() => handleAction(onUninstall)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded bg-neutral-700/50 text-neutral-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Removing...' : 'Uninstall'}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/node-packs/NodePackCard.tsx
git commit -m "feat: add NodePackCard component for pack display"
```

---

### Task 16: Frontend — `NodePackManager` dialog

**Files:**
- Create: `src/components/node-packs/NodePackManager.tsx`
- Create: `src/components/node-packs/index.ts`

- [ ] **Step 1: Create the dialog**

Create `src/components/node-packs/NodePackManager.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NodePackCard } from './NodePackCard';
import type { NodePackEntryWithStatus } from '@/types/nodePacks';

interface NodePackManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'available' | 'installed';

export function NodePackManager({ open, onOpenChange }: NodePackManagerProps) {
  const [tab, setTab] = useState<Tab>('available');
  const [packs, setPacks] = useState<NodePackEntryWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [appVersion, setAppVersion] = useState('0.0.0');

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = '/api/node-packs/registry';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPacks(data.packs || []);
      } else {
        setError(data.error || 'Failed to fetch registry');
      }
    } catch {
      setError('Cannot reach registry. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch app version and packs when dialog opens
  useEffect(() => {
    if (!open) return;
    fetchPacks();
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setAppVersion(data.version || '0.0.0'))
      .catch(() => {});
  }, [open, fetchPacks]);

  const handleInstall = async (packId: string) => {
    const res = await fetch('/api/node-packs/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Install failed');
    setRestartRequired(true);
    await fetchPacks(); // refresh list
  };

  const handleUninstall = async (packId: string) => {
    const res = await fetch('/api/node-packs/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Uninstall failed');
    setRestartRequired(true);
    await fetchPacks();
  };

  const handleUpdate = async (packId: string) => {
    // Update = uninstall old + install new
    await handleInstall(packId);
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await fetch('/api/restart', { method: 'POST' });
      // Poll for health
      const maxWait = 30000;
      const interval = 2000;
      const start = Date.now();
      const poll = () => {
        if (Date.now() - start > maxWait) {
          setRestarting(false);
          setError('Server did not restart. Please close and reopen the app manually.');
          return;
        }
        fetch('/api/health')
          .then((res) => {
            if (res.ok) {
              window.location.reload();
            } else {
              setTimeout(poll, interval);
            }
          })
          .catch(() => {
            setTimeout(poll, interval);
          });
      };
      setTimeout(poll, interval);
    } catch {
      setRestarting(false);
      setError('Failed to restart. Please close and reopen the app manually.');
    }
  };

  const available = packs.filter((p) => p.status === 'available');
  const installed = packs.filter((p) => p.status === 'installed' || p.status === 'update-available');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="text-neutral-200">Node Pack Manager</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-neutral-700 mb-3">
          <button
            onClick={() => setTab('available')}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'available'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            Available ({available.length})
          </button>
          <button
            onClick={() => setTab('installed')}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'installed'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            Installed ({installed.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading && (
            <div className="text-sm text-neutral-400 text-center py-8">Loading...</div>
          )}
          {error && !loading && (
            <div className="text-sm text-red-400 text-center py-4">
              {error}
              <button onClick={fetchPacks} className="block mx-auto mt-2 text-xs text-orange-400 hover:underline">
                Retry
              </button>
            </div>
          )}
          {!loading && !error && tab === 'available' && available.length === 0 && (
            <div className="text-sm text-neutral-500 text-center py-8">No new packs available</div>
          )}
          {!loading && !error && tab === 'installed' && installed.length === 0 && (
            <div className="text-sm text-neutral-500 text-center py-8">No packs installed</div>
          )}

          {!loading && (tab === 'available' ? available : installed).map((pack) => (
            <NodePackCard
              key={pack.id}
              pack={pack}
              appVersion={appVersion}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              onUpdate={handleUpdate}
            />
          ))}
        </div>

        {/* Restart banner */}
        {restartRequired && (
          <div className="flex items-center justify-between px-3 py-2 mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-xs text-amber-400">Restart required to activate changes</span>
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="px-3 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {restarting ? 'Restarting...' : 'Restart Now'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create barrel export**

Create `src/components/node-packs/index.ts`:

```typescript
export { NodePackChecker } from './NodePackChecker';
export { NodePackManager } from './NodePackManager';
export { NodePackCard } from './NodePackCard';
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/node-packs/NodePackManager.tsx src/components/node-packs/index.ts
git commit -m "feat: add NodePackManager dialog with install/uninstall/update/restart"
```

---

### Task 17: Integrate manager into toolbar

**Files:**
- Modify: `src/components/CanvasToolbar.tsx` (add manager button + badge)

- [ ] **Step 1: Explore CanvasToolbar**

Read `src/components/CanvasToolbar.tsx` to find where to add the manager button. Look for the toolbar layout and existing button patterns.

- [ ] **Step 2: Add imports and state**

Add to imports in CanvasToolbar:
```typescript
import { NodePackManager } from '@/components/node-packs';
import { Puzzle } from 'lucide-react'; // or similar icon
```

Add state:
```typescript
const [nodePackManagerOpen, setNodePackManagerOpen] = useState(false);
const nodePackBadge = useWorkflowStore((s) => s.nodePackBadgeActive);
const setNodePackBadge = useWorkflowStore((s) => s.setNodePackBadge);
```

- [ ] **Step 3: Add manager button to toolbar**

Add the button near the existing toolbar buttons (exact position depends on layout found in Step 1):

```tsx
<button
  onClick={() => {
    setNodePackManagerOpen(true);
    setNodePackBadge(false); // Clear badge when opening
  }}
  className="relative p-2 rounded-md hover:bg-neutral-700/50 text-neutral-400 hover:text-neutral-200 transition-colors"
  title="Node Pack Manager"
>
  <Puzzle size={18} />
  {nodePackBadge && (
    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500" />
  )}
</button>

<NodePackManager open={nodePackManagerOpen} onOpenChange={setNodePackManagerOpen} />
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CanvasToolbar.tsx
git commit -m "feat: add Node Pack Manager button with badge to canvas toolbar"
```

---

### Task 18: Refactor WorkflowCanvas to use dynamic nodeTypes

**Files:**
- Modify: `src/components/WorkflowCanvas.tsx`

- [ ] **Step 1: Update imports**

Replace the individual node imports (lines 26-56) and the static `nodeTypes` (lines 93-127) with the dynamic version.

Remove lines 26-56 (the node component imports from `"./nodes"`).

Add new imports:
```typescript
import { buildNodeTypes } from '@/lib/nodePacks/nodeRegistry';
```

Keep the GLBViewerNode dynamic import (line 61) as-is.

- [ ] **Step 2: Replace static nodeTypes with dynamic**

Replace the static `nodeTypes` object (lines 91-127) with:

```typescript
// R9.2: nodeTypes built dynamically from installed packs
// GLBViewerNode must be added separately as it's lazy-loaded
const GLB_ENTRY = { glbViewer: GLBViewerNode };
```

- [ ] **Step 3: Inside the WorkflowCanvas component, use Zustand**

Inside the component function, add:

```typescript
const activeNodeTypes = useWorkflowStore((s) => s.activeNodeTypes);
const nodeTypes = useMemo(() => {
  const dynamic = buildNodeTypes(activeNodeTypes);
  return { ...dynamic, ...GLB_ENTRY };
}, [activeNodeTypes]);
```

Note: `useMemo` needs to be imported from React if not already.

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 5: Run existing tests to ensure nothing broke**

```bash
npx vitest run 2>&1 | tail -30
```

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkflowCanvas.tsx
git commit -m "refactor: replace hardcoded nodeTypes with dynamic registry-based loading"
```

---

### Task 19: PUSH_TO_GITHUB.bat — auto-generate node-packs.json

**Files:**
- Modify: `../agent1-registry/PUSH_TO_GITHUB.bat` (or create if doesn't exist)
- Create: `../agent1-registry/generate-node-packs-index.js` (Node.js helper script)

- [ ] **Step 1: Create the Node.js generator script**

Create `../agent1-registry/generate-node-packs-index.js`:

```javascript
/**
 * Scans custom_nodes/*/manifest.json and generates node-packs.json.
 * Called by PUSH_TO_GITHUB.bat before commit.
 */
const fs = require('fs');
const path = require('path');

const CUSTOM_NODES_DIR = path.join(__dirname, 'custom_nodes');
const OUTPUT_FILE = path.join(__dirname, 'node-packs.json');

function main() {
  const packs = [];

  if (!fs.existsSync(CUSTOM_NODES_DIR)) {
    console.log('No custom_nodes/ directory found. Writing empty registry.');
    writeOutput(packs);
    return;
  }

  const dirs = fs.readdirSync(CUSTOM_NODES_DIR, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const manifestPath = path.join(CUSTOM_NODES_DIR, dir.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      // Skip core packs — they ship with the app
      if (manifest.isCore) continue;

      // Check for preview image
      const previewDir = path.join(CUSTOM_NODES_DIR, dir.name, 'preview');
      let previewPath = '';
      if (fs.existsSync(previewDir)) {
        const images = fs.readdirSync(previewDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        if (images.length > 0) {
          previewPath = `custom_nodes/${dir.name}/preview/${images[0]}`;
        }
      }

      packs.push({
        id: manifest.id || dir.name,
        name: manifest.name || dir.name,
        description: manifest.description || '',
        author: manifest.author || 'Unknown',
        version: manifest.version || '0.0.0',
        category: manifest.category || 'misc',
        tags: manifest.tags || [],
        nodeCount: Array.isArray(manifest.nodes) ? manifest.nodes.length : 0,
        minAppVersion: manifest.minAppVersion || '0.9.0',
        manifestPath: `custom_nodes/${dir.name}/manifest.json`,
        previewPath: previewPath,
        createdAt: manifest.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        changelog: manifest.changelog || '',
      });
    } catch (err) {
      console.warn(`Skipping ${dir.name}: ${err.message}`);
    }
  }

  writeOutput(packs);
}

function writeOutput(packs) {
  const registry = {
    registryVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    baseUrl: 'https://raw.githubusercontent.com/valsecchi75/agent1-registry/main/',
    packs: packs,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`Generated node-packs.json with ${packs.length} pack(s).`);
}

main();
```

- [ ] **Step 2: Update PUSH_TO_GITHUB.bat**

Add the following line before the `git add` command in PUSH_TO_GITHUB.bat:

```batch
echo Generating node-packs.json...
node generate-node-packs-index.js
```

- [ ] **Step 3: Test the generator locally**

```bash
cd "../agent1-registry" && node generate-node-packs-index.js && cat node-packs.json
```

- [ ] **Step 4: Commit**

```bash
cd "../agent1-registry" && git add generate-node-packs-index.js node-packs.json PUSH_TO_GITHUB.bat
git commit -m "feat: auto-generate node-packs.json from custom_nodes manifests"
```

---

### Task 20: Integration test — full install/uninstall cycle

**Files:**
- Create: `src/app/api/node-packs/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `src/app/api/node-packs/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const CUSTOM_NODES = path.resolve(process.cwd(), 'custom_nodes');
const TEST_PACK_ID = 'agent1_test_integration';
const TEST_PACK_DIR = path.join(CUSTOM_NODES, TEST_PACK_ID);

describe('Node Pack install/uninstall integration', () => {
  afterEach(() => {
    // Cleanup test pack
    if (fs.existsSync(TEST_PACK_DIR)) {
      fs.rmSync(TEST_PACK_DIR, { recursive: true, force: true });
    }
    // Cleanup temp dirs
    const tmpDir = path.join(CUSTOM_NODES, `.tmp-${TEST_PACK_ID}`);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects uninstall of core pack', async () => {
    const { POST } = await import('../uninstall/route');
    const req = new Request('http://localhost/api/node-packs/uninstall', {
      method: 'POST',
      body: JSON.stringify({ packId: 'agent1-foundation' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('returns 404 for non-existent pack uninstall', async () => {
    const { POST } = await import('../uninstall/route');
    const req = new Request('http://localhost/api/node-packs/uninstall', {
      method: 'POST',
      body: JSON.stringify({ packId: 'nonexistent_pack_xyz' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/app/api/node-packs/__tests__/integration.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/node-packs/__tests__/integration.test.ts
git commit -m "test: add integration tests for node pack install/uninstall"
```

---

### Task 21: Cleanup temp dirs on startup

**Files:**
- Modify: `src/lib/nodePacks/nodeRegistry.ts`

- [ ] **Step 1: Add cleanup function**

Add at the beginning of `getActiveNodeTypes()` in `src/lib/nodePacks/nodeRegistry.ts`:

```typescript
// Clean up temp dirs from interrupted installs
try {
  const entries = fs.readdirSync(CUSTOM_NODES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('.tmp-')) {
      const tmpPath = path.join(CUSTOM_NODES_DIR, entry.name);
      fs.rmSync(tmpPath, { recursive: true, force: true });
      console.log(`[nodeRegistry] Cleaned up temp dir: ${entry.name}`);
    }
  }
} catch { /* ignore cleanup errors */ }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/nodePacks/nodeRegistry.ts
git commit -m "feat: clean up interrupted install temp dirs on startup"
```

---

### Task 22: Run full test suite and verify build

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

```bash
npx vitest run 2>&1 | tail -40
```
Expected: All tests pass (existing + new)

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -20
```
Expected: Build succeeds

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -20
```
Expected: No new lint errors

- [ ] **Step 4: Manual smoke test**

Start dev server and verify:
1. App loads normally with all existing nodes visible
2. `/api/health` returns `{ status: "ok", version: "..." }`
3. `/api/node-registry/active-types` returns list of node types
4. `/api/node-packs/registry` returns packs (or empty if no registry configured)
5. Node Pack Manager button visible in toolbar
6. Click opens dialog (may show "No packs available" if registry not set up yet)
