/**
 * Quickstart template types.
 *
 * The legacy preset templates (SAMPLE_IMAGES, PRESET_TEMPLATES, etc.)
 * were removed — the app now uses the remote registry via TemplateExplorerView.
 * Only the ContentLevel type is retained as it's used by the RAG pipeline.
 */

export type ContentLevel = "empty" | "minimal" | "full";
