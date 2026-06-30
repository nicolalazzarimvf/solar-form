/** Roof change follow-up option ids (experimental imagery flow). */
export const ROOF_CHANGE_TYPES = {
  HOUSE_EXTENSION: 'house_extension',
  ROOF_REPAIRS: 'roof_repairs',
  LOFT_CONVERSION: 'loft_conversion',
};

export const ROOF_CHANGE_OPTIONS = [
  { id: ROOF_CHANGE_TYPES.HOUSE_EXTENSION, label: 'House extension', qualifying: true },
  { id: ROOF_CHANGE_TYPES.ROOF_REPAIRS, label: 'Roof repairs', qualifying: true },
  { id: ROOF_CHANGE_TYPES.LOFT_CONVERSION, label: 'Loft conversion', qualifying: false },
];

export function isQualifyingRoofChangeType(type) {
  return (
    type === ROOF_CHANGE_TYPES.HOUSE_EXTENSION || type === ROOF_CHANGE_TYPES.ROOF_REPAIRS
  );
}

export function isLoftConversion(type) {
  return type === ROOF_CHANGE_TYPES.LOFT_CONVERSION;
}

/** Continue is allowed only when imagery warning is fully resolved and segments are selected. */
export function canContinueSolarAssessment({ imageryWarningAnswered, selectedSegmentsCount }) {
  return Boolean(imageryWarningAnswered) && selectedSegmentsCount > 0;
}
