# AGENT 1 — From Vision to Form

Open-source, API-driven node-based platform for creative generation. Build visual pipelines connecting AI models for image, video, 3D, audio, and LLM workflows.

## Quick Start

**Windows:** Double-click `start.bat`
**macOS/Linux:** Run `./start.sh`

The app opens at `http://localhost:3000`. On first launch, dependencies are installed automatically and the database is created fresh.

This is a clean install: no pre-existing generations, workflows, or user data. The app auto-checks for updates from GitHub and notifies you when a new version is available.

## Requirements

- Node.js 18+
- API keys (configured via Settings panel in the app)

## Supported AI Models

- **Google Gemini** — Text analysis, prompt compilation
- **Nano Banana 2 / Pro** — Image generation
- **Veo 3.1** — Video generation
- **Additional providers** — fal.ai, Replicate, WaveSpeed, Kie (configurable)

## Configuration

API keys can be set via the Settings panel (key icon in header) or directly in the `.env` file.
