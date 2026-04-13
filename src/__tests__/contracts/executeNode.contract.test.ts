/**
 * executeNode Dispatcher Contract Tests
 *
 * These tests verify the contract for the registry-driven executeNode dispatcher
 * (Phase 2B-4 migration). Key requirements:
 *
 * 1. imageInput is a no-op (pure data source — no executor called)
 * 2. audioInput / videoInput run their inline handlers
 * 3. All registered node types have valid spec + executor mappings
 * 4. Unknown node types: warn and skip (no throw)
 * 5. __passthrough__ / __noop__ sentinels are registered correctly
 * 6. API node types have specs with non-noop executors
 *
 * Tests in group A use only the NodeSpec registry (no executor imports).
 * Tests in group B import executeNode and mock registerExecutors to avoid
 * pulling in the entire executor dependency tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nodeSpecRegistry, registerAllNodeSpecs } from '@/lib/nodes';

// ─── Mock the executor module so executeNode can be imported ─────────────────
// This prevents pulling in nanoBananaExecutor, generateVideoExecutor, etc.
// which import API route modules (fetch, node:fs, etc.) that fail in test env.

vi.mock('@/store/execution/registerExecutors', () => ({
  registerAllExecutors: vi.fn(() => {
    // Register only minimal stubs so dispatch logic can be tested
    nodeSpecRegistry.registerExecutor('__passthrough__', async () => { /* noop */ });
    nodeSpecRegistry.registerExecutor('__noop__', async () => { /* noop */ });
    nodeSpecRegistry.registerExecutor('executeNanoBanana', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeGenerateVideo', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeGenerate3D', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeGenerateAudio', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeLlmGenerate', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeAnnotation', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executePrompt', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeArray', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executePromptConstructor', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeSplitGrid', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeOutput', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeOutputGallery', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeImageCompare', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeVideoStitch', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeEaseCurve', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeVideoTrim', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeVideoFrameGrab', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeRouter', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeSwitch', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeConditionalSwitch', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeGlbViewer', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeAudioInput', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeVideoInput', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeNASketchToPhoto', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeNAStylingDetail', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeNARecolor', async () => { /* stub */ });
    nodeSpecRegistry.registerExecutor('executeMorpheusModelManagement', async () => { /* stub */ });
  }),
}));

// Mock fetch for DB logging
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: { type?: string; data?: Record<string, unknown> } = {}) {
  return {
    node: {
      id: 'test-node-1',
      type: overrides.type ?? 'nanoBanana',
      data: overrides.data ?? {},
    },
    getConnectedInputs: vi.fn().mockReturnValue({}),
    updateNodeData: vi.fn(),
    getEdges: vi.fn().mockReturnValue([]),
    getNodes: vi.fn().mockReturnValue([]),
  };
}

// ─── Group A: Pure registry tests (no executeNode import needed) ─────────────

describe('NodeSpec Registry Coverage (Phase 2B-4)', () => {
  beforeEach(() => {
    registerAllNodeSpecs();
  });

  it('all foundation node types have a registered spec', () => {
    const REQUIRED_TYPES = [
      'imageInput', 'audioInput', 'videoInput', 'annotation', 'prompt',
      'array', 'promptConstructor', 'nanoBanana', 'generateVideo', 'generate3d',
      'generateAudio', 'llmGenerate', 'splitGrid', 'output', 'outputGallery',
      'imageCompare', 'videoStitch', 'easeCurve', 'videoTrim', 'videoFrameGrab',
      'router', 'switch', 'conditionalSwitch', 'glbViewer',
    ];

    for (const type of REQUIRED_TYPES) {
      const spec = nodeSpecRegistry.getSpec(type);
      expect(spec, `NodeSpec for "${type}" must be registered`).toBeDefined();
    }
  });

  it('every spec has a non-empty executor name', () => {
    const specs = nodeSpecRegistry.getAllSpecs();
    expect(specs.length, 'Should have at least 24 specs').toBeGreaterThanOrEqual(24);

    for (const spec of specs) {
      expect(spec.executor, `spec for "${spec.type}" must have an executor name`).toBeTruthy();
    }
  });

  it('imageInput spec uses __passthrough__ sentinel', () => {
    const spec = nodeSpecRegistry.getSpec('imageInput');
    expect(spec?.executor).toBe('__passthrough__');
  });

  it('API node types use non-noop, non-passthrough executors', () => {
    const API_NODES = ['nanoBanana', 'generateVideo', 'generate3d', 'llmGenerate', 'generateAudio'];
    for (const type of API_NODES) {
      const spec = nodeSpecRegistry.getSpec(type);
      expect(spec?.executor).not.toBe('__noop__');
      expect(spec?.executor).not.toBe('__passthrough__');
      expect(spec?.executor, `API node "${type}" must have a specific executor`).toBeTruthy();
    }
  });

  it('display-only nodes use __noop__ sentinel', () => {
    // These nodes are display-only — they should never execute
    const DISPLAY_NODES = ['previewImage'];
    for (const type of DISPLAY_NODES) {
      const spec = nodeSpecRegistry.getSpec(type);
      if (spec) {
        expect(spec.executor, `display node "${type}" should use __noop__`).toBe('__noop__');
      }
    }
  });

  it('all registered specs have valid category values', () => {
    const VALID_CATEGORIES = ['input', 'generation', 'processing', 'output', 'logic', 'utility'];
    const specs = nodeSpecRegistry.getAllSpecs();
    for (const spec of specs) {
      expect(
        VALID_CATEGORIES,
        `spec "${spec.type}" has invalid category "${spec.category}"`
      ).toContain(spec.category);
    }
  });

  it('all registered specs have at least one output or input handle', () => {
    const specs = nodeSpecRegistry.getAllSpecs();
    for (const spec of specs) {
      const hasIO = spec.inputs.length > 0 || spec.outputs.length > 0;
      // Pure outputs (like `output` node) have inputs but no outputs
      // Just make sure the spec is not completely empty of IO
      expect(
        hasIO,
        `spec "${spec.type}" has neither inputs nor outputs`
      ).toBe(true);
    }
  });
});

// ─── Group B: Dispatch logic tests (mocked executor imports) ─────────────────

describe('executeNode Dispatch Logic (Phase 2B-4)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    registerAllNodeSpecs();
  });

  it('imageInput returns immediately — no updateNodeData called', async () => {
    const { executeNode } = await import('@/store/execution/executeNode');
    const ctx = makeCtx({ type: 'imageInput', data: { image: 'data:image/png;base64,abc' } });

    await executeNode(ctx as never);

    expect(ctx.updateNodeData).not.toHaveBeenCalled();
  });

  it('audioInput with upstream audio updates audioFile', async () => {
    const { executeNode } = await import('@/store/execution/executeNode');
    const ctx = makeCtx({ type: 'audioInput' });
    ctx.getConnectedInputs.mockReturnValue({ audio: ['data:audio/mp3;base64,abc123'] });

    await executeNode(ctx as never);

    expect(ctx.updateNodeData).toHaveBeenCalledWith('test-node-1', {
      audioFile: 'data:audio/mp3;base64,abc123',
    });
  });

  it('audioInput with no upstream audio does nothing', async () => {
    const { executeNode } = await import('@/store/execution/executeNode');
    const ctx = makeCtx({ type: 'audioInput' });
    ctx.getConnectedInputs.mockReturnValue({ audio: [] });

    await executeNode(ctx as never);
    expect(ctx.updateNodeData).not.toHaveBeenCalled();
  });

  it('videoInput with upstream video updates video field', async () => {
    const { executeNode } = await import('@/store/execution/executeNode');
    const ctx = makeCtx({ type: 'videoInput' });
    ctx.getConnectedInputs.mockReturnValue({ videos: ['data:video/mp4;base64,xyz'] });

    await executeNode(ctx as never);
    expect(ctx.updateNodeData).toHaveBeenCalledWith('test-node-1', { video: 'data:video/mp4;base64,xyz' });
  });

  it('unknown node type warns and does not throw', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { executeNode } = await import('@/store/execution/executeNode');
    const ctx = makeCtx({ type: 'unknownType_xyz_999' });

    await expect(executeNode(ctx as never)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknownType_xyz_999'));
    warnSpy.mockRestore();
  });

  it('accepts useStoredFallback option without crashing', async () => {
    const { executeNode } = await import('@/store/execution/executeNode');
    const ctx = makeCtx({ type: 'unknownType_opts_test' });

    await expect(
      executeNode(ctx as never, { useStoredFallback: true })
    ).resolves.toBeUndefined();
  });

  it('node with registered executor has its executor called', async () => {
    const { executeNode } = await import('@/store/execution/executeNode');

    // Create a tracked spy and register it
    const executorSpy = vi.fn().mockResolvedValue(undefined);
    nodeSpecRegistry.registerExecutor('executeNanoBanana', executorSpy as never);

    const ctx = makeCtx({ type: 'nanoBanana', data: {} });
    await executeNode(ctx as never);

    expect(executorSpy).toHaveBeenCalledWith(ctx, undefined);
  });
});
