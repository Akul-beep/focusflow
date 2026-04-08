/** Preset grade/program values for onboarding and Settings (student path). */

export const STUDENT_GRADE_OPTION_VALUES: string[] = [
  ...Array.from({ length: 10 }, (_, i) => `Grade ${i + 1}`),
  ...[1, 2, 3, 4, 5].map((n) => `IB MYP ${n}`),
  'IB DP',
];

export const STUDENT_GRADE_CUSTOM = '__custom__';
