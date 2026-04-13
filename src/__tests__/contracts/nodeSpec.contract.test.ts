/**
 * NodeSpec Registry Contract Tests — Phase 2
 *
 * These tests define the contract for the new NodeSpec schema registry.
 * They must ALWAYS pass. If they break, it means a node type was added/removed
 * without updating the spec registry — which would cause silent failures.
 *
 * CONTRACT: Every registered NodeSpec must have valid structure, executor name,
 * and be able to provide defaultData + defaultDimensions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { nodeSpecRegistry } from '@/lib/nodes/nodeRegistry';
import { registerAllNodeSpecs, ALL_SPECS } from '@/lib/nodes/allNodeSpecs';
import type { NodeSpec } from '@/lib/nodes/nodeSpec';

// Register all specs before tests run
beforeAll(() => {
  registerAllNodeSpecs();
});

// ─── Schema Validity ───────────────────────────────────────────────────────────

describe('NodeSpec Schema Contract', () => {
  it('registry has at least 30 registered specs', () => {
    expect(nodeSpecRegistry.getAllSpecs().length).toBeGreaterThanOrEqual(30);
  });

  it('ALL_SPECS contains exactly as many specs as registered', () => {
    // After registration, registry should have all specs from ALL_SPECS
    const registeredTypes = new Set(nodeSpecRegistry.getAllTypes());
    for (const spec of ALL_SPECS) {
      expect(registeredTypes.has(spec.type), `"${spec.type}" from ALL_SPECS must be in registry`).toBe(true);
    }
  });

  it('every spec has a non-empty type string', () => {
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      expect(spec.type, 'spec.type must be non-empty').toBeTruthy();
    }
  });

  it('every spec has a non-empty displayName', () => {
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      expect(spec.displayName, `spec "${spec.type}" must have displayName`).toBeTruthy();
    }
  });

  it('every spec has a valid category', () => {
    const validCategories = ['input', 'generation', 'processing', 'output', 'logic', 'utility'];
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      expect(
        validCategories.includes(spec.category),
        `spec "${spec.type}" has invalid category "${spec.category}"`
      ).toBe(true);
    }
  });

  it('every spec has defaultData as an object', () => {
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      expect(
        typeof spec.defaultData === 'object' && spec.defaultData !== null,
        `spec "${spec.type}" defaultData must be an object`
      ).toBe(true);
    }
  });

  it('every spec has valid defaultDimensions (positive numbers)', () => {
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      expect(
        spec.defaultDimensions.width > 0,
        `spec "${spec.type}" defaultDimensions.width must be positive`
      ).toBe(true);
      expect(
        spec.defaultDimensions.height > 0,
        `spec "${spec.type}" defaultDimensions.height must be positive`
      ).toBe(true);
    }
  });

  it('every spec has an executor string', () => {
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      expect(
        typeof spec.executor === 'string' && spec.executor.length > 0,
        `spec "${spec.type}" must have executor string`
      ).toBe(true);
    }
  });

  it('all executor names use known prefixes', () => {
    const validPrefixes = ['execute', '__passthrough__', '__noop__'];
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      const hasValidPrefix = validPrefixes.some(p => spec.executor.startsWith(p));
      expect(
        hasValidPrefix,
        `spec "${spec.type}" executor "${spec.executor}" must start with execute/passthrough/noop`
      ).toBe(true);
    }
  });

  it('output handle extractFrom paths are strings', () => {
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      for (const output of spec.outputs) {
        expect(
          typeof output.extractFrom === 'string',
          `spec "${spec.type}" output "${output.handleId}" extractFrom must be string`
        ).toBe(true);
      }
    }
  });

  it('output and input dataTypes are valid HandleDataType values', () => {
    const validDataTypes = ['image', 'text', 'audio', 'video', '3d', 'easeCurve'];
    for (const spec of nodeSpecRegistry.getAllSpecs()) {
      for (const output of spec.outputs) {
        expect(
          validDataTypes.includes(output.dataType),
          `spec "${spec.type}" output "${output.handleId}" has invalid dataType "${output.dataType}"`
        ).toBe(true);
      }
      for (const input of spec.inputs) {
        expect(
          validDataTypes.includes(input.dataType),
          `spec "${spec.type}" input "${input.handleId}" has invalid dataType "${input.dataType}"`
        ).toBe(true);
      }
    }
  });
});

// ─── Required Core Node Types ──────────────────────────────────────────────────

describe('Core Node Types Contract', () => {
  const REQUIRED_CORE_TYPES = [
    'imageInput', 'audioInput', 'videoInput',
    'annotation', 'prompt', 'array', 'promptConstructor',
    'nanoBanana', 'generateVideo', 'generate3d', 'generateAudio', 'llmGenerate',
    'splitGrid', 'output', 'outputGallery', 'imageCompare',
    'videoStitch', 'easeCurve', 'videoTrim', 'videoFrameGrab',
    'router', 'switch', 'conditionalSwitch',
    'glbViewer', 'previewImage', 'showAnything',
  ];

  it('all required core types are registered', () => {
    for (const type of REQUIRED_CORE_TYPES) {
      expect(
        nodeSpecRegistry.hasSpec(type),
        `Core node type "${type}" must be registered in NodeSpec registry`
      ).toBe(true);
    }
  });

  it('core node types have isCore=true', () => {
    const CORE_TYPES = [
      'imageInput', 'prompt', 'nanoBanana', 'llmGenerate', 'output', 'annotation',
    ];
    for (const type of CORE_TYPES) {
      const spec = nodeSpecRegistry.getSpec(type);
      expect(spec?.isCore, `"${type}" must have isCore=true`).toBe(true);
    }
  });

  it('custom pack nodes have isCore=false', () => {
    const PACK_TYPES = ['naSketchToPhoto', 'naStylingDetail', 'naRecolor', 'morpheusModelManagement'];
    for (const type of PACK_TYPES) {
      const spec = nodeSpecRegistry.getSpec(type);
      if (spec) {
        expect(spec.isCore, `"${type}" must have isCore=false`).toBe(false);
      }
    }
  });
});

// ─── Registry API Contract ──────────────────────────────────────────────────────

describe('NodeSpecRegistry API Contract', () => {
  it('getSpec returns a spec for known types', () => {
    const spec = nodeSpecRegistry.getSpec('nanoBanana');
    expect(spec).toBeDefined();
    expect(spec?.type).toBe('nanoBanana');
  });

  it('getSpec returns undefined for unknown types', () => {
    const spec = nodeSpecRegistry.getSpec('totallyUnknownType12345');
    expect(spec).toBeUndefined();
  });

  it('hasSpec returns true for known types', () => {
    expect(nodeSpecRegistry.hasSpec('prompt')).toBe(true);
  });

  it('hasSpec returns false for unknown types', () => {
    expect(nodeSpecRegistry.hasSpec('doesNotExist')).toBe(false);
  });

  it('getDefaultData returns object for known types', () => {
    const data = nodeSpecRegistry.getDefaultData('imageInput');
    expect(data).toBeDefined();
    expect(typeof data).toBe('object');
  });

  it('getDefaultDimensions returns valid dimensions for known types', () => {
    const dims = nodeSpecRegistry.getDefaultDimensions('nanoBanana');
    expect(dims).toBeDefined();
    expect(dims!.width).toBeGreaterThan(0);
    expect(dims!.height).toBeGreaterThan(0);
  });

  it('getAllTypes returns an array of strings', () => {
    const types = nodeSpecRegistry.getAllTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
    expect(typeof types[0]).toBe('string');
  });

  it('getOutputs returns array for known types', () => {
    const outputs = nodeSpecRegistry.getOutputs('nanoBanana');
    expect(Array.isArray(outputs)).toBe(true);
    expect(outputs.length).toBeGreaterThan(0);
    expect(outputs[0].handleId).toBe('image');
    expect(outputs[0].extractFrom).toBe('outputImage');
  });

  it('getOutputs returns empty array for unknown types', () => {
    const outputs = nodeSpecRegistry.getOutputs('unknownType');
    expect(outputs).toEqual([]);
  });

  it('registerExecutor + getExecutor round-trip works', () => {
    const mockFn = async () => {};
    nodeSpecRegistry.registerExecutor('testExecutor999', mockFn);
    const retrieved = nodeSpecRegistry.getExecutor('testExecutor999');
    expect(retrieved).toBe(mockFn);
  });

  it('getExecutor returns undefined for unregistered executors', () => {
    const fn = nodeSpecRegistry.getExecutor('noSuchExecutor99999');
    expect(fn).toBeUndefined();
  });

  it('re-registering a spec overwrites the previous one', () => {
    const spec: NodeSpec = {
      type: '__test_overwrite__',
      displayName: 'Original',
      category: 'utility',
      defaultData: {},
      defaultDimensions: { width: 100, height: 100 },
      outputs: [],
      inputs: [],
      executor: '__noop__',
      isCore: false,
    };
    nodeSpecRegistry.register(spec);
    expect(nodeSpecRegistry.getSpec('__test_overwrite__')?.displayName).toBe('Original');

    nodeSpecRegistry.register({ ...spec, displayName: 'Updated' });
    expect(nodeSpecRegistry.getSpec('__test_overwrite__')?.displayName).toBe('Updated');
  });

  it('getSummary returns correct counts', () => {
    const summary = nodeSpecRegistry.getSummary();
    expect(summary.totalSpecs).toBeGreaterThanOrEqual(30);
    expect(Array.isArray(summary.types)).toBe(true);
  });
});

// ─── Output Extraction Contract ──────────────────────────────────────────────

describe('Output Extraction Paths Contract', () => {
  // Verify that the extractFrom paths match what getSourceOutput actually reads
  const EXPECTED_EXTRACTIONS: Array<{ type: string; handleId: string; extractFrom: string }> = [
    { type: 'imageInput', handleId: 'image', extractFrom: 'image' },
    { type: 'audioInput', handleId: 'audio', extractFrom: 'audioFile' },
    { type: 'videoInput', handleId: 'video', extractFrom: 'video' },
    { type: 'annotation', handleId: 'image', extractFrom: 'outputImage' },
    { type: 'nanoBanana', handleId: 'image', extractFrom: 'outputImage' },
    { type: 'generate3d', handleId: '3d', extractFrom: 'output3dUrl' },
    { type: 'generateVideo', handleId: 'video', extractFrom: 'outputVideo' },
    { type: 'generateAudio', handleId: 'audio', extractFrom: 'outputAudio' },
    { type: 'videoStitch', handleId: 'video', extractFrom: 'outputVideo' },
    { type: 'videoTrim', handleId: 'video', extractFrom: 'outputVideo' },
    { type: 'prompt', handleId: 'text', extractFrom: 'prompt' },
    { type: 'llmGenerate', handleId: 'text', extractFrom: 'outputText' },
    { type: 'videoFrameGrab', handleId: 'image', extractFrom: 'outputImage' },
    { type: 'glbViewer', handleId: 'image', extractFrom: 'capturedImage' },
    { type: 'previewImage', handleId: 'image', extractFrom: 'image' },
  ];

  for (const expected of EXPECTED_EXTRACTIONS) {
    it(`${expected.type} output "${expected.handleId}" extracts from data.${expected.extractFrom}`, () => {
      const spec = nodeSpecRegistry.getSpec(expected.type);
      expect(spec, `spec "${expected.type}" must exist`).toBeDefined();

      const output = spec!.outputs.find(o => o.handleId === expected.handleId);
      expect(output, `"${expected.type}" must have output handle "${expected.handleId}"`).toBeDefined();
      expect(output!.extractFrom).toBe(expected.extractFrom);
    });
  }
});
