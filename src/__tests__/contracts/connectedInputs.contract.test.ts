/**
 * getSourceOutput contract test — verifies registry migration preserves
 * identical behavior for all node types.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllNodeSpecs, nodeSpecRegistry } from '@/lib/nodes';

beforeAll(() => {
  registerAllNodeSpecs();
});

// Simulate the registry-driven extraction logic (mirrors the migrated getSourceOutput)
function extractFromSpec(
  nodeType: string,
  data: Record<string, unknown>,
  sourceHandle?: string | null
): { type: string; value: unknown } | null {
  const spec = nodeSpecRegistry.getSpec(nodeType);
  if (!spec || spec.outputs.length === 0) return null;

  const outputSpec = (sourceHandle
    ? spec.outputs.find(o => o.handleId === sourceHandle)
    : undefined
  ) ?? spec.outputs[0];

  if (!outputSpec) return null;

  const value = outputSpec.extractFrom
    ? (data[outputSpec.extractFrom] as unknown) ?? null
    : null;

  return { type: outputSpec.dataType, value };
}

describe('getSourceOutput registry path — node type extraction', () => {
  it('annotation extracts outputImage with type image', () => {
    const result = extractFromSpec('annotation', { outputImage: 'data:image/png;base64,abc' });
    expect(result?.type).toBe('image');
    expect(result?.value).toBe('data:image/png;base64,abc');
  });

  it('nanoBanana extracts outputImage with type image', () => {
    const result = extractFromSpec('nanoBanana', { outputImage: 'data:image/png;test' });
    expect(result?.type).toBe('image');
    expect(result?.value).toBe('data:image/png;test');
  });

  it('generate3d extracts output3dUrl with type 3d', () => {
    const result = extractFromSpec('generate3d', { output3dUrl: 'https://example.com/model.glb' });
    expect(result?.type).toBe('3d');
    expect(result?.value).toBe('https://example.com/model.glb');
  });

  it('generateVideo extracts outputVideo with type video', () => {
    const result = extractFromSpec('generateVideo', { outputVideo: 'data:video/mp4;test' });
    expect(result?.type).toBe('video');
    expect(result?.value).toBe('data:video/mp4;test');
  });

  it('generateAudio extracts outputAudio with type audio', () => {
    const result = extractFromSpec('generateAudio', { outputAudio: 'data:audio/mp3;test' });
    expect(result?.type).toBe('audio');
    expect(result?.value).toBe('data:audio/mp3;test');
  });

  it('videoStitch extracts outputVideo with type video', () => {
    const result = extractFromSpec('videoStitch', { outputVideo: 'data:video/mp4;stitch' });
    expect(result?.type).toBe('video');
    expect(result?.value).toBe('data:video/mp4;stitch');
  });

  it('videoTrim extracts outputVideo with type video', () => {
    const result = extractFromSpec('videoTrim', { outputVideo: 'data:video/mp4;trim' });
    expect(result?.type).toBe('video');
  });

  it('llmGenerate extracts outputText with type text', () => {
    const result = extractFromSpec('llmGenerate', { outputText: 'Hello world' });
    expect(result?.type).toBe('text');
    expect(result?.value).toBe('Hello world');
  });

  it('videoFrameGrab extracts outputImage with type image', () => {
    const result = extractFromSpec('videoFrameGrab', { outputImage: 'data:image/png;frame' });
    expect(result?.type).toBe('image');
    expect(result?.value).toBe('data:image/png;frame');
  });

  it('glbViewer extracts capturedImage with type image', () => {
    const result = extractFromSpec('glbViewer', { capturedImage: 'data:image/png;glb' });
    expect(result?.type).toBe('image');
    expect(result?.value).toBe('data:image/png;glb');
  });

  it('previewImage extracts image with type image', () => {
    const result = extractFromSpec('previewImage', { image: 'data:image/png;preview' });
    expect(result?.type).toBe('image');
    expect(result?.value).toBe('data:image/png;preview');
  });

  it('returns null value when extractFrom field is not in data', () => {
    const result = extractFromSpec('nanoBanana', { outputImage: null });
    expect(result?.value).toBeNull();
  });

  it('morpheusModelManagement primary output is image type', () => {
    const spec = nodeSpecRegistry.getSpec('morpheusModelManagement');
    const primaryOutput = spec?.outputs[0];
    expect(primaryOutput?.dataType).toBe('image');
    expect(primaryOutput?.extractFrom).toBe('outputImage');
  });

  it('morpheusModelManagement has description output handle', () => {
    const spec = nodeSpecRegistry.getSpec('morpheusModelManagement');
    const descOutput = spec?.outputs.find(o => o.handleId === 'description');
    expect(descOutput).toBeDefined();
    expect(descOutput?.dataType).toBe('text');
    expect(descOutput?.extractFrom).toBe('outputDescription');
  });
});
