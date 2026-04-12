# Ray-Ban Catalogue Node Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browsable Ray-Ban eyewear catalog node for Agent 1, starting with the Wayfarer collection scraped from ray-ban.com.

**Architecture:** Two-phase — first scrape product data and images via browser automation into a local catalog, then build the node component and register it into the app following the Morpheus dual-registration pattern (standalone config pack + foundation manifest entry).

**Tech Stack:** Next.js, React Flow, TypeScript, Zustand, Claude in Chrome (browser automation for scraping)

**Spec:** `docs/superpowers/specs/2026-04-08-rayban-catalogue-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `custom_nodes/rayban-catalogue/manifest.json` | Create | Pack manifest |
| `custom_nodes/rayban-catalogue/README.md` | Create | Pack readme |
| `custom_nodes/rayban-catalogue/configs/rayban_catalogue/catalog.json` | Create | Eyewear database (from scraping) |
| `custom_nodes/rayban-catalogue/configs/rayban_catalogue/images/*.jpg` | Create | Product images (from scraping) |
| `custom_nodes/agent1-foundation/manifest.json` | Modify:40 | Add rayBanCatalogue node entry |
| `custom_nodes/agent1-foundation/specs/rayBanCatalogue.json` | Create | Node spec file |
| `src/types/nodes.ts` | Modify:55 | Add `"rayBanCatalogue"` to NodeType union |
| `src/types/customNodes.ts` | Modify:180 | Add RayBan interfaces |
| `src/components/nodes/custom/RayBanCatalogueNode.tsx` | Create | Node component |
| `src/components/nodes/index.ts` | Modify:30 | Export RayBanCatalogueNode |
| `src/lib/nodePacks/nodeRegistry.ts` | Modify:69 | Add to COMPONENT_REGISTRY |
| `src/store/execution/custom/rayBanCatalogueExecutor.ts` | Create | Execution logic |
| `src/store/execution/executeNode.ts` | Modify:253 | Add dispatch case |
| `src/store/utils/nodeDefaults.ts` | Modify:68,436 | Add dimensions + default data |
| `src/store/utils/connectedInputs.ts` | Modify:144 | Add output routing |
| `src/components/FloatingActionBar.tsx` | Modify:114 | Add Eyewear category |
| `src/components/WorkflowCanvas.tsx` | Modify:337 | Add minimap label |

---

## Task 1: Scrape Ray-Ban Wayfarer Collection

> **This task is INTERACTIVE — it requires Claude in Chrome browser automation.**
> It CANNOT be delegated to a code-only subagent. The human operator or a Claude session
> with browser access must perform this task, navigating ray-ban.com in real time.
> The existing API route `GET /api/custom-nodes/[packId]/configs/[...path]` (defined in
> `src/app/api/custom-nodes/[packId]/configs/[...path]/route.ts`) serves config files
> from `custom_nodes/{packId}/configs/` — this is how the node loads catalog.json and images at runtime.

**Files:**
- Create: `custom_nodes/rayban-catalogue/configs/rayban_catalogue/catalog.json`
- Create: `custom_nodes/rayban-catalogue/configs/rayban_catalogue/images/*.jpg`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p custom_nodes/rayban-catalogue/configs/rayban_catalogue/images
```

- [ ] **Step 2: Navigate to Ray-Ban Wayfarer collection page**

Use Claude in Chrome to navigate to: `https://www.ray-ban.com/italy/occhiali-da-sole/wayfarer`
(If URL has changed, go to `https://www.ray-ban.com/italy` → Occhiali da sole → Wayfarer.)
Handle cookie consent: click "Accetta" or dismiss. Handle country popup: select Italy for EUR pricing.

- [ ] **Step 3: Scroll to load all products**

The collection page uses lazy-loading. Scroll to the bottom of the page repeatedly until all products are visible. Use the `read_page` or `get_page_text` tool to verify product count stops growing.

- [ ] **Step 4: Extract product listing data**

Use `javascript_tool` to extract structured data from the page. Try JSON-LD first:
```javascript
// Check for JSON-LD product data
const scripts = document.querySelectorAll('script[type="application/ld+json"]');
const jsonLd = Array.from(scripts).map(s => JSON.parse(s.textContent)).filter(d => d['@type'] === 'Product' || d['@type'] === 'ItemList');
JSON.stringify(jsonLd, null, 2);
```

If JSON-LD is not available, extract from DOM:
```javascript
// Extract product cards from the listing grid
const cards = document.querySelectorAll('[data-testid="product-card"], .product-tile, .product-card');
const products = Array.from(cards).map(card => ({
  name: card.querySelector('h2, h3, .product-name')?.textContent?.trim(),
  link: card.querySelector('a')?.href,
  price: card.querySelector('.price, [data-testid="price"]')?.textContent?.trim(),
  image: card.querySelector('img')?.src,
}));
JSON.stringify(products, null, 2);
```

Save the extracted data. Expect 15-30 products.

- [ ] **Step 5: Visit each product detail page and extract specs**

For each product URL from Step 4, navigate to the detail page. On each page, extract:

```javascript
// Try JSON-LD first
const ld = document.querySelectorAll('script[type="application/ld+json"]');
const productData = Array.from(ld).map(s => JSON.parse(s.textContent)).find(d => d['@type'] === 'Product');

// Also extract specs from the page DOM
const specs = {};
document.querySelectorAll('.product-specs dt, .product-specs dd, .spec-label, .spec-value').forEach(el => {
  // Build key-value pairs from spec table
});

// Extract color variants
const variants = document.querySelectorAll('.color-swatch, [data-testid="color-option"]');
const colors = Array.from(variants).map(v => ({
  colorCode: v.getAttribute('data-color') || v.getAttribute('data-sku'),
  colorName: v.getAttribute('title') || v.getAttribute('aria-label'),
  image: v.querySelector('img')?.src,
}));

JSON.stringify({ productData, specs, colors }, null, 2);
```

Key specs to extract: frame_material, frame_shape, lens_width, bridge, temple_length, lens_type, gender.

- [ ] **Step 6: Download images**

For each product variant, save the front-view image. Use the highest resolution available.
Target filename: `custom_nodes/rayban-catalogue/configs/rayban_catalogue/images/{id}.jpg`
where `id` = `rb{model_number}_{color_code}` all lowercase (e.g. `rb2140_901.jpg`).

If images are WebP, convert to JPG or save as-is with `.webp` extension and update catalog accordingly.

- [ ] **Step 7: Generate catalog.json**

Build the complete `catalog.json` following the schema from the spec. Description template:
```
"{name} {model_code} in {frame_color} {frame_material} with {lens_color} lenses. {frame_shape} frame, {lens_width}mm lens width."
```
Auto-generate `tags` from: collection name, frame shape, material, lens technology, "polarized" if applicable.

- [ ] **Step 8: Validate catalog.json**

```bash
# Verify JSON is valid
node -e "const c = require('./custom_nodes/rayban-catalogue/configs/rayban_catalogue/catalog.json'); console.log(c.eyewear.length + ' items'); const imgs = require('fs').readdirSync('./custom_nodes/rayban-catalogue/configs/rayban_catalogue/images'); console.log(imgs.length + ' images'); const missing = c.eyewear.filter(e => !imgs.includes(e.image_path.replace('images/',''))); if(missing.length) console.log('MISSING:', missing.map(e=>e.id)); else console.log('All images OK');"
```

- [ ] **Step 9: Commit scraped data**

```bash
git add custom_nodes/rayban-catalogue/configs/
git commit -m "data: scrape Ray-Ban Wayfarer collection catalog and images"
```

---

## Task 2: Create Node Pack Manifest and Spec

**Files:**
- Create: `custom_nodes/rayban-catalogue/manifest.json`
- Create: `custom_nodes/rayban-catalogue/README.md`
- Create: `custom_nodes/agent1-foundation/specs/rayBanCatalogue.json`
- Modify: `custom_nodes/agent1-foundation/manifest.json:40`

- [ ] **Step 1: Create pack manifest.json**

Create `custom_nodes/rayban-catalogue/manifest.json`:
```json
{
  "id": "rayban-catalogue",
  "name": "Ray-Ban Catalogue",
  "displayName": "Ray-Ban Eyewear Catalogue",
  "version": "1.0.0",
  "author": "AGENT 1 Team",
  "description": "Browsable Ray-Ban eyewear catalog with filtering, selection, and workflow variable output",
  "category": "Eyewear",
  "minAppVersion": "0.9.0",
  "license": "MIT",
  "isCore": false,
  "removable": true,
  "nodes": [
    {
      "type": "rayBanCatalogue",
      "name": "Ray-Ban Catalogue",
      "category": "custom/eyewear",
      "specFile": "specs/rayBanCatalogue.json"
    }
  ],
  "hasSpecs": true,
  "dependencies": []
}
```

- [ ] **Step 2: Create README.md**

Create `custom_nodes/rayban-catalogue/README.md` with basic pack description.

- [ ] **Step 3: Create node spec file**

Create `custom_nodes/agent1-foundation/specs/rayBanCatalogue.json`:
```json
{
  "nodeType": "rayBanCatalogue",
  "name": "Ray-Ban Catalogue",
  "version": "1.0.0",
  "category": "custom/eyewear",
  "tags": ["rayban", "eyewear", "sunglasses", "wayfarer", "catalog", "glasses", "fashion"],
  "summary": "Browsable Ray-Ban eyewear catalog node. Displays a paginated 4-column grid of eyewear products with filtering by category, frame shape, material, lens technology, and gender. Outputs the selected eyewear's image, description, and full metadata via three output handles. Uses a local catalog.json database with product images.",
  "inputs": [],
  "outputs": [
    {
      "id": "image",
      "type": "image",
      "description": "The selected eyewear product image (URL or base64)."
    },
    {
      "id": "description",
      "type": "text",
      "description": "Natural language description of the selected eyewear — includes model name, frame color, material, lens color, and dimensions. Used as @variable value in downstream Prompt Constructor nodes."
    },
    {
      "id": "metadata",
      "type": "text",
      "description": "Full JSON metadata for the selected eyewear — includes model code, color code, all specs, tags, pricing, and the @variable name."
    }
  ],
  "executionNotes": "On execution, the node loads the eyewear catalog from local config, finds the selected item by ID, and outputs image (converted to base64) + description + metadata JSON. The description output is registered as a @variable (e.g., @rb2140_901) for Prompt Constructor nodes. The node is fixed at 560x720px with resize disabled. Catalog is paginated at 8 items per page with lazy image loading.",
  "exampleConnections": [
    {
      "from": "rayBanCatalogue.image",
      "to": "nanoBanana.sourceImage",
      "scenario": "Use the selected eyewear image as a reference for AI generation."
    },
    {
      "from": "rayBanCatalogue.description",
      "to": "promptConstructor.text",
      "scenario": "Feed the eyewear description into a prompt template as @variable."
    },
    {
      "from": "rayBanCatalogue.metadata",
      "to": "showAnything.anything",
      "scenario": "View the full eyewear metadata JSON in a Show Anything debug node."
    }
  ],
  "apiProvider": "local",
  "requiresApiKey": false
}
```

- [ ] **Step 4: Add node entry to agent1-foundation manifest**

In **`custom_nodes/agent1-foundation/manifest.json`**, add after line 40 (the `morpheusModelManagement` entry):
```json
    { "type": "rayBanCatalogue", "name": "Ray-Ban Catalogue", "category": "custom/eyewear", "specFile": "specs/rayBanCatalogue.json" }
```

- [ ] **Step 5: Commit**

```bash
git add custom_nodes/rayban-catalogue/manifest.json custom_nodes/rayban-catalogue/README.md
git add custom_nodes/agent1-foundation/specs/rayBanCatalogue.json custom_nodes/agent1-foundation/manifest.json
git commit -m "feat: add rayban-catalogue pack manifest and spec"
```

---

## Task 3: Add TypeScript Types

**Files:**
- Modify: `src/types/nodes.ts:55`
- Modify: `src/types/customNodes.ts:180`

- [ ] **Step 1: Add NodeType union entry**

In `src/types/nodes.ts`, after line 55 (`| "morpheusModelManagement"`), add:
```typescript
  // Ray-Ban Eyewear custom nodes
  | "rayBanCatalogue"
```

- [ ] **Step 2: Add RayBan interfaces to customNodes.ts**

In `src/types/customNodes.ts`, after the MorpheusModelManagementData interface (after line 180), add:

```typescript
// ── Ray-Ban Eyewear Catalogue ──

export interface RayBanEyewear {
  id: string;
  name: string;
  model_code: string;
  color_code: string;
  collection: string;
  category: string;
  frame_color: string;
  lens_color: string;
  frame_material: string;
  frame_shape: string;
  lens_type: string;
  lens_technology: string;
  size: string;
  bridge: string;
  temple_length: string;
  lens_width: string;
  price: string;
  currency: string;
  gender: string;
  is_polarized: boolean;
  is_photochromic: boolean;
  tags: string[];
  description: string;
  image_path: string;
  thumbnail_url: string;
  full_image_url: string;
  rating: number;
  is_favorite: boolean;
  copyright: string;
}

export interface RayBanCatalog {
  version: string;
  brand: string;
  collection: string;
  description: string;
  eyewear: RayBanEyewear[];
}

export interface RayBanFilters {
  name: string;
  category: string;
  frame_shape: string;
  frame_material: string;
  lens_technology: string;
  gender: string;
  favoritesOnly: boolean;
}

export interface RayBanCatalogueData extends BaseNodeData {
  // Selection state
  selectedEyewearId: string | null;
  selectedEyewearName: string | null;
  selectedEyewearImage: string | null;
  selectedEyewearDescription: string | null;
  selectedEyewearTags: string[];

  // Filters
  filters: RayBanFilters;
  currentPage: number;

  // Variable output
  variableName: string | null;

  // Execution outputs
  outputImage: string | null;
  outputDescription: string | null;
  outputMetadata: string | null;

  // Status
  status: NodeStatus;
  error: string | null;
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -i rayban`
Expected: No errors related to RayBan types.

- [ ] **Step 4: Commit**

```bash
git add src/types/nodes.ts src/types/customNodes.ts
git commit -m "feat: add RayBanCatalogue TypeScript type definitions"
```

---

## Task 4: Add Node Defaults and Registration

**Files:**
- Modify: `src/store/utils/nodeDefaults.ts:68,436`
- Modify: `src/store/utils/connectedInputs.ts:144`
- Modify: `src/store/execution/executeNode.ts:253`
- Modify: `src/components/nodes/index.ts:30`
- Modify: `src/lib/nodePacks/nodeRegistry.ts:69`
- Modify: `src/components/FloatingActionBar.tsx:114`
- Modify: `src/components/WorkflowCanvas.tsx:337`

- [ ] **Step 1: Add dimensions in nodeDefaults.ts**

After line 68 (`morpheusModelManagement: { width: 560, height: 720 },`), add:
```typescript
  // Ray-Ban Eyewear custom nodes
  rayBanCatalogue: { width: 560, height: 720 },
```

- [ ] **Step 2: Add default data factory in nodeDefaults.ts**

After the morpheusModelManagement case (around line 436), add:
```typescript
    // Ray-Ban Eyewear custom nodes
    case "rayBanCatalogue":
      return {
        selectedEyewearId: null,
        selectedEyewearName: null,
        selectedEyewearImage: null,
        selectedEyewearDescription: null,
        selectedEyewearTags: [],
        filters: {
          name: "",
          category: "",
          frame_shape: "",
          frame_material: "",
          lens_technology: "",
          gender: "",
          favoritesOnly: false,
        },
        currentPage: 1,
        variableName: null,
        outputImage: null,
        outputDescription: null,
        outputMetadata: null,
        status: "idle",
        error: null,
      } as import("@/types/customNodes").RayBanCatalogueData;
```

- [ ] **Step 3: Add output routing in connectedInputs.ts**

After line 144 (morpheusModelManagement routing), add:
```typescript
  } else if (sourceNode.type === "rayBanCatalogue") {
    const rbData = sourceNode.data as import("@/types/customNodes").RayBanCatalogueData;
    if (sourceHandle === "description") return { type: "text", value: rbData.outputDescription };
    if (sourceHandle === "metadata") return { type: "text", value: rbData.outputMetadata };
    return { type: "image", value: rbData.outputImage };
  }
```

- [ ] **Step 4: Add execution dispatch in executeNode.ts**

After line 253 (morpheusModelManagement case), add:
```typescript
      // Ray-Ban Eyewear custom nodes
      case "rayBanCatalogue":
        await executeRayBanCatalogue(ctx);
        break;
```

Also add the import at the top of the file (near the morpheus import):
```typescript
import { executeRayBanCatalogue } from "./custom/rayBanCatalogueExecutor";
```

- [ ] **Step 5: Add component export in nodes/index.ts**

After line 30 (`export { MorpheusModelManagementNode }`), add:
```typescript
// Ray-Ban Eyewear custom nodes
export { RayBanCatalogueNode } from "./custom/RayBanCatalogueNode";
```

- [ ] **Step 6: Add to COMPONENT_REGISTRY in nodeRegistry.ts**

After line 69 (`morpheusModelManagement: MorpheusModelManagementNode,`), add:
```typescript
  rayBanCatalogue: RayBanCatalogueNode,
```

Also add the import at the top:
```typescript
import {
  // ... existing imports ...
  RayBanCatalogueNode,
} from '@/components/nodes';
```

- [ ] **Step 7: Add FloatingActionBar menu entry**

After line 114 (closing of Morpheus category), add:
```typescript
  {
    label: "Eyewear",
    nodes: [
      { type: "rayBanCatalogue", label: "Ray-Ban Catalogue" },
    ],
  },
```

- [ ] **Step 8: Add minimap label in WorkflowCanvas.tsx**

After line 337 (`morpheusModelManagement: 'Morpheus Model Management',`), add:
```typescript
    // Ray-Ban Eyewear custom nodes
    rayBanCatalogue: 'Ray-Ban Catalogue',
```

- [ ] **Step 9: Commit**

```bash
git add src/store/utils/nodeDefaults.ts src/store/utils/connectedInputs.ts
git add src/store/execution/executeNode.ts src/components/nodes/index.ts
git add src/lib/nodePacks/nodeRegistry.ts src/components/FloatingActionBar.tsx
git add src/components/WorkflowCanvas.tsx
git commit -m "feat: register rayBanCatalogue node in all app subsystems"
```

---

## Task 5: Create Executor

**Files:**
- Create: `src/store/execution/custom/rayBanCatalogueExecutor.ts`

- [ ] **Step 1: Create the executor file**

Create `src/store/execution/custom/rayBanCatalogueExecutor.ts`:

```typescript
/**
 * Ray-Ban Catalogue Executor
 *
 * When executed, outputs the selected eyewear's image (base64), description, and metadata.
 * The description is available as a @variable in downstream PromptConstructor nodes.
 *
 * Config files are served by the existing API route:
 *   GET /api/custom-nodes/[packId]/configs/[...path]
 *   Defined in: src/app/api/custom-nodes/[packId]/configs/[...path]/route.ts
 *   Resolves to: custom_nodes/{packId}/configs/{...path} on disk
 */

import type { NodeExecutionContext } from "../types";
import type { RayBanCatalogueData } from "@/types/customNodes";

const PACK_ID = "rayban-catalogue";
const CONFIG_DIR = "rayban_catalogue";

export async function executeRayBanCatalogue(ctx: NodeExecutionContext): Promise<void> {
  const { node, updateNodeData } = ctx;
  const data = node.data as RayBanCatalogueData;

  updateNodeData(node.id, { status: "loading", error: null });

  try {
    // Validate selection
    if (!data.selectedEyewearId) {
      throw new Error("No eyewear selected. Please select from the catalog.");
    }

    // Load catalog from local config
    const catalogRes = await fetch(`/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/catalog.json`);
    if (!catalogRes.ok) {
      throw new Error(`Failed to load eyewear catalog: ${catalogRes.status}`);
    }
    const catalog = await catalogRes.json();

    // Find the selected eyewear
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eyewear = (catalog as any).eyewear?.find((e: any) => e.id === data.selectedEyewearId);
    if (!eyewear) {
      throw new Error(`Eyewear "${data.selectedEyewearId}" not found in catalog.`);
    }

    // Build the description output
    const variableName = data.variableName || eyewear.id;

    // Build rich description for downstream nodes
    const descriptionParts: string[] = [];
    descriptionParts.push(`${eyewear.name} ${eyewear.model_code}`);
    if (eyewear.frame_color) descriptionParts.push(`in ${eyewear.frame_color} ${eyewear.frame_material || "frame"}`);
    if (eyewear.lens_color) descriptionParts.push(`with ${eyewear.lens_color} lenses`);
    if (eyewear.frame_shape) descriptionParts.push(`${eyewear.frame_shape} frame`);
    if (eyewear.lens_width) descriptionParts.push(`${eyewear.lens_width}mm lens width`);
    if (eyewear.is_polarized) descriptionParts.push("polarized");

    const fullDescription = descriptionParts.join(". ") + ".";

    // Build metadata JSON
    const metadata = {
      id: eyewear.id,
      name: eyewear.name,
      variable: `@${variableName}`,
      model_code: eyewear.model_code,
      color_code: eyewear.color_code,
      collection: eyewear.collection,
      category: eyewear.category,
      frame_color: eyewear.frame_color,
      lens_color: eyewear.lens_color,
      frame_material: eyewear.frame_material,
      frame_shape: eyewear.frame_shape,
      lens_type: eyewear.lens_type,
      lens_technology: eyewear.lens_technology,
      size: eyewear.size,
      price: eyewear.price,
      currency: eyewear.currency,
      gender: eyewear.gender,
      is_polarized: eyewear.is_polarized,
      is_photochromic: eyewear.is_photochromic,
      tags: eyewear.tags,
      copyright: eyewear.copyright,
    };

    // Get the eyewear image and convert to base64
    const imageSource = data.selectedEyewearImage || null;
    let outputImage: string | null = null;

    if (imageSource) {
      if (imageSource.startsWith("data:")) {
        outputImage = imageSource;
      } else {
        try {
          const imgRes = await fetch(imageSource);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            const mime = blob.type || "image/jpeg";
            outputImage = `data:${mime};base64,${base64}`;
          }
        } catch {
          outputImage = imageSource; // fallback to URL
        }
      }
    }

    updateNodeData(node.id, {
      outputImage,
      outputDescription: fullDescription,
      outputMetadata: JSON.stringify(metadata, null, 2),
      variableName,
      status: "complete",
      error: null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Execution failed";
    updateNodeData(node.id, { status: "error", error: msg });
    throw new Error(msg);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/store/execution/custom/rayBanCatalogueExecutor.ts
git commit -m "feat: add rayBanCatalogue executor with base64 image conversion"
```

---

## Task 6: Create Node Component

**Files:**
- Create: `src/components/nodes/custom/RayBanCatalogueNode.tsx`

This is the largest task. The component is a close adaptation of `MorpheusModelManagementNode.tsx` (526 lines) with eyewear-specific filters replacing Morpheus talent filters.

- [ ] **Step 1: Create RayBanCatalogueNode.tsx**

Create `src/components/nodes/custom/RayBanCatalogueNode.tsx`.

Clone the structure from `MorpheusModelManagementNode.tsx` with these changes:
- **PACK_ID** = `"rayban-catalogue"`, **CONFIG_DIR** = `"rayban_catalogue"`
- **Remove** all Patreon auth logic (lines 36-38, 147-153, 186-290, 359-397 in Morpheus)
- **Replace** filter constants: GENDER_OPTIONS stays, remove AGE_OPTIONS/ETHNICITY_OPTIONS, add CATEGORY_OPTIONS, FRAME_SHAPE_OPTIONS, FRAME_MATERIAL_OPTIONS, LENS_TECH_OPTIONS
- **Replace** `filterTalents()` with `filterEyewear()` — filter by name, category, frame_shape, frame_material, lens_technology, gender, favoritesOnly
- **Replace** `loadCatalog()` — remove remote/Supabase branch, keep only local fetch from `/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/catalog.json`
- **Replace** `selectTalent()` with `selectEyewear()` — set selectedEyewearId/Name/Image/Description/Tags + variableName
- **Replace** `resolveImgUrl()` — remove remote branch, keep only local: `/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/${raw}`
- **Card rendering:** Show eyewear image, name, model_code, and up to 3 tags. Show polarized badge if applicable.
- **Selected preview:** Show eyewear image, name, model code, color, and @variable name
- **Catalog source indicator:** Show count only (no Demo/Online distinction)
- **Output handles:** Same three: image (25%), description (50%), metadata (75%)
- **Filter rows:** Row 1: name search + frame shape. Row 2: category + material + lens tech + gender. No tags input (use built-in tags from catalog).
- **Types:** Use `RayBanCatalogueData`, `RayBanEyewear`, `RayBanFilters` from `@/types/customNodes`

- [ ] **Step 2: Verify the component compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "RayBan\|rayban"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/nodes/custom/RayBanCatalogueNode.tsx
git commit -m "feat: add RayBanCatalogueNode component with eyewear filters and grid"
```

---

## Task 7: Verify Full Integration

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -v "__tests__" | grep "error TS" | head -20`
Expected: No new errors (pre-existing test errors are acceptable).

- [ ] **Step 2: Verify active-types API returns rayBanCatalogue**

After starting dev server, verify the active-types API returns the new node:
```bash
curl -s http://localhost:3000/api/node-registry/active-types | grep rayBanCatalogue
```
Expected: `rayBanCatalogue` appears in the nodeTypes array.

- [ ] **Step 3: Verify catalog.json is served correctly**

```bash
curl -s http://localhost:3000/api/custom-nodes/rayban-catalogue/configs/rayban_catalogue/catalog.json | head -5
```
Expected: Returns the catalog JSON with version and eyewear array.

- [ ] **Step 4: Visual test in browser**

Open the app, find "Eyewear" category in the add-node menu, add a Ray-Ban Catalogue node. Verify:
- Node renders with grid of eyewear
- Filters work (category, frame shape, etc.)
- Selecting an eyewear shows it in the preview area
- @variable name appears
- Pagination works

- [ ] **Step 5: Execution test**

Connect rayBanCatalogue → Output node. Select an eyewear, run workflow. Verify:
- Image output appears in Output node
- No execution errors

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for rayBanCatalogue node"
```
