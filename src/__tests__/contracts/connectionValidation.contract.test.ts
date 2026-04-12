import { describe, it, expect, beforeAll } from 'vitest';
import { registerAllNodeSpecs } from '@/lib/nodes';
import { validateConnectionWithSpec } from '@/utils/connectionValidation';

beforeAll(() => {
  registerAllNodeSpecs();
});

function makeConn(sourceHandle: string | null, targetHandle: string | null) {
  return { source: 's', target: 't', sourceHandle, targetHandle };
}
function makeNode(id: string, type: string, data: Record<string, unknown> = {}) {
  return { id, type, data };
}

describe('validateConnectionWithSpec Contract', () => {
  it('image→image: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('image', 'image'),
      makeNode('s', 'nanoBanana'),
      makeNode('t', 'output')
    )).toBe(true);
  });

  it('text→text: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('text', 'text'),
      makeNode('s', 'prompt'),
      makeNode('t', 'nanoBanana')
    )).toBe(true);
  });

  it('image→text: blocked', () => {
    expect(validateConnectionWithSpec(
      makeConn('image', 'text'),
      makeNode('s', 'imageInput'),
      makeNode('t', 'prompt')
    )).toBe(false);
  });

  it('video→generateVideo: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('video', 'video'),
      makeNode('s', 'generateVideo'),
      makeNode('t', 'generateVideo')
    )).toBe(true);
  });

  it('video→nanoBanana: blocked (not in allowed targets)', () => {
    expect(validateConnectionWithSpec(
      makeConn('video', 'image'),
      makeNode('s', 'generateVideo'),
      makeNode('t', 'nanoBanana')
    )).toBe(false);
  });

  it('video→output: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('video', 'image'),
      makeNode('s', 'generateVideo'),
      makeNode('t', 'output')
    )).toBe(true);
  });

  it('video→router: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('video', 'video'),
      makeNode('s', 'generateVideo'),
      makeNode('t', 'router')
    )).toBe(true);
  });

  it('3d→3d: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('3d', '3d'),
      makeNode('s', 'generate3d'),
      makeNode('t', 'glbViewer')
    )).toBe(true);
  });

  it('3d→image: blocked', () => {
    expect(validateConnectionWithSpec(
      makeConn('3d', 'image'),
      makeNode('s', 'generate3d'),
      makeNode('t', 'nanoBanana')
    )).toBe(false);
  });

  it('audio→output: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('audio', 'image'),
      makeNode('s', 'generateAudio'),
      makeNode('t', 'output')
    )).toBe(true);
  });

  it('audio→nanoBanana: blocked', () => {
    expect(validateConnectionWithSpec(
      makeConn('audio', 'image'),
      makeNode('s', 'generateAudio'),
      makeNode('t', 'nanoBanana')
    )).toBe(false);
  });

  it('switch→target: blocked when inputType set and mismatches', () => {
    expect(validateConnectionWithSpec(
      makeConn('some-id', 'image'),
      makeNode('s', 'switch', { inputType: 'video' }),
      makeNode('t', 'output')
    )).toBe(false);
  });

  it('switch→target: allowed when inputType matches', () => {
    expect(validateConnectionWithSpec(
      makeConn('some-id', 'image'),
      makeNode('s', 'switch', { inputType: 'image' }),
      makeNode('t', 'output')
    )).toBe(true);
  });

  it('switch input generic-input: always allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('image', 'generic-input'),
      makeNode('s', 'nanoBanana'),
      makeNode('t', 'switch')
    )).toBe(true);
  });

  it('conditionalSwitch target: only text allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('text', 'text'),
      makeNode('s', 'prompt'),
      makeNode('t', 'conditionalSwitch')
    )).toBe(true);

    expect(validateConnectionWithSpec(
      makeConn('image', 'image'),
      makeNode('s', 'imageInput'),
      makeNode('t', 'conditionalSwitch')
    )).toBe(false);
  });

  it('easeCurve→easeCurve: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('easeCurve', 'easeCurve'),
      makeNode('s', 'easeCurve'),
      makeNode('t', 'easeCurve')
    )).toBe(true);
  });

  it('easeCurve→router: allowed', () => {
    expect(validateConnectionWithSpec(
      makeConn('easeCurve', 'easeCurve'),
      makeNode('s', 'easeCurve'),
      makeNode('t', 'router')
    )).toBe(true);
  });

  it('easeCurve→nanoBanana: blocked', () => {
    expect(validateConnectionWithSpec(
      makeConn('easeCurve', 'image'),
      makeNode('s', 'easeCurve'),
      makeNode('t', 'nanoBanana')
    )).toBe(false);
  });

  it('unknown handles → allow (fallback)', () => {
    expect(validateConnectionWithSpec(
      makeConn(null, null),
      makeNode('s', 'nanoBanana'),
      makeNode('t', 'output')
    )).toBe(true);
  });
});
