import { describe, expect, it } from 'vitest';
import { normalizeEventTags } from './eventTags';

describe('normalizeEventTags', () => {
  it('merges client tags with ADV for experimental origin', () => {
    expect(
      normalizeEventTags(['foo'], 'https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app')
    ).toEqual(['foo', 'ADV']);
  });

  it('adds ADV for experimental origin when client sends no tags', () => {
    expect(
      normalizeEventTags(undefined, 'https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app')
    ).toEqual(['ADV']);
  });

  it('does not add ADV for production origin', () => {
    expect(normalizeEventTags(['ADV'], 'https://solar-form-eight.vercel.app')).toEqual(['ADV']);
    expect(normalizeEventTags(undefined, 'https://solar-form-eight.vercel.app')).toEqual([]);
  });

  it('deduplicates ADV when client and origin both provide it', () => {
    expect(
      normalizeEventTags(
        ['ADV'],
        'https://solar-form-git-experimental-mvfs-projects-bffd3209.vercel.app'
      )
    ).toEqual(['ADV']);
  });
});
