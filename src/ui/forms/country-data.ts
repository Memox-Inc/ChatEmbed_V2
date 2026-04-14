export interface CountryEntry {
  code: string;
  dial: string;
  flag: string;
  name: string;
  minLen: number;
  maxLen: number;
}

export const COUNTRY_CODES: CountryEntry[] = [
  { code: 'US', dial: '+1', flag: '\uD83C\uDDFA\uD83C\uDDF8', name: 'United States', minLen: 10, maxLen: 10 },
  { code: 'CA', dial: '+1', flag: '\uD83C\uDDE8\uD83C\uDDE6', name: 'Canada', minLen: 10, maxLen: 10 },
  { code: 'GB', dial: '+44', flag: '\uD83C\uDDEC\uD83C\uDDE7', name: 'United Kingdom', minLen: 10, maxLen: 10 },
  { code: 'AU', dial: '+61', flag: '\uD83C\uDDE6\uD83C\uDDFA', name: 'Australia', minLen: 9, maxLen: 9 },
  { code: 'DE', dial: '+49', flag: '\uD83C\uDDE9\uD83C\uDDEA', name: 'Germany', minLen: 10, maxLen: 11 },
  { code: 'FR', dial: '+33', flag: '\uD83C\uDDEB\uD83C\uDDF7', name: 'France', minLen: 9, maxLen: 9 },
  { code: 'IN', dial: '+91', flag: '\uD83C\uDDEE\uD83C\uDDF3', name: 'India', minLen: 10, maxLen: 10 },
  { code: 'PK', dial: '+92', flag: '\uD83C\uDDF5\uD83C\uDDF0', name: 'Pakistan', minLen: 10, maxLen: 10 },
  { code: 'MX', dial: '+52', flag: '\uD83C\uDDF2\uD83C\uDDFD', name: 'Mexico', minLen: 10, maxLen: 10 },
  { code: 'BR', dial: '+55', flag: '\uD83C\uDDE7\uD83C\uDDF7', name: 'Brazil', minLen: 10, maxLen: 11 },
  { code: 'IT', dial: '+39', flag: '\uD83C\uDDEE\uD83C\uDDF9', name: 'Italy', minLen: 9, maxLen: 10 },
  { code: 'ES', dial: '+34', flag: '\uD83C\uDDEA\uD83C\uDDF8', name: 'Spain', minLen: 9, maxLen: 9 },
  { code: 'NL', dial: '+31', flag: '\uD83C\uDDF3\uD83C\uDDF1', name: 'Netherlands', minLen: 9, maxLen: 9 },
  { code: 'AE', dial: '+971', flag: '\uD83C\uDDE6\uD83C\uDDEA', name: 'UAE', minLen: 9, maxLen: 9 },
  { code: 'SA', dial: '+966', flag: '\uD83C\uDDF8\uD83C\uDDE6', name: 'Saudi Arabia', minLen: 9, maxLen: 9 },
  { code: 'JP', dial: '+81', flag: '\uD83C\uDDEF\uD83C\uDDF5', name: 'Japan', minLen: 10, maxLen: 10 },
  { code: 'KR', dial: '+82', flag: '\uD83C\uDDF0\uD83C\uDDF7', name: 'South Korea', minLen: 10, maxLen: 11 },
  { code: 'SG', dial: '+65', flag: '\uD83C\uDDF8\uD83C\uDDEC', name: 'Singapore', minLen: 8, maxLen: 8 },
  { code: 'CH', dial: '+41', flag: '\uD83C\uDDE8\uD83C\uDDED', name: 'Switzerland', minLen: 9, maxLen: 9 },
  { code: 'SE', dial: '+46', flag: '\uD83C\uDDF8\uD83C\uDDEA', name: 'Sweden', minLen: 9, maxLen: 10 },
];
