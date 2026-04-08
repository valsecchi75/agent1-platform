# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start Next.js dev server at http://localhost:3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run Next.js linting
npm run test     # Run all tests with Vitest (watch mode)
npm run test:run # Run all tests once (CI mode)
```

## Environment Setup

Create `.env.local` in the root directory:
```
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key  # Optional, for OpenAI LLM provider
KIE_API_KEY=your_kie_api_key        # Optional, for Kie.ai models (Sora, Veo, Kling, etc.)
```

## Architecture Overview

AGENT 1 is a node-based visual workflow editor for AI image generation. Users drag nodes onto a React Flow canvas, connect them via typed handles, and execute pipelines that call AI APIs.

### Core Stack
- **Next.js 16** (App Router) with TypeScript
- **@xyflow/react** (React Flow) for the node editor canvas
- **Konva.js / react-konva** for canvas annotation drawing
- **Zustand** for state management (single store pattern)

### Key Files

| Purpose | Location |
|---------|----------|
| Central workflow state & execution logic | `src/store/workflowStore.ts` |
| All TypeScript type definitions | `src/types/index.ts` |
| Main canvas component & connection validation | `src/components/WorkflowCanvas.tsx` |
| Base node component (shared by all nodes) | `src/components/nodes/BaseNode.tsx` |
| Image generation API route | `src/app/api/generate/route.ts` |
| LLM text generation API route | `src/app/api/llm/route.ts` |
| Cost calculations | `src/utils/costCalculator.ts` |
| Grid splitting utility | `src/utils/gridSplitter.ts` |

### State Management

All application state lives in `workflowStore.ts` using Zustand. Key patterns:
- `useWorkflowStore()` hook provides access to nodes, edges, and all actions
- `executeWorkflow(startFromNodeId?)` runs the pipeline via topological sort
- `getConnectedInputs(nodeId)` retrieves upstream data for a node
- `updateNodeData(nodeId, partialData)` updates node state
- Auto-save runs every 90 seconds when enabled

### Execution Flow

1. User clicks Run or presses `Cmd/Ctrl+Enter`
2. `executeWorkflow()` performs topological sort on node graph
3. Nodes execute in dependency order, calling APIs as needed
4. `getConnectedInputs()` provides upstream images/text to each node
5. Locked groups are skipped; pause edges halt execution

## AI Models

Image generation models (these exist and are recently released):
- `gemini-2.5-flash-image` → internal name: `nano-banana`
- `gemini-3-pro-image-preview` → internal name: `nano-banana-pro`

LLM models:
- Google: `gemini-2.5-flash`, `gemini-3-flash-preview`, `gemini-3-pro-preview`
- OpenAI: `gpt-4.1-mini`, `gpt-4.1-nano`

## Node Types

| Type | Purpose | Inputs | Outputs |
|------|---------|--------|---------|
| `imageInput` | Load/upload images | reference | image |
| `annotation` | Draw on images (Konva) | image | image |
| `prompt` | Text prompt input | none | text |
| `nanoBanana` | AI image generation | image, text | image |
| `llmGenerate` | AI text generation | text, image | text |
| `splitGrid` | Split image into grid cells | image | reference |
| `generateAudio` | AI audio/TTS generation | text | audio |
| `audioInput` | Load/upload audio files | audio | audio |
| `glbViewer` | Load/display 3D GLB models | none | image |
| `output` | Display final result | image | none |

## Node Connection System

### Handle Types

| Handle Type | Data Format | Description |
|-------------|-------------|-------------|
| `image` | Base64 data URL | Visual content |
| `text` | String | Text content |
| `audio` | Base64 data URL | Audio content |

### Connection Rules

1. **Type Matching**: Handles only connect to matching types (`image`→`image`, `text`→`text`)
2. **Direction**: Connections flow from source (output) to target (input)
3. **Multiplicity**: Image inputs accept multiple connections; text inputs accept one

### Data Flow in `getConnectedInputs`

Returns `{ images: string[], text: string | null }`.

**Image data extracted from:**
- `imageInput` → `data.image`
- `annotation` → `data.outputImage`
- `nanoBanana` → `data.outputImage`

**Text data extracted from:**
- `prompt` → `data.prompt`
- `llmGenerate` → `data.outputText`

**Audio data extracted from:**
- `audioInput` → `data.audioFile`
- `generateAudio` → `data.outputAudio`

## Keyboard Shortcuts

- `Cmd/Ctrl + Enter` - Run workflow
- `Cmd/Ctrl + C/V` - Copy/paste nodes
- `Shift + P` - Add prompt node at center
- `Shift + I` - Add image input node
- `Shift + G` - Add generate (nanoBanana) node
- `Shift + V` - Add video (generateVideo) node
- `Shift + L` - Add LLM node
- `Shift + A` - Add annotation node
- `Shift + T` - Add audio (generateAudio) node
- `H` - Stack selected nodes horizontally
- `V` - Stack selected nodes vertically
- `G` - Arrange selected nodes in grid
- `?` - Show keyboard shortcuts

## Adding New Node Types

1. Define the data interface in `src/types/index.ts`
2. Add to `NodeType` union in `src/types/index.ts`
3. Create default data in `createDefaultNodeData()` in `workflowStore.ts`
4. Add dimensions to `defaultDimensions` in `workflowStore.ts`
5. Create the component in `src/components/nodes/`
6. Export from `src/components/nodes/index.ts`
7. Register in `COMPONENT_REGISTRY` in `src/lib/nodePacks/nodeRegistry.ts`
8. Add node entry to `custom_nodes/{packId}/manifest.json`
9. Add minimap color in `WorkflowCanvas.tsx`
10. Update `getConnectedInputs()` if the node produces consumable output
11. Add execution logic in `executeWorkflow()` if the node requires processing
12. Update `ConnectionDropMenu.tsx` to include the node in source/target lists

### Handle Naming Convention

Use descriptive handle IDs matching the data type:
- `id="image"` for image data
- `id="text"` for text data

### Validation

- Connection validation: `isValidConnection()` in `WorkflowCanvas.tsx`
- Workflow validation: `validateWorkflow()` in `workflowStore.ts`

## Adding New Kie.ai Models (SOP)

Reference docs: https://docs.kie.ai/llms.txt lists all available model API pages.

### Step 1: Gather API Details
Visit the model's doc page on https://docs.kie.ai/ and collect:
- Model ID(s) (the `model` param sent to the API)
- Capabilities: text-to-image, image-to-image, text-to-video, image-to-video
- API endpoint (standard: `/api/v1/jobs/createTask`, or model-specific like Veo's `/api/v1/veo/generate`)
- All input parameters: name, type, enum values, defaults, required status
- Image/video input parameter name (e.g., `image_urls`, `imageUrls`, `input_urls`)
- Polling endpoint (standard: `/api/v1/jobs/recordInfo`, or model-specific)
- Response format and status field names
- Pricing (per-run cost if available)

### Step 2: Add Model Registry Entry
**File:** `src/app/api/models/route.ts` — Add to `KIE_MODELS` array.
Each model entry needs: `id`, `name`, `description`, `provider: "kie"`, `capabilities`, `pricing`, `pageUrl`.
Use separate entries for each capability variant (e.g., `model/text-to-video` and `model/image-to-video`).

### Step 3: Add Parameter Schema
**File:** `src/app/api/models/[modelId]/route.ts` — Add to `getKieSchema()`.
Define `parameters` (user-configurable settings) and `inputs` (connectable handles like prompt, images).

### Step 4: Add Default Parameters
**File:** `src/app/api/generate/route.ts` — Add case to `getKieModelDefaults()`.
Provide required defaults that must be present even if the user doesn't set them.

### Step 5: Add Image Input Key Mapping
**File:** `src/app/api/generate/route.ts` — Add to `getKieImageInputKey()`.
Map the model to its correct image parameter name if it differs from the default `image_urls`.

### Step 6: Handle Non-Standard API (if applicable)
If the model uses different endpoints than `/api/v1/jobs/createTask` and `/api/v1/jobs/recordInfo`:
- Add a detection function (e.g., `isVeoModel()`)
- Add a model-ID-to-API-model mapping function
- Add a custom polling function for the model's status endpoint
- Add a branch in `generateWithKie()` for the custom request format

## Node Pack Manager

The Node Pack Manager allows discovering, installing, updating, and uninstalling custom node packs from a remote registry (GitHub-hosted `agent1-registry`).

### Architecture

Three-layer system:
1. **Remote registry** — `node-packs.json` in `agent1-registry` repo (auto-generated by `generate-node-packs-index.js`)
2. **Backend API** — endpoints for registry fetch, install, uninstall, restart, active-types, health
3. **Frontend UI** — `NodePackManager` dialog (available/installed tabs) + `NodePackChecker` (startup badge)

### Key Files

| Purpose | Location |
|---------|----------|
| Node Pack types | `src/types/nodePacks.ts` |
| Manifest validation (Zod) | `src/lib/nodePacks/validation.ts` |
| App version + semver check | `src/lib/nodePacks/appVersion.ts` |
| Component registry + buildNodeTypes | `src/lib/nodePacks/nodeRegistry.ts` |
| Registry API | `src/app/api/node-packs/registry/route.ts` |
| Install API (atomic) | `src/app/api/node-packs/install/route.ts` |
| Uninstall API (core protection) | `src/app/api/node-packs/uninstall/route.ts` |
| Restart API | `src/app/api/restart/route.ts` |
| Active types API | `src/app/api/node-registry/active-types/route.ts` |
| Health API | `src/app/api/health/route.ts` |
| Startup checker component | `src/components/node-packs/NodePackChecker.tsx` |
| Manager dialog | `src/components/node-packs/NodePackManager.tsx` |
| Pack card component | `src/components/node-packs/NodePackCard.tsx` |
| Registry generator script | `scripts/generate-node-packs-index.js` |

### How It Works

- Node components are **pre-compiled** in the app bundle (`COMPONENT_REGISTRY` in `nodeRegistry.ts`)
- "Installing" a pack = downloading its `manifest.json` + `specs/` to `custom_nodes/{packId}/`
- After install, app restart is required — nodes activate from manifests on next startup
- `WorkflowCanvas.tsx` uses `buildNodeTypes(activeNodeTypes)` to dynamically build ReactFlow's `nodeTypes`
- `NodePackChecker` runs at app start: fetches active types into Zustand + checks for new packs (badge)

### Publishing Flow

1. Develop node in `app/custom_nodes/{packId}/` with `manifest.json` + `specs/`
2. Copy pack folder to `agent1-registry/custom_nodes/{packId}/`
3. Run `PUSH_TO_GITHUB.bat` (calls `generate-node-packs-index.js` → generates `node-packs.json` → commits + pushes)

### Core Pack Protection

- `agent1-foundation` is hardcoded as a core pack — cannot be uninstalled or reinstalled
- Manifest flags `isCore: true` and `removable: false` provide additional protection

## API Routes

All routes in `src/app/api/`:

| Route | Timeout | Purpose |
|-------|---------|---------|
| `/api/generate` | 5 min | Image generation via Gemini |
| `/api/llm` | 1 min | Text generation (Google/OpenAI) |
| `/api/workflow` | default | Save/load workflow files |
| `/api/save-generation` | default | Auto-save generated images |
| `/api/logs` | default | Session logging |
| `/api/node-packs/registry` | 10s | Fetch node pack registry with install status |
| `/api/node-packs/install` | default | Install node pack (atomic download) |
| `/api/node-packs/uninstall` | default | Uninstall node pack (core protected) |
| `/api/node-registry/active-types` | default | List active node types from manifests |
| `/api/restart` | default | Graceful server restart |
| `/api/health` | default | Health check for restart detection |

## localStorage Keys

- `agent1-workflow-configs` - Project metadata (paths)
- `agent1-workflow-costs` - Cost tracking per workflow
- `agent1-nanoBanana-defaults` - Sticky generation settings
- `agent1-node-packs-lastSeen` - Timestamp for new pack badge detection

## UI Design System

### Unified Dialog / Modal System

All modals MUST use the shared Dialog primitives from `src/components/ui/dialog.tsx`. Components: Dialog, DialogContent (size: sm|md|lg|xl|full), DialogHeader, DialogTitle, DialogTabs, DialogBody, DialogFooter, DialogButton (variant: primary|secondary|ghost), DialogSeparator.

Layout convention (flex column): DialogContent → DialogHeader → DialogTabs (optional) → DialogBody (scrollable) → DialogFooter.

All Dialog modals automatically receive the rotating glow effect via the `modal-glow` CSS class applied to DialogContent. The glow uses a `conic-gradient` with `var(--accent)` color, animated via `@keyframes node-glow-rotate`. CSS rules in `globals.css`.

### Skin / Theme System

Theming uses `data-theme` (dark/light) + `data-skin` (brand) attributes on `<html>`. 11 skins: ignite, aurora, ember, matrix, sienna, sage, orchid, platinum, abyss, amber, ocean. CSS custom properties (`--accent`, `--surface-1`, `--surface-2`, `--border`, `--text-primary`, `--text-muted`, `--modal-bg`, `--modal-border`, `--node-bg`, etc.) drive all colors.

Brand logo SVGs per skin: `src/components/settings/BrandLogo.tsx` → `public/skins/{skin}.svg`.

### Node Visual Consistency

- BaseNode `fullBleed` mode uses solid `bg-neutral-800` (not semi-transparent) + `border-neutral-700/40`
- Non-fullBleed mode uses `bg-neutral-800` + `shadow-lg` + dynamic border colors
- Selected node glow: `.react-flow__node.selected::before` (rotating conic-gradient) + `::after` (box-shadow) in `globals.css`
- Custom NA (Neural Atelier) nodes use `fullBleed` with solid `bg-[var(--node-bg,#1a1a1a)]` preview containers and solid `bg-neutral-900` empty states

### Login Page

- `src/app/login/LoginUI.tsx` — Layout with slogan (top-left), agent¹ brand (top-right), contact (bottom-right)
- `src/app/login/LoginForm.tsx` — A1 logo + version badge using `formatVersion()` from `src/lib/appVersion.ts`
- `src/app/login/LoginTunnel.tsx` — Three.js WebGL tunnel animation with per-skin color palettes
- Skin auto-rotation interval: 18 seconds

## Deployment

### Two Deployment Modes

| Mode | Script | Binding | Access |
|------|--------|---------|--------|
| **Local** | `start.bat` | `localhost:3000` | Local machine only |
| **Azure (remote)** | `run-service.bat` | `0.0.0.0:3000` | Any browser via public IP |

### Azure VM Configuration

- **VM**: Windows Server at `72.146.168.162`
- **Path on VM**: `C:\agent1`
- **URL**: `http://72.146.168.162:3000`
- **Auto-start**: Windows Task Scheduler (`schtasks /tn "Agent1"`)
- **NSG**: Inbound rule `Allow-Agent1-3000` (port 3000, TCP, priority 310)

### Key server.js Change

`server.js` line 122: `const hostname = process.env.HOST || 'localhost'` — supports external binding via `HOST=0.0.0.0` env var while maintaining backward compatibility for local installs.

### Custom Node Config Path Convention

All API routes that access `custom_nodes/` MUST use `process.cwd()` directly (NOT `path.resolve(process.cwd(), "..")`). The `custom_nodes/` directory lives at the project root, same level as `src/`, `package.json`, etc.

The `PACK_ID` constants in node components and executors MUST match the actual directory name under `custom_nodes/`:
- `morpheus-model-management` (NOT `comfyui_morpheus_model_management`)
- `agent1_neural_atelier` (NOT `comfyui_neural_atelier`)

Legacy aliases for backward compatibility with saved workflows are maintained in `src/app/api/custom-nodes/[packId]/configs/[...path]/route.ts` via the `PACK_ALIASES` map.

### Azure Release Procedure

1. Run `build-candidate.js` from the source project
2. **IMPORTANT**: `src/lib/storage/fileNaming.ts` is excluded by `build-candidate.js` because `shouldExclude()` blocks any path containing `storage/`. Add this file manually to the ZIP
3. Add `start-azure.bat` and `run-service.bat` to the ZIP
4. Copy ZIP to VM, extract to `C:\agent1`, restart the service
5. If `package.json` changed: run `npm install` before restart
6. If `src/` changed: run `npm run build` before restart

### VM Service Management

```bat
schtasks /run /tn "Agent1"          # Start
schtasks /end /tn "Agent1"          # Stop
schtasks /query /tn "Agent1"        # Status
```

## Git Workflow

- The primary development branch is `develop`, NOT `main` or `master`
- Always checkout `develop` before creating feature branches: `git checkout develop`
- Create feature branches from `develop` using: `feature/<short-description>` or `fix/<short-description>`
- All PRs MUST target `develop`: use `gh pr create --base develop`
- Never push directly to `main`, `master`, or `develop`

## Commits
- Commit after each logical task or unit of work is complete. When implementing a multi-task plan, commit after finishing each task — do NOT batch all tasks into a single commit at the end.
- Each commit should be atomic and self-contained: one task = one commit.
- The .planning directory is untracked, do not attempt to commit any changes to the files in this directory.

