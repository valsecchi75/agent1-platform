# Ray-Ban Catalogue Node — Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Author:** Claude + Sergio

## Overview

A new custom node pack for Agent 1 called `rayban-catalogue` that provides a browsable Ray-Ban eyewear catalog with filtering, selection, and workflow integration. Follows the same architecture as `morpheus-model-management` — a local JSON database of products with images, exposed through a React Flow node with image/text/metadata outputs.

**Deployment model:** Two-layer, same as Morpheus. The **config data** (catalog.json + images) lives in a standalone pack directory `custom_nodes/rayban-catalogue/`. The **node component code** is compiled into the app bundle (COMPONENT_REGISTRY) and also registered in `agent1-foundation/manifest.json` so the active-types API picks it up. This is the same dual-registration pattern Morpheus uses.

The initial scope is the **Wayfarer collection** as a proof-of-concept. Once validated, the same structure scales to the full Ray-Ban catalog.

## Goals

1. Scrape the Ray-Ban Wayfarer collection via browser automation (Claude in Chrome)
2. Download JPG images (800-1200px) for each product variant
3. Organize data as a local catalog.json with rich metadata per eyewear item
4. Build a browsable node component (`RayBanCatalogueNode`) matching the Morpheus UX pattern
5. Output image, description (@variable for prompts), and metadata JSON for downstream workflow nodes
6. Support both AI image generation workflows and visual lookbook/composition workflows

## Node Pack Structure

```
custom_nodes/rayban-catalogue/
├── manifest.json
├── README.md
└── configs/
    └── rayban_catalogue/
        ├── catalog.json
        └── images/
            ├── rb2140_901.jpg
            ├── rb2140_902.jpg
            └── ...
```

**CRITICAL naming convention:**
- Directory name = `rayban-catalogue` (kebab-case) → this is the `PACK_ID`
- Config subdirectory = `rayban_catalogue` (snake_case) → this is the `CONFIG_DIR`
- These MUST match exactly or the config API route will return 404

### manifest.json

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

## Catalog Schema

```json
{
  "version": "1.0",
  "brand": "Ray-Ban",
  "collection": "Wayfarer",
  "description": "Ray-Ban Wayfarer Collection Catalog",
  "source_url": "https://www.ray-ban.com/...",
  "created": "2026-04-08",
  "last_updated": "2026-04-08",
  "eyewear": [
    {
      "id": "rb2140_901",
      "name": "Wayfarer Classic",
      "model_code": "RB2140",
      "color_code": "901",
      "collection": "Wayfarer",
      "category": "sunglasses",
      "frame_color": "Black",
      "lens_color": "Green Classic G-15",
      "frame_material": "Acetate",
      "frame_shape": "Square",
      "lens_type": "Crystal",
      "lens_technology": "Classic",
      "size": "50-22-150",
      "bridge": "22",
      "temple_length": "150",
      "lens_width": "50",
      "price": "163.00",
      "currency": "EUR",
      "gender": "unisex",
      "is_polarized": false,
      "is_photochromic": false,
      "tags": ["classic", "iconic", "acetate", "square", "wayfarer"],
      "description": "Ray-Ban Wayfarer Classic RB2140 in black acetate with green G-15 lenses. Iconic square frame design, 50mm lens width.",
      "image_path": "images/rb2140_901.jpg",
      "thumbnail_url": "",
      "full_image_url": "",
      "rating": 0,
      "is_favorite": false,
      "copyright": "Ray-Ban / EssilorLuxottica"
    }
  ]
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique ID: `{model_code}_{color_code}` lowercase |
| name | string | Product display name |
| model_code | string | Ray-Ban model number (e.g. RB2140) |
| color_code | string | Color variant code |
| collection | string | Collection name (Wayfarer, Aviator, etc.) |
| category | string | `sunglasses` or `eyeglasses` |
| frame_color | string | Human-readable frame color |
| lens_color | string | Human-readable lens color/name |
| frame_material | string | Acetate, Metal, Nylon, etc. |
| frame_shape | string | Square, Round, Pilot, Rectangle, etc. |
| lens_type | string | Crystal, Plastic, etc. |
| lens_technology | string | Classic, Polarized, Photochromic, Gradient, etc. |
| size | string | Standard notation: `lens-bridge-temple` |
| bridge | string | Bridge width in mm |
| temple_length | string | Temple arm length in mm |
| lens_width | string | Lens diameter in mm |
| price | string | Price as decimal string |
| currency | string | ISO currency code |
| gender | string | unisex, male, female |
| is_polarized | boolean | Has polarized lenses |
| is_photochromic | boolean | Has photochromic (Transitions) lenses |
| tags | string[] | Searchable keywords |
| description | string | Natural language description for AI prompts |
| image_path | string | Relative path to local image |
| thumbnail_url | string | Optional remote thumbnail |
| full_image_url | string | Optional remote full-res image |
| rating | number | User rating (0 = unrated, session-only) |
| is_favorite | boolean | User favorite flag (session-only) |
| copyright | string | Copyright notice |

**Note:** `rating` and `is_favorite` are session-only UI state. They are not persisted across app restarts in v1.

## TypeScript Interface

```typescript
// In src/types/customNodes.ts

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
  outputImage: string | null;       // base64 data URL
  outputDescription: string | null;  // natural language text
  outputMetadata: string | null;     // JSON string
}
```

## Node Component: RayBanCatalogueNode

### Layout

Same as MorpheusModelManagementNode: 560px wide, fixed 4-column grid, 8 items per page, paginated. Locked dimensions (no resize).

### Filters

| Filter | Type | Options |
|--------|------|---------|
| Name search | text input | Free text |
| Category | select | All, Sunglasses, Eyeglasses |
| Frame Shape | select | All, Square, Round, Pilot, Rectangle, ... |
| Frame Material | select | All, Acetate, Metal, Nylon, ... |
| Lens Technology | select | All, Classic, Polarized, Photochromic, Gradient |
| Gender | select | All, Unisex, Male, Female |
| Favorites only | toggle | Boolean |

### Output Handles

| Handle ID | Type | Data |
|-----------|------|------|
| image | image | Selected eyewear image (base64 at execution) |
| description | text | Natural language description for prompts |
| metadata | text | Full JSON metadata of selected item |

### Variable System

On selection, the node registers `@{model_code}_{color_code}` (e.g. `@rb2140_901`) as a variable name. The **description** output is the variable's value — this is the natural language text that PromptConstructor substitutes when it encounters the @variable in a prompt template.

Implementation: the executor sets `variableName` in the node data, which the PromptConstructor reads when resolving @variables (same mechanism as Morpheus).

### Image Data Flow

1. **At render time (component):** The catalog loads via `/api/custom-nodes/rayban-catalogue/configs/rayban_catalogue/catalog.json`. Thumbnail images are resolved as `/api/custom-nodes/rayban-catalogue/configs/rayban_catalogue/{image_path}` and rendered with `loading="lazy"`.
2. **On selection:** `selectedEyewearImage` stores the resolved API URL.
3. **At execution time (executor):** The executor fetches the image URL, reads it as a blob, converts to base64 data URL. This ensures downstream nodes (Gemini API) receive the required base64 format. If the image is already base64, it is passed through unchanged.

### Error Handling

- **Catalog missing/malformed:** Show "No catalog available" in the grid area. Log error to console.
- **Image file missing:** Show placeholder icon (same as Morpheus UserCircle2 pattern). Node still selectable.
- **Execution with no selection:** Throw descriptive error: "No eyewear selected. Please select from the catalog."
- **Image fetch failure at execution:** Pass the URL as fallback (preview still works in Output node), log warning.

## Scraping Strategy

### Method
Browser automation via Claude in Chrome (Approach A).

### Steps
1. Navigate to ray-ban.com Wayfarer collection page
2. Handle cookie consent and country/region popups
3. Scroll to load all products (lazy-loaded)
4. For each product in the listing: extract name, model code, price, thumbnail URL
5. Navigate into each product detail page for: color variants, technical specs (material, dimensions, lens type), high-res image URLs
6. Download each image as JPG (800-1200px) to `configs/rayban_catalogue/images/`
7. Generate `catalog.json` with all structured data
8. Generate the `description` field for each item: built from structured fields at scrape time using a template pattern: `"{name} {model_code} in {frame_color} {frame_material} with {lens_color} lenses. {frame_shape} frame, {lens_width}mm lens width."` — no AI model needed, deterministic from metadata.

### Data Sources on Product Pages
- Product title and model number from page heading
- Technical specs table (frame material, shape, lens width, bridge, temple)
- Color/lens info from variant selector
- Price from price display
- Images from product gallery (front view preferred)
- JSON-LD structured data if available in page source

### Contingencies
- **Images not JPG:** Convert via canvas or accept WebP if JPG unavailable
- **Rate limiting:** Pace requests with natural delays between page navigations
- **Missing specs:** Fill with empty strings, mark in tags as "incomplete"
- **Country popup:** Dismiss or select Italy/EU for EUR pricing

## Integration with Agent 1

### Registration Checklist

All changes required to make the node functional:

| File | Change |
|------|--------|
| `src/types/nodes.ts` | Add `"rayBanCatalogue"` to NodeType union |
| `src/types/customNodes.ts` | Add `RayBanEyewear`, `RayBanCatalog`, `RayBanFilters`, `RayBanCatalogueData` interfaces |
| `src/components/nodes/custom/RayBanCatalogueNode.tsx` | New component (clone Morpheus pattern) |
| `src/components/nodes/index.ts` | Export `RayBanCatalogueNode` |
| `src/lib/nodePacks/nodeRegistry.ts` | Add to COMPONENT_REGISTRY: `rayBanCatalogue: RayBanCatalogueNode` |
| `src/store/execution/custom/rayBanCatalogueExecutor.ts` | New executor |
| `src/store/execution/executeNode.ts` | Add case `"rayBanCatalogue"` |
| `src/store/utils/nodeDefaults.ts` | Add dimensions (560x720) + default data |
| `src/store/utils/connectedInputs.ts` | Add output routing for image/description/metadata handles |
| `custom_nodes/agent1-foundation/manifest.json` | Add node entry to nodes array |
| `custom_nodes/agent1-foundation/specs/rayBanCatalogue.json` | New spec file |
| `src/components/FloatingActionBar.tsx` | Add "Eyewear" category with rayBanCatalogue entry |
| `src/components/WorkflowCanvas.tsx` | Add minimap color label |

### PACK_ID Convention
Per the fix applied today, the component and executor MUST use:
```typescript
const PACK_ID = "rayban-catalogue";
const CONFIG_DIR = "rayban_catalogue";
```
Matching the actual directory name under `custom_nodes/`.

## Out of Scope (v1)

- Other Ray-Ban collections (future expansion)
- Remote/authenticated catalog (Morpheus Patreon pattern — not needed here)
- Price comparison or e-commerce integration
- Automatic catalog updates/re-scraping
- Multiple image angles per product (front view only for v1)
- Persistent favorites/ratings across sessions
