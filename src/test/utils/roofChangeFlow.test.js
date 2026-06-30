import { describe, expect, it } from 'vitest';
import {
  ROOF_CHANGE_TYPES,
  ROOF_CHANGE_OPTIONS,
  canContinueSolarAssessment,
  isLoftConversion,
  isQualifyingRoofChangeType,
} from '../../utils/roofChangeFlow';

describe('roofChangeFlow', () => {
  it('exposes three options with two qualifying and one disqualifying', () => {
    expect(ROOF_CHANGE_OPTIONS).toHaveLength(3);
    expect(ROOF_CHANGE_OPTIONS.filter((o) => o.qualifying)).toHaveLength(2);
    expect(ROOF_CHANGE_OPTIONS.filter((o) => !o.qualifying)).toHaveLength(1);
    expect(ROOF_CHANGE_OPTIONS.find((o) => !o.qualifying)?.id).toBe(
      ROOF_CHANGE_TYPES.LOFT_CONVERSION
    );
  });

  it('identifies qualifying types', () => {
    expect(isQualifyingRoofChangeType(ROOF_CHANGE_TYPES.HOUSE_EXTENSION)).toBe(true);
    expect(isQualifyingRoofChangeType(ROOF_CHANGE_TYPES.ROOF_REPAIRS)).toBe(true);
    expect(isQualifyingRoofChangeType(ROOF_CHANGE_TYPES.LOFT_CONVERSION)).toBe(false);
    expect(isQualifyingRoofChangeType(null)).toBe(false);
  });

  it('identifies loft conversion', () => {
    expect(isLoftConversion(ROOF_CHANGE_TYPES.LOFT_CONVERSION)).toBe(true);
    expect(isLoftConversion(ROOF_CHANGE_TYPES.HOUSE_EXTENSION)).toBe(false);
  });

  it('blocks Continue until imagery is answered and segments are selected', () => {
    expect(
      canContinueSolarAssessment({ imageryWarningAnswered: false, selectedSegmentsCount: 2 })
    ).toBe(false);
    expect(
      canContinueSolarAssessment({ imageryWarningAnswered: true, selectedSegmentsCount: 0 })
    ).toBe(false);
    expect(
      canContinueSolarAssessment({ imageryWarningAnswered: true, selectedSegmentsCount: 1 })
    ).toBe(true);
  });
});
