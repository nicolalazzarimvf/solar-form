import { describe, expect, it } from 'vitest';
import {
  ROOF_CHANGE_TYPES,
  ROOF_CHANGE_OPTIONS,
  canContinueSolarAssessment,
  isDisqualifyingRoofChangeType,
  isLoftConversion,
  isOtherRoofChange,
  isQualifyingRoofChangeType,
} from '../../utils/roofChangeFlow';

describe('roofChangeFlow', () => {
  it('exposes four options with two qualifying and two disqualifying', () => {
    expect(ROOF_CHANGE_OPTIONS).toHaveLength(4);
    expect(ROOF_CHANGE_OPTIONS.filter((o) => o.qualifying)).toHaveLength(2);
    expect(ROOF_CHANGE_OPTIONS.filter((o) => !o.qualifying)).toHaveLength(2);
    expect(ROOF_CHANGE_OPTIONS.find((o) => o.id === ROOF_CHANGE_TYPES.LOFT_CONVERSION)?.qualifying).toBe(
      false
    );
    expect(ROOF_CHANGE_OPTIONS.find((o) => o.id === ROOF_CHANGE_TYPES.OTHER)?.qualifying).toBe(false);
  });

  it('identifies qualifying types', () => {
    expect(isQualifyingRoofChangeType(ROOF_CHANGE_TYPES.HOUSE_EXTENSION)).toBe(true);
    expect(isQualifyingRoofChangeType(ROOF_CHANGE_TYPES.ROOF_REPAIRS)).toBe(true);
    expect(isQualifyingRoofChangeType(ROOF_CHANGE_TYPES.LOFT_CONVERSION)).toBe(false);
    expect(isQualifyingRoofChangeType(ROOF_CHANGE_TYPES.OTHER)).toBe(false);
    expect(isQualifyingRoofChangeType(null)).toBe(false);
  });

  it('identifies disqualifying types', () => {
    expect(isLoftConversion(ROOF_CHANGE_TYPES.LOFT_CONVERSION)).toBe(true);
    expect(isOtherRoofChange(ROOF_CHANGE_TYPES.OTHER)).toBe(true);
    expect(isDisqualifyingRoofChangeType(ROOF_CHANGE_TYPES.LOFT_CONVERSION)).toBe(true);
    expect(isDisqualifyingRoofChangeType(ROOF_CHANGE_TYPES.OTHER)).toBe(true);
    expect(isDisqualifyingRoofChangeType(ROOF_CHANGE_TYPES.HOUSE_EXTENSION)).toBe(false);
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
