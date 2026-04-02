import { describe, it, expect } from 'vitest';
import { normalizeLocationKey } from './normalize-location.js';

describe('normalizeLocationKey', () => {
  it('strips two-letter state abbreviation', () => {
    expect(normalizeLocationKey('Austin, TX')).toBe('austin');
  });

  it('strips full state name', () => {
    expect(normalizeLocationKey('Austin, Texas')).toBe('austin');
  });

  it('strips state + country', () => {
    expect(normalizeLocationKey('Austin, Texas, United States')).toBe('austin');
  });

  it('strips state abbreviation + USA', () => {
    expect(normalizeLocationKey('Portland, OR, USA')).toBe('portland');
  });

  it('strips state abbreviation + United States of America', () => {
    expect(normalizeLocationKey('Miami, FL, United States of America')).toBe('miami');
  });

  it('handles multi-word city names', () => {
    expect(normalizeLocationKey('Carmel By The Sea, CA')).toBe('carmel by the sea');
  });

  it('handles multi-word city with full state', () => {
    expect(normalizeLocationKey('Carmel By The Sea, California, United States')).toBe(
      'carmel by the sea',
    );
  });

  it('handles New York correctly', () => {
    expect(normalizeLocationKey('New York, NY')).toBe('new york');
  });

  it('handles New Mexico state name without stripping city', () => {
    expect(normalizeLocationKey('Santa Fe, New Mexico')).toBe('santa fe');
  });

  it('handles West Virginia', () => {
    expect(normalizeLocationKey('Charleston, West Virginia')).toBe('charleston');
  });

  it('strips Canada', () => {
    expect(normalizeLocationKey('Vancouver, Canada')).toBe('vancouver');
  });

  it('leaves non-US international locations unchanged', () => {
    expect(normalizeLocationKey('Paris, France')).toBe('paris, france');
  });

  it('strips county designation', () => {
    expect(normalizeLocationKey('Nashville, Davidson County')).toBe('nashville');
  });

  it('lowercases the result', () => {
    expect(normalizeLocationKey('Key West, FL')).toBe('key west');
  });

  it('handles extra whitespace', () => {
    expect(normalizeLocationKey('  Sedona ,  AZ  ')).toBe('sedona');
  });

  it('produces the same key for equivalent inputs', () => {
    const variants = [
      'Austin, TX',
      'Austin, Texas',
      'Austin, Texas, United States',
      'Austin, Texas, USA',
    ];
    const keys = variants.map(normalizeLocationKey);
    expect(new Set(keys).size).toBe(1);
  });

  it('produces the same key for Key West variants', () => {
    const variants = [
      'Key West',
      'Key West, FL',
      'Key West, Florida',
      'Key West, Florida, US',
    ];
    const keys = variants.map(normalizeLocationKey);
    expect(new Set(keys).size).toBe(1);
  });
});
