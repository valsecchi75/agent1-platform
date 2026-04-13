import { describe, it, expect } from 'vitest';
import { validateManifest } from '../validation';

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validateManifest({
      id: 'agent1_test_pack',
      name: 'Test Pack',
      version: '1.0.0',
      author: 'Test',
      description: 'A test pack',
      category: 'test',
      isCore: false,
      removable: true,
      nodes: [
        { type: 'testNode', name: 'Test Node', category: 'test', specFile: 'specs/testNode.json' }
      ],
      dependencies: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects manifest with missing id', () => {
    const result = validateManifest({
      name: 'Test Pack',
      version: '1.0.0',
      author: 'Test',
      description: 'A test pack',
      category: 'test',
      isCore: false,
      removable: true,
      nodes: [{ type: 'testNode', name: 'Test Node', category: 'test' }],
      dependencies: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects manifest with empty nodes array', () => {
    const result = validateManifest({
      id: 'agent1_test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      description: 'Test',
      category: 'test',
      isCore: false,
      removable: true,
      nodes: [],
      dependencies: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects node type with spaces', () => {
    const result = validateManifest({
      id: 'agent1_test',
      name: 'Test',
      version: '1.0.0',
      author: 'Test',
      description: 'Test',
      category: 'test',
      isCore: false,
      removable: true,
      nodes: [{ type: 'invalid node', name: 'Bad', category: 'test' }],
      dependencies: [],
    });
    expect(result.success).toBe(false);
  });
});
