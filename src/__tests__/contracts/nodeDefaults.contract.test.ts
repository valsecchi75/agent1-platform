import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllNodeSpecs, nodeSpecRegistry } from '@/lib/nodes';

beforeAll(() => {
  registerAllNodeSpecs();
});

describe('createDefaultNodeData registry migration', () => {
  it('registry provides defaultData for imageInput', () => {
    const data = nodeSpecRegistry.getDefaultData('imageInput');
    expect(data).toMatchObject({
      image: null,
      filename: null,
      dimensions: null,
      isOptional: false,
    });
  });

  it('registry provides defaultData for annotation', () => {
    const data = nodeSpecRegistry.getDefaultData('annotation');
    expect(data).toMatchObject({
      sourceImage: null,
      annotations: [],
      outputImage: null,
    });
  });

  it('registry provides defaultData for prompt', () => {
    const data = nodeSpecRegistry.getDefaultData('prompt');
    expect(data).toMatchObject({ prompt: '', isOptional: false });
  });

  it('registry provides defaultData for output', () => {
    const data = nodeSpecRegistry.getDefaultData('output');
    expect(data).toMatchObject({ image: null, outputFilename: '' });
  });

  it('registry provides defaultData for splitGrid with correct structure', () => {
    const data = nodeSpecRegistry.getDefaultData('splitGrid');
    expect(data).toMatchObject({ targetCount: 6, gridRows: 2, gridCols: 3, status: 'idle' });
  });

  it('registry provides defaultData for glbViewer', () => {
    const data = nodeSpecRegistry.getDefaultData('glbViewer');
    expect(data).toMatchObject({ glbUrl: null, filename: null, capturedImage: null });
  });

  it('registry provides defaultData for videoStitch', () => {
    const data = nodeSpecRegistry.getDefaultData('videoStitch');
    expect(data).toMatchObject({ clips: [], status: 'idle', loopCount: 1 });
  });

  it('getDefaultData returns undefined for unknown type', () => {
    const data = nodeSpecRegistry.getDefaultData('__unknown_type__');
    expect(data).toBeUndefined();
  });
});
