import { describe, it, expect } from 'vitest';
import { isAppVersionCompatible } from '../appVersion';

describe('isAppVersionCompatible', () => {
  it('returns true when app version meets minimum', () => {
    expect(isAppVersionCompatible('0.9.7-alpha', '0.9.7-alpha')).toBe(true);
  });

  it('returns true when app version exceeds minimum', () => {
    expect(isAppVersionCompatible('0.9.8-alpha', '0.9.7-alpha')).toBe(true);
  });

  it('returns false when app version is below minimum', () => {
    expect(isAppVersionCompatible('0.9.6-alpha', '0.9.7-alpha')).toBe(false);
  });

  it('returns true when no minAppVersion specified', () => {
    expect(isAppVersionCompatible('0.9.7-alpha', undefined)).toBe(true);
  });

  it('handles stable vs prerelease correctly', () => {
    expect(isAppVersionCompatible('0.9.7', '0.9.7-alpha')).toBe(true);
  });
});
