# Node Pack Manager — Design Specification

**Date:** 2026-04-02
**Author:** SV75 + Claude
**Status:** Draft
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

Fetches `node-packs.json` from the remote registry with 10s timeout. Falls back to local copy at `../agent1-registry/node-packs.json`. For each pack, compares with local `custom_nodes/` to determine status:

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
2. Validate `minAppVersion` against current app version from `package.json`
3. Download `manifest.json` from `{baseUrl}/{manifestPath}`
4. Validate manifest structure (required fields: `id`, `name`, `version`, `nodes[]`)
5. Download all spec files declared in manifest nodes
6. Download preview files (if any)
7. Write all files to `custom_nodes/{packId}/`
8. Return `{ success: true, restartRequired: true }`

Error cases:
- 400: Invalid manifest, missing required fields
- 409: `minAppVersion` not met (include required version in response)
- 502: Registry or file download failed

### `POST /api/node-packs/uninstall`

Request body:

```json
{
  "packId": "agent1_neural_atelier"
}
```

Flow:
1. Read manifest from `custom_nodes/{packId}/manifest.json`
2. Reject if `isCore: true` or `removable: false`
3. Remove directory `custom_nodes/{packId}/`
4. Return `{ success: true, restartRequired: true }`

### `POST /api/restart`

Triggers `process.exit(0)`. The external process manager (`start.bat`/`start.sh`) restarts the server. If no process manager is detected, returns a message suggesting manual restart.

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

// Called at app startup (server-side)
function getActiveNodeTypes(): string[] {
  // 1. Always include core nodes (agent1-foundation)
  const coreManifest = readManifest('custom_nodes/agent1-foundation/manifest.json');
  const activeTypes = coreManifest.nodes.map(n => n.type);

  // 2. Scan custom_nodes/ for installed non-core packs
  const packDirs = scanCustomNodes();
  for (const dir of packDirs) {
    const manifest = readManifest(dir + '/manifest.json');
    if (manifest && manifest.id !== 'agent1-foundation') {
      for (const node of manifest.nodes) {
        if (COMPONENT_REGISTRY[node.type]) {
          activeTypes.push(node.type);
        }
        // else: code not in bundle yet, skip silently
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

`WorkflowCanvas.tsx` changes from:
```typescript
const nodeTypes: NodeTypes = { /* hardcoded */ };
```
to:
```typescript
const nodeTypes: NodeTypes = useMemo(() => buildNodeTypes(activeNodeTypes), [activeNodeTypes]);
```

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
3. Filter packs where `updatedAt > lastSeen`
4. If any found: set badge state (stored in Zustand UI slice)
5. When user opens manager dialog: update `lastSeen` to current timestamp

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

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `agent1-node-packs-lastSeen` | ISO timestamp of last registry check (for NEW badge) |

## Future Considerations

- **Template unification:** The manager dialog can add a "Templates" tab using the existing template registry, creating a unified discovery experience
- **Third-party packs:** The registry schema supports multiple authors; future versions could accept external contributions via PR to the registry repo
- **Auto-update:** Optional setting to auto-install updates on restart (opt-in)
- **Pack dependencies:** The manifest already has a `dependencies` field for inter-pack dependencies
