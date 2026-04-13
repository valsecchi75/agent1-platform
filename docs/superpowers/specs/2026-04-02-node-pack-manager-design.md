# Node Pack Manager — Design Specification

**Date:** 2026-04-02
**Author:** SV75 + Claude
**Status:** Reviewed
**Approach:** Registry-Driven Activation

## Problem Statement

AGENT 1 has a growing collection of custom node types (Neural Atelier, Morpheus, etc.) but no way for users to discover, install, or update node packs after the initial app installation. New nodes require manual intervention. ComfyUI solves this with its Custom Node Manager — AGENT 1 needs an equivalent system tailored to its architecture.

## Goals

1. Users can discover available node packs from a central registry
2. Users can install/uninstall/update node packs from within the app
3. Users are notified of new packs at app startup via a badge indicator
4. Publishers can release new packs with a simple copy + push workflow
5. Architecture supports future unification with the workflow template registry

## Non-Goals

- Dynamic code loading at runtime (no dynamic imports, no runtime bundling)
- Third-party pack publishing (publisher is the AGENT 1 team only, for now)
- Unifying node packs and workflow templates in a single manager (future phase)
- Disabling core nodes from `agent1-foundation`

## Architecture Overview

Three layers:

```
┌─────────────────────────────────────────────────┐
│  REGISTRY LAYER (remote)                        │
│  agent1-registry repo on GitHub                 │
│  ├── node-packs.json  (auto-generated index)    │
│  ├── registry.json    (existing, templates)     │
│  └── custom_nodes/                              │
│      └── agent1_{name}/                         │
│          ├── manifest.json                      │
│          ├── specs/                             │
│          └── preview/                           │
├─────────────────────────────────────────────────┤
│  DISCOVERY LAYER (app backend)                  │
│  GET  /api/node-packs/registry                  │
│  POST /api/node-packs/install                   │
│  POST /api/node-packs/uninstall                 │
├─────────────────────────────────────────────────┤
│  ACTIVATION LAYER (app frontend + filesystem)   │
│  nodeRegistry.ts  → dynamic nodeTypes map       │
│  NodePackManager   → dialog UI                  │
│  NodePackChecker   → startup badge              │
└─────────────────────────────────────────────────┘
```

**Data flow:**
Publisher updates registry repo → App checks registry at boot → Badge signals new packs → User opens manager → Clicks Install → Downloads manifest+specs to local `custom_nodes/` → Clicks Restart → `nodeRegistry.ts` reads `custom_nodes/` → Node appears in canvas.

## Registry Schema

### Repository Structure

```
agent1-registry/
├── registry.json              # (existing) workflow template index
├── node-packs.json            # (NEW) node pack index, auto-generated
├── templates/                 # (existing) workflow templates
├── custom_nodes/              # (NEW) node pack metadata
│   └── agent1_{name}/
│       ├── manifest.json
│       ├── specs/
│       │   └── {nodeType}.json
│       └── preview/
│           └── cover.jpg
└── PUSH_TO_GITHUB.bat         # (existing) updated to auto-generate node-packs.json
```

### `node-packs.json` Schema

```json
{
  "registryVersion": "1.0.0",
  "updatedAt": "2026-04-02T10:00:00.000Z",
  "baseUrl": "https://raw.githubusercontent.com/valsecchi75/agent1-registry/main/",
  "packs": [
    {
      "id": "agent1_neural_atelier",
      "name": "Neural Atelier",
      "description": "Sketch-to-photo, styling detail, recolor nodes for AI image generation",
      "author": "SV75",
      "version": "1.0.0",
      "category": "generation",
      "tags": ["image", "style-transfer", "recolor"],
      "nodeCount": 3,
      "minAppVersion": "0.9.7-alpha",
      "manifestPath": "custom_nodes/agent1_neural_atelier/manifest.json",
      "previewPath": "custom_nodes/agent1_neural_atelier/preview/cover.jpg",
      "createdAt": "2026-03-15T00:00:00.000Z",
      "updatedAt": "2026-04-01T00:00:00.000Z",
      "changelog": "Prima release pubblica"
    }
  ]
}
```

### `manifest.json` Schema (per pack)

Identical to the existing manifest format in `custom_nodes/agent1-foundation/manifest.json`:

```json
{
  "id": "agent1_neural_atelier",
  "name": "Neural Atelier",
  "displayName": "Neural Atelier Nodes",
  "version": "1.0.0",
  "author": "SV75",
  "description": "...",
  "category": "generation",
  "minAppVersion": "0.9.7-alpha",
  "license": "MIT",
  "repository": "https://github.com/valsecchi75/agent1-registry",
  "isCore": false,
  "removable": true,
  "nodes": [
    {
      "type": "naSketchToPhoto",
      "name": "Sketch to Photo",
      "category": "generation",
      "specFile": "specs/naSketchToPhoto.json"
    }
  ],
  "hasSpecs": true,
  "dependencies": []
}
```

## Backend API

### `GET /api/node-packs/registry`

Fetches `node-packs.json` from the remote registry with 10s timeout. Falls back to local copy resolved via `path.resolve(process.cwd(), '..', 'agent1-registry', 'node-packs.json')`. For each pack, compares with local `custom_nodes/` to determine status:

- `available` — pack not in local `custom_nodes/`
- `installed` — pack exists locally, version matches registry
- `update-available` — pack exists locally, registry version is higher

Returns:

```json
{
  "packs": [
    {
      "...registry fields...",
      "status": "available" | "installed" | "update-available",
      "installedVersion": "0.9.0" | null
    }
  ],
  "lastChecked": "2026-04-02T10:00:00.000Z"
}
```

### `POST /api/node-packs/install`

Request body:

```json
{
  "packId": "agent1_neural_atelier"
}
```

Flow:
1. Fetch `node-packs.json` from registry to get pack entry
2. Validate `minAppVersion` against current app version from `package.json` using `semver.gte()` from the `semver` npm package. Pre-release versions follow semver precedence: `0.9.7-alpha < 0.9.7-beta < 0.9.7`
3. Download `manifest.json` from `{baseUrl}/{manifestPath}`
4. Validate manifest structure using Zod schema:
   - Required: `id` (non-empty string), `name`, `version` (valid semver), `nodes[]` (non-empty array)
   - Each `nodes[]` entry: `type` (alphanumeric + underscore, no spaces), `name`, `specFile`
   - Reject if any `nodes[].type` collides with core node types from `agent1-foundation`
5. Validate component availability: check that all declared `nodes[].type` exist in the app's `COMPONENT_REGISTRY`. If missing, return 400 with list of unsupported node types and message "Update AGENT 1 to the latest version first"
6. Download all to a temp directory (`custom_nodes/.tmp-{packId}/`) first — atomic transaction
7. Download all spec files declared in manifest nodes. Verify every `specFile` referenced exists
8. Download preview files (JPG, max 500KB each). If preview fails, log warning and continue (non-blocking)
9. On success: rename temp dir to `custom_nodes/{packId}/`. On any failure: delete temp dir, return error
10. Return `{ success: true, restartRequired: true }`

Error cases:
- 400: Invalid manifest (with specific field errors), unsupported node types (with list), or missing spec files
- 409: `minAppVersion` not met (include required version and current version in response)
- 502: Registry or file download failed (with retry suggestion)

### `POST /api/node-packs/uninstall`

Request body:

```json
{
  "packId": "agent1_neural_atelier"
}
```

Flow:
1. Reject if `packId` is in hardcoded protected list: `['agent1-foundation']`. This check is by ID, not by manifest flag, to prevent accidental uninstall if manifest is corrupted
2. Read manifest from `custom_nodes/{packId}/manifest.json`
3. Additionally reject if `isCore: true` or `removable: false`
4. Remove directory `custom_nodes/{packId}/`
5. Return `{ success: true, restartRequired: true }`

### `POST /api/restart`

Flow:
1. Returns `{ success: true, message: "Restarting..." }` immediately (non-blocking)
2. Schedules `process.exit(0)` after 500ms via `setTimeout` to allow response delivery
3. The external process manager (`start.bat`/`start.sh`) wraps the server in a restart loop and relaunches automatically
4. Frontend behavior after calling restart:
   - Shows "Restarting..." overlay
   - Polls `GET /api/health` every 2 seconds (max 30s timeout)
   - When health endpoint responds, reloads the page (`window.location.reload()`)
   - If 30s timeout exceeded, shows "Server did not restart. Please close and reopen the app manually"
5. Requires a new `GET /api/health` endpoint that returns `{ status: "ok", version: "0.9.7-alpha" }`

## Dynamic Node Registration

### Current State (hardcoded)

```typescript
// WorkflowCanvas.tsx — static object
const nodeTypes: NodeTypes = {
  imageInput: ImageInputNode,
  nanoBanana: GenerateImageNode,
  // ... 56 more hardcoded entries
};
```

### New State (data-driven)

New file: `src/lib/nodeRegistry.ts`

```typescript
// Static lookup: all components that COULD be registered
// This is compiled into the bundle — dormant until activated
const COMPONENT_REGISTRY: Record<string, React.ComponentType> = {
  imageInput: ImageInputNode,
  nanoBanana: GenerateImageNode,
  naSketchToPhoto: NaSketchToPhotoNode,
  // ... all known components
};

// Called via API endpoint GET /api/node-registry/active-types
// Returns the list of active node types based on installed packs
function getActiveNodeTypes(): string[] {
  // 1. Always include core nodes (agent1-foundation)
  const coreManifest = readManifest('custom_nodes/agent1-foundation/manifest.json');
  const activeTypes = coreManifest.nodes.map(n => n.type);
  const seenTypes = new Set(activeTypes);

  // 2. Scan custom_nodes/ for installed non-core packs
  const packDirs = scanCustomNodes();
  for (const dir of packDirs) {
    const manifest = readManifest(dir + '/manifest.json');
    if (manifest && manifest.id !== 'agent1-foundation') {
      for (const node of manifest.nodes) {
        // Duplicate detection: first pack wins, log conflict
        if (seenTypes.has(node.type)) {
          console.warn(`[nodeRegistry] Duplicate node type "${node.type}" in pack "${manifest.id}" — skipped`);
          continue;
        }
        if (COMPONENT_REGISTRY[node.type]) {
          activeTypes.push(node.type);
          seenTypes.add(node.type);
        } else {
          console.warn(`[nodeRegistry] Node type "${node.type}" from pack "${manifest.id}" not in bundle — skipped`);
        }
      }
    }
  }
  return activeTypes;
}

// Build the nodeTypes object for ReactFlow
function buildNodeTypes(activeTypes: string[]): NodeTypes {
  const result: NodeTypes = {};
  for (const type of activeTypes) {
    if (COMPONENT_REGISTRY[type]) {
      result[type] = COMPONENT_REGISTRY[type];
    }
  }
  return result;
}
```

### Hydration Flow

1. New API endpoint: `GET /api/node-registry/active-types` — calls `getActiveNodeTypes()` server-side, returns `{ nodeTypes: string[] }`
2. App layout fetches this once on mount, stores result in Zustand `uiSlice` as `activeNodeTypes: string[]`
3. `WorkflowCanvas.tsx` reads from Zustand and builds nodeTypes:

```typescript
const activeNodeTypes = useWorkflowStore(s => s.activeNodeTypes);
const nodeTypes: NodeTypes = useMemo(() => buildNodeTypes(activeNodeTypes), [activeNodeTypes]);
```

4. Current app version is read from `package.json` via a server-side utility: `JSON.parse(fs.readFileSync('package.json')).version` with fallback to `"0.0.0"`

### `useAvailableNodes()` Hook

Exposes the list of active node types to UI components that need it:
- Toolbar (node creation buttons)
- `ConnectionDropMenu.tsx` (node suggestions on edge drop)
- `ControlPanel.tsx` (parameter editors)
- Search/filter UI

Nodes not in the active list are hidden from all UI surfaces.

## Frontend UI

### Node Pack Manager Dialog

Accessible from a button in the main toolbar (puzzle piece icon). The button shows a red dot badge when new packs are available.

**Dialog structure:**

```
┌──────────────────────────────────────────┐
│  Node Pack Manager                    ✕  │
├──────────────────────────────────────────┤
│  [Available]  [Installed]                │
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🖼 cover   Neural Atelier    NEW  │  │
│  │            3 nodes · v1.0.0       │  │
│  │            by SV75                │  │
│  │            Sketch-to-photo, ...   │  │
│  │                        [Install]  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🖼 cover   Morpheus Models        │  │
│  │            1 node · v1.0.0        │  │
│  │            Requires app v0.9.8+   │  │
│  │                       [disabled]  │  │
│  └────────────────────────────────────┘  │
│                                          │
├──────────────────────────────────────────┤
│  ⚠ Restart required to activate nodes   │
│                          [Restart Now]   │
└──────────────────────────────────────────┘
```

**Tab "Available":** Packs from registry not installed locally. Each card shows: preview image, name, node count, version, author, description, tags. NEW badge for packs not previously seen. Install button (disabled if `minAppVersion` not met).

**Tab "Installed":** Packs in local `custom_nodes/`. Core packs show "Core" badge, no uninstall. Non-core packs show Uninstall button. If registry has a newer version, show "Update available" badge with Update button.

**Restart banner:** Fixed at dialog bottom after any install/uninstall/update. "Restart required to activate changes" with "Restart Now" button and "or restart manually" text.

### Startup Check — `NodePackChecker`

Component mounted once in the app layout. On mount:

1. Fetch `GET /api/node-packs/registry`
2. Read `localStorage` key `agent1-node-packs-lastSeen` (ISO timestamp)
3. Filter packs where `updatedAt > lastSeen` (these are "new" to this user)
4. If any found: call Zustand action `setNodePackBadge(true)` in `uiSlice`
5. Update `lastSeen` to current fetch timestamp (so next boot compares fresh)
6. When user opens manager dialog: call `setNodePackBadge(false)` to clear badge

Zustand `uiSlice` additions:
```typescript
nodePackBadgeActive: boolean;
activeNodeTypes: string[];
setNodePackBadge: (active: boolean) => void;
setActiveNodeTypes: (types: string[]) => void;
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `NodePackManager.tsx` | `src/components/node-packs/` | Main dialog with tabs |
| `NodePackCard.tsx` | `src/components/node-packs/` | Single pack card |
| `NodePackChecker.tsx` | `src/components/node-packs/` | Startup check + badge |
| `RestartBanner.tsx` | `src/components/node-packs/` | Restart prompt |

## Publishing Flow

### For the Developer (SV75)

1. **Develop** the node in `app/custom_nodes/agent1_{name}/` — component, executor, manifest, specs
2. **Delta release** the app via `publish.bat` (includes the node code in bundle)
3. **Copy** the `agent1_{name}/` folder to `agent1-registry/custom_nodes/`
4. **Run** `PUSH_TO_GITHUB.bat` — auto-generates `node-packs.json`, commits, pushes

### `PUSH_TO_GITHUB.bat` Enhancement

The existing script is extended to:

1. Scan `custom_nodes/*/manifest.json`
2. For each valid manifest, extract: id, name, description, author, version, category, tags, nodeCount, minAppVersion, paths
3. Generate `node-packs.json` with all entries + current timestamp
4. Stage all files, commit, push (existing behavior)

### For the User

1. Open app → badge appears if new packs available
2. Open Node Pack Manager → see available packs
3. Click Install → manifest+specs downloaded
4. Click Restart Now → app restarts → node active

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Registry fetch fails (offline) | No badge. Manager shows "Cannot reach registry" + Retry button. Installed packs still work. |
| `minAppVersion` not met | Install button disabled. Tooltip: "Requires app v{version}+" |
| Pack installed but code missing (app downgrade) | Node skipped silently in `nodeRegistry.ts`. Manager shows "Requires app update" next to pack. |
| Manifest validation fails | API returns 400 with specific error. UI shows error message on card. |
| Restart endpoint fails | Banner shows "Or close and reopen the app manually" |
| Corrupt local manifest | Pack ignored during scan. Logged to console. Does not block other packs. |
| Partial download (network cut mid-install) | Temp dir `.tmp-{packId}` cleaned up on next install attempt or app startup. No corrupt state. |
| Duplicate node type across packs | First pack wins, conflict logged. Second pack's duplicate nodes skipped. |
| Workflow uses nodes from uninstalled pack | Workflow loads but missing nodes show error placeholder. User must reinstall pack. |
| App update does not remove installed packs | Packs survive delta releases. Manifests re-scanned at boot to detect incompatibilities. |

## Testing Strategy

**Unit tests:**
- `nodeRegistry.ts`: verify dynamic nodeTypes construction from manifests
- Version comparison logic (semver parsing, `minAppVersion` checks)
- Manifest validation (required fields, structure)
- `node-packs.json` generation logic

**Integration tests:**
- `/api/node-packs/registry` endpoint: mock registry responses, verify status enrichment
- `/api/node-packs/install` endpoint: verify file download and write
- `/api/node-packs/uninstall` endpoint: verify directory removal, core pack protection

**E2E scenarios:**
- Full install flow: registry check → install → restart → node visible
- Update flow: install v1 → registry has v2 → update → restart → v2 active
- Offline graceful degradation
- `minAppVersion` blocking

**Negative tests:**
- Network timeout during manifest download (verify temp dir cleanup)
- Disk write failure (verify error message and no partial state)
- Concurrent install of two packs (verify no race conditions)
- Uninstall while install is in progress (verify locking or rejection)
- Corrupt JSON in registry response (verify graceful fallback)

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `agent1-node-packs-lastSeen` | ISO timestamp of last registry check (for NEW badge) |

## Future Considerations

- **Template unification:** The manager dialog can add a "Templates" tab using the existing template registry, creating a unified discovery experience
- **Third-party packs:** The registry schema supports multiple authors; future versions could accept external contributions via PR to the registry repo
- **Auto-update:** Optional setting to auto-install updates on restart (opt-in)
- **Pack dependencies:** The manifest already has a `dependencies` field for inter-pack dependencies. For MVP, packs with non-empty `dependencies` are accepted but dependencies are not auto-installed — the UI shows a warning "This pack depends on: X, Y" and the user must install them manually
