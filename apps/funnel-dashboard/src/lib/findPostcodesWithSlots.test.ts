import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  findPostcodesWithSlots,
  idealPostcodeExists,
  orderOutwardsAcrossAreas,
} from './findPostcodesWithSlots';

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockIdealPostcodes(validPostcodes: Set<string>) {
  return async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('ideal-postcodes.co.uk')) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    const pc = decodeURIComponent(url.split('/postcodes/')[1]?.split('?')[0] ?? '');
    const ok = validPostcodes.has(pc.toUpperCase());
    return new Response(
      JSON.stringify(
        ok
          ? { code: 2000, message: 'Success', result: [{ postcode: pc }] }
          : { code: 4040, message: 'Postcode not found' }
      ),
      { status: ok ? 200 : 404, headers: { 'Content-Type': 'application/json' } }
    );
  };
}

describe('orderOutwardsAcrossAreas', () => {
  it('returns a permutation of all outward codes', () => {
    const input = ['BA1', 'BB1', 'M1', 'S2', 'B1'];
    const out = orderOutwardsAcrossAreas(input);
    expect(out.length).toBe(input.length);
    expect([...out].sort()).toEqual([...input].sort());
  });
});

describe('idealPostcodeExists', () => {
  it('returns true when Ideal Postcodes returns code 2000 with results', async () => {
    vi.stubGlobal(
      'fetch',
      mockIdealPostcodes(new Set(['LS29AA'])) as typeof fetch
    );
    await expect(idealPostcodeExists('ls29aa', 'test-key')).resolves.toBe(true);
  });

  it('returns false when postcode is not found', async () => {
    vi.stubGlobal(
      'fetch',
      mockIdealPostcodes(new Set(['LS29AA'])) as typeof fetch
    );
    await expect(idealPostcodeExists('LS21AA', 'test-key')).resolves.toBe(false);
  });
});

describe('findPostcodesWithSlots', () => {
  it('collects postcodes until targetN when get-availability returns slots', async () => {
    const valid = new Set(['FIRST1AA', 'SECOND1AA']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('ideal-postcodes.co.uk')) {
          return mockIdealPostcodes(valid)(input);
        }
        const pc = new URL(url).searchParams.get('postcode');
        if (pc === 'FIRST1AA' || pc === 'SECOND1AA') {
          return new Response(
            JSON.stringify({ availability: [{ date: '01-01-2030', slots: ['10:00'] }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ availability: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch
    );

    const { hits, requests } = await findPostcodesWithSlots({
      baseUrl: 'https://example.com/functions/v1',
      apiKey: '',
      idealPostcodesApiKey: 'test-key',
      outwards: ['FIRST', 'SECOND'],
      targetN: 2,
      maxRequests: 30,
      sleepMs: 0,
      inwards: ['1AA'],
    });

    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.postcode).sort()).toEqual(['FIRST1AA', 'SECOND1AA']);
    expect(hits.every((h) => h.slots === 1 && h.days === 1)).toBe(true);
    expect(requests).toBeGreaterThanOrEqual(2);
    expect(requests).toBeLessThanOrEqual(4);
  });

  it('skips postcodes that have slots but are not real (Ideal Postcodes)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('ideal-postcodes.co.uk')) {
          return mockIdealPostcodes(new Set(['LS29AA']))(input);
        }
        const pc = new URL(url).searchParams.get('postcode')?.toUpperCase() ?? '';
        if (pc === 'LS21AA' || pc === 'LS29AA') {
          return new Response(
            JSON.stringify({ availability: [{ date: '01-01-2030', slots: ['10:00', '11:00'] }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ availability: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch
    );

    const { hits } = await findPostcodesWithSlots({
      baseUrl: 'https://example.com/functions/v1',
      apiKey: '',
      idealPostcodesApiKey: 'test-key',
      outwards: ['LS2'],
      targetN: 1,
      maxRequests: 20,
      sleepMs: 0,
      inwards: ['1AA', '9AA'],
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]!.postcode).toBe('LS29AA');
  });

  it('keeps one hit per postcode district when distinctAreasOnly (default)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('ideal-postcodes.co.uk')) {
          return mockIdealPostcodes(new Set(['B11AA', 'B21AA']))(input);
        }
        const pc = new URL(url).searchParams.get('postcode');
        if (pc === 'B11AA' || pc === 'B21AA') {
          return new Response(
            JSON.stringify({ availability: [{ date: '01-01-2030', slots: ['10:00'] }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ availability: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch
    );

    const { hits } = await findPostcodesWithSlots({
      baseUrl: 'https://example.com/functions/v1',
      apiKey: '',
      idealPostcodesApiKey: 'test-key',
      outwards: ['B1', 'B2'],
      targetN: 2,
      maxRequests: 20,
      sleepMs: 0,
      inwards: ['1AA'],
      distinctAreasOnly: true,
    });

    expect(hits).toHaveLength(1);
    expect(['B11AA', 'B21AA']).toContain(hits[0]!.postcode);
  });

  it('allows multiple hits in the same district when distinctAreasOnly is false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('ideal-postcodes.co.uk')) {
          return mockIdealPostcodes(new Set(['B11AA', 'B21AA']))(input);
        }
        const pc = new URL(url).searchParams.get('postcode');
        if (pc === 'B11AA' || pc === 'B21AA') {
          return new Response(
            JSON.stringify({ availability: [{ date: '01-01-2030', slots: ['10:00'] }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ availability: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch
    );

    const { hits } = await findPostcodesWithSlots({
      baseUrl: 'https://example.com/functions/v1',
      apiKey: '',
      idealPostcodesApiKey: 'test-key',
      outwards: ['B1', 'B2'],
      targetN: 2,
      maxRequests: 20,
      sleepMs: 0,
      inwards: ['1AA'],
      distinctAreasOnly: false,
    });

    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.postcode).sort()).toEqual(['B11AA', 'B21AA']);
  });
});
