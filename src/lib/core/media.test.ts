import { describe, it, expect } from 'vitest';
import {
  validateImageFile,
  MediaValidationError,
  generateMediaKey,
  getStorageKey,
  variantKey,
  sizeForWidth,
  parseStorageKey,
  IMAGE_SIZES,
  SIZE_PREFIXES,
} from './media.js';

describe('validateImageFile', () => {
  it('rejects files over 5MB', () => {
    const file = new File(['x'.repeat(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it('rejects disallowed MIME types', () => {
    const file = new File(['x'], 'bad.gif', { type: 'image/gif' });
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/type/i);
  });

  it('accepts valid JPEG', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file).valid).toBe(true);
  });

  it('accepts valid PNG', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    expect(validateImageFile(file).valid).toBe(true);
  });

  it('accepts valid WebP', () => {
    const file = new File(['x'], 'photo.webp', { type: 'image/webp' });
    expect(validateImageFile(file).valid).toBe(true);
  });

  it('respects custom maxFileSize', () => {
    const file = new File(['x'.repeat(1024 * 1024 + 1)], 'photo.jpg', { type: 'image/jpeg' });
    const result = validateImageFile(file, { maxFileSize: 1024 * 1024 });
    expect(result.valid).toBe(false);
  });

  it('carries machine-readable codes and limits for i18n mapping', () => {
    const empty = validateImageFile(new File([], 'e.jpg', { type: 'image/jpeg' }));
    expect(empty.code).toBe('empty');

    const big = validateImageFile(
      new File(['x'.repeat(1024 + 1)], 'b.jpg', { type: 'image/jpeg' }),
      { maxFileSize: 1024 },
    );
    expect(big.code).toBe('file-too-large');
    expect(big.maxBytes).toBe(1024);

    const gif = validateImageFile(new File(['x'], 'b.gif', { type: 'image/gif' }));
    expect(gif.code).toBe('invalid-type');
    expect(gif.allowedTypes).toContain('image/jpeg');
  });
});

describe('MediaValidationError', () => {
  it('exposes the failed result as typed fields', () => {
    const result = validateImageFile(
      new File(['x'.repeat(2048)], 'b.jpg', { type: 'image/jpeg' }),
      { maxFileSize: 1024 },
    );
    const err = new MediaValidationError(result);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('MediaValidationError');
    expect(err.code).toBe('file-too-large');
    expect(err.maxBytes).toBe(1024);
    expect(err.message).toMatch(/too large/i);
  });
});

describe('generateMediaKey', () => {
  it('produces a webp key', () => {
    expect(generateMediaKey()).toMatch(/\.webp$/);
  });

  it('produces unique keys', () => {
    expect(generateMediaKey()).not.toBe(generateMediaKey());
  });
});

describe('variantKey', () => {
  it('inserts the size prefix before the filename of a joined key', () => {
    expect(variantKey('schools/id-1/abc.webp', 'thumbnail')).toBe('schools/id-1/thumb_abc.webp');
    expect(variantKey('schools/id-1/abc.webp', 'original')).toBe('schools/id-1/abc.webp');
  });

  it('agrees with getStorageKey for every size', () => {
    const original = getStorageKey('tours', 't-1', 'x.webp', 'original');
    for (const size of ['original', 'thumbnail', 'medium', 'large'] as const) {
      expect(variantKey(original, size)).toBe(getStorageKey('tours', 't-1', 'x.webp', size));
    }
  });
});

describe('sizeForWidth', () => {
  it('picks the smallest variant that still fills the display width', () => {
    expect(sizeForWidth(undefined)).toBe('medium');
    expect(sizeForWidth(200)).toBe('thumbnail');
    expect(sizeForWidth(300)).toBe('thumbnail');
    expect(sizeForWidth(301)).toBe('medium');
    expect(sizeForWidth(800)).toBe('medium');
    expect(sizeForWidth(801)).toBe('large');
  });
});

describe('parseStorageKey', () => {
  it('inverts getStorageKey for original keys', () => {
    expect(parseStorageKey('schools/id-1/abc.webp')).toEqual({
      prefix: 'schools',
      entityId: 'id-1',
      filename: 'abc.webp',
    });
  });

  it('keeps multi-segment prefixes intact', () => {
    expect(parseStorageKey('a/b/id/x.webp')).toEqual({
      prefix: 'a/b',
      entityId: 'id',
      filename: 'x.webp',
    });
  });

  it('returns null for keys that do not fit the layout (legacy ids)', () => {
    expect(parseStorageKey('appwrite-file-id')).toBeNull();
    expect(parseStorageKey('only/two')).toBeNull();
  });
});

describe('SIZE_PREFIXES', () => {
  it('is the stable cross-app contract for variant naming', () => {
    expect(SIZE_PREFIXES).toEqual({
      original: '',
      thumbnail: 'thumb_',
      medium: 'med_',
      large: 'large_',
    });
  });
});

describe('getStorageKey', () => {
  it('returns correct original key', () => {
    const key = getStorageKey('tours', 'tour-123', 'abc.jpg', 'original');
    expect(key).toBe('tours/tour-123/abc.jpg');
  });

  it('returns correct thumbnail key', () => {
    const key = getStorageKey('tours', 'tour-123', 'abc.jpg', 'thumbnail');
    expect(key).toBe('tours/tour-123/thumb_abc.jpg');
  });

  it('returns correct medium key', () => {
    const key = getStorageKey('avatars', 'user-1', 'x.jpg', 'medium');
    expect(key).toBe('avatars/user-1/med_x.jpg');
  });

  it('returns correct large key', () => {
    const key = getStorageKey('tours', 'id', 'x.jpg', 'large');
    expect(key).toBe('tours/id/large_x.jpg');
  });
});

describe('IMAGE_SIZES', () => {
  it('defines thumbnail as 300x300 cover', () => {
    expect(IMAGE_SIZES.thumbnail).toEqual({ width: 300, height: 300, fit: 'cover' });
  });
  it('defines medium as 800x600 inside', () => {
    expect(IMAGE_SIZES.medium).toEqual({ width: 800, height: 600, fit: 'inside' });
  });
  it('defines large as 1200x900 inside', () => {
    expect(IMAGE_SIZES.large).toEqual({ width: 1200, height: 900, fit: 'inside' });
  });
});
