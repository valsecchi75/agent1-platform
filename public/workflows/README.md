# Workflow Templates

Drop `.json` workflow files in this folder to make them available in the Template Explorer.

## How it works

1. Create a workflow in AGENT 1
2. Save it (File → Save) — this creates a `.json` file
3. Copy the `.json` file into this `workflows/` folder
4. The workflow appears in **Templates → Community** in the app

## JSON format

Each file should have at minimum:

```json
{
  "name": "My Workflow",
  "description": "What this workflow does",
  "version": 1,
  "category": "custom",
  "tags": ["Gemini", "Image"],
  "nodes": [...],
  "edges": [...]
}
```

Optional fields: `author`, `createdAt`, `thumbnailUrl`
