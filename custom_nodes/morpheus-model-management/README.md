# Morpheus Model Management

Digital talent model management system with browsable catalog, Patreon authentication, and variable output for workflow integration.

## Features

- Browsable 4-column paginated talent grid
- Filtering by gender, age group, ethnicity, tags
- Patreon OAuth for full online catalog access
- Local demo catalog (10 models) when logged out
- Outputs: talent image, physiognomic description, full metadata JSON

## Outputs

| Output | Description |
|--------|-------------|
| `image` | Selected talent portrait (URL or base64, 560x720px) |
| `description` | Rich physiognomic description |
| `metadata` | Full JSON with all attributes and copyright |

## Integration

Outputs can feed into downstream nodes:
- **nanoBanana** — use talent image as reference
- **promptConstructor** — use description as variable

## Configuration

- `configs/morpheus_model_management/catalog.json` — Local demo talent database
- `configs/morpheus_model_management/patreon_config.json` — Patreon tier configuration
- `configs/morpheus_model_management/images/` — Model portrait images
