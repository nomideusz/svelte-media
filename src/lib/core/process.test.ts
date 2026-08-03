import { describe, it, expect } from 'vitest';
import {
  validateImageFile,
  generateMediaKey,
  getStorageKey,
  IMAGE_SIZES,
} from './process.js';

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
});

describe('generateMediaKey', () => {
  it('produces a webp key regardless of input format', () => {
    expect(generateMediaKey('photo.jpg')).toMatch(/\.webp$/);
    expect(generateMediaKey('photo.png')).toMatch(/\.webp$/);
  });

  it('produces unique keys for same filename', () => {
    const a = generateMediaKey('photo.jpg');
    const b = generateMediaKey('photo.jpg');
    expect(a).not.toBe(b);
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
