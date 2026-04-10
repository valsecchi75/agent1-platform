import { describe, it, expect } from 'vitest';
import { getUserStoragePaths, getNextFilename, ensureUserDirectories } from '../fileNaming';
import { existsSync } from 'fs';

describe('fileNaming multi-user', () => {
  const testUserId = 'test-user-multiuser-123';

  it('getUserStoragePaths returns correct user-scoped structure', () => {
    const paths = getUserStoragePaths(testUserId);
    expect(paths.root).toContain(`users/${testUserId}`);
    expect(paths.images).toContain(`users/${testUserId}/output/images`);
    expect(paths.videos).toContain(`users/${testUserId}/output/videos`);
    expect(paths.audio).toContain(`users/${testUserId}/output/audio`);
    expect(paths.input).toContain(`users/${testUserId}/input`);
    expect(paths.workflows).toContain(`users/${testUserId}/workflows`);
    expect(paths.session).toContain(`users/${testUserId}/workflows/__session`);
  });

  it('getNextFilename with userId uses user-scoped path', () => {
    ensureUserDirectories(testUserId);
    const result = getNextFilename('image', 'jpg', testUserId);
    expect(result.fullPath).toContain(`users/${testUserId}/output/images`);
    expect(result.publicUrl).toContain(`users/${testUserId}`);
  });

  it('getNextFilename without userId uses legacy path', () => {
    const result = getNextFilename('image', 'jpg');
    expect(result.publicUrl).not.toContain('users/');
  });
});
