// Country metadata for the embed phone-input.
//
// Mirrors the backend's PHONE_COUNTRIES list (embed_app/constants.py).
// The two stay in sync because the widget's per-country validation
// (min/max digit length) and the dashboard's chip-picker both read
// from this same list — admins curate by ISO code, visitors get the
// curated subset.
//
// MMX-575 v2: list expanded from ~20 to the 66 production countries.

export interface CountryEntry {
  code: string;    // ISO 3166-1 alpha-2
  dial: string;    // dial code, leading "+"
  flag: string;    // unicode flag emoji
  name: string;    // English country name
  minLen: number;  // shortest valid national number (digits only)
  maxLen: number;  // longest valid national number (digits only)
}

export const COUNTRY_CODES: CountryEntry[] = [
  { code: 'AE', dial: '+971', flag: '\u{1F1E6}\u{1F1EA}', name: 'United Arab Emirates', minLen: 9,  maxLen: 9 },
  { code: 'AR', dial: '+54',  flag: '\u{1F1E6}\u{1F1F7}', name: 'Argentina',           minLen: 10, maxLen: 11 },
  { code: 'AT', dial: '+43',  flag: '\u{1F1E6}\u{1F1F9}', name: 'Austria',             minLen: 10, maxLen: 13 },
  { code: 'AU', dial: '+61',  flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia',           minLen: 9,  maxLen: 9 },
  { code: 'BD', dial: '+880', flag: '\u{1F1E7}\u{1F1E9}', name: 'Bangladesh',          minLen: 10, maxLen: 10 },
  { code: 'BE', dial: '+32',  flag: '\u{1F1E7}\u{1F1EA}', name: 'Belgium',             minLen: 9,  maxLen: 9 },
  { code: 'BG', dial: '+359', flag: '\u{1F1E7}\u{1F1EC}', name: 'Bulgaria',            minLen: 9,  maxLen: 9 },
  { code: 'BR', dial: '+55',  flag: '\u{1F1E7}\u{1F1F7}', name: 'Brazil',              minLen: 10, maxLen: 11 },
  { code: 'CA', dial: '+1',   flag: '\u{1F1E8}\u{1F1E6}', name: 'Canada',              minLen: 10, maxLen: 10 },
  { code: 'CH', dial: '+41',  flag: '\u{1F1E8}\u{1F1ED}', name: 'Switzerland',         minLen: 9,  maxLen: 9 },
  { code: 'CL', dial: '+56',  flag: '\u{1F1E8}\u{1F1F1}', name: 'Chile',               minLen: 9,  maxLen: 9 },
  { code: 'CN', dial: '+86',  flag: '\u{1F1E8}\u{1F1F3}', name: 'China',               minLen: 11, maxLen: 11 },
  { code: 'CO', dial: '+57',  flag: '\u{1F1E8}\u{1F1F4}', name: 'Colombia',            minLen: 10, maxLen: 10 },
  { code: 'CZ', dial: '+420', flag: '\u{1F1E8}\u{1F1FF}', name: 'Czechia',             minLen: 9,  maxLen: 9 },
  { code: 'DE', dial: '+49',  flag: '\u{1F1E9}\u{1F1EA}', name: 'Germany',             minLen: 10, maxLen: 11 },
  { code: 'DK', dial: '+45',  flag: '\u{1F1E9}\u{1F1F0}', name: 'Denmark',             minLen: 8,  maxLen: 8 },
  { code: 'EE', dial: '+372', flag: '\u{1F1EA}\u{1F1EA}', name: 'Estonia',             minLen: 7,  maxLen: 8 },
  { code: 'EG', dial: '+20',  flag: '\u{1F1EA}\u{1F1EC}', name: 'Egypt',               minLen: 10, maxLen: 10 },
  { code: 'ES', dial: '+34',  flag: '\u{1F1EA}\u{1F1F8}', name: 'Spain',               minLen: 9,  maxLen: 9 },
  { code: 'FI', dial: '+358', flag: '\u{1F1EB}\u{1F1EE}', name: 'Finland',             minLen: 9,  maxLen: 10 },
  { code: 'FR', dial: '+33',  flag: '\u{1F1EB}\u{1F1F7}', name: 'France',              minLen: 9,  maxLen: 9 },
  { code: 'GB', dial: '+44',  flag: '\u{1F1EC}\u{1F1E7}', name: 'United Kingdom',      minLen: 10, maxLen: 10 },
  { code: 'GR', dial: '+30',  flag: '\u{1F1EC}\u{1F1F7}', name: 'Greece',              minLen: 10, maxLen: 10 },
  { code: 'HK', dial: '+852', flag: '\u{1F1ED}\u{1F1F0}', name: 'Hong Kong',           minLen: 8,  maxLen: 8 },
  { code: 'HR', dial: '+385', flag: '\u{1F1ED}\u{1F1F7}', name: 'Croatia',             minLen: 8,  maxLen: 9 },
  { code: 'HU', dial: '+36',  flag: '\u{1F1ED}\u{1F1FA}', name: 'Hungary',             minLen: 8,  maxLen: 9 },
  { code: 'ID', dial: '+62',  flag: '\u{1F1EE}\u{1F1E9}', name: 'Indonesia',           minLen: 9,  maxLen: 12 },
  { code: 'IE', dial: '+353', flag: '\u{1F1EE}\u{1F1EA}', name: 'Ireland',             minLen: 9,  maxLen: 9 },
  { code: 'IL', dial: '+972', flag: '\u{1F1EE}\u{1F1F1}', name: 'Israel',              minLen: 9,  maxLen: 9 },
  { code: 'IN', dial: '+91',  flag: '\u{1F1EE}\u{1F1F3}', name: 'India',               minLen: 10, maxLen: 10 },
  { code: 'IT', dial: '+39',  flag: '\u{1F1EE}\u{1F1F9}', name: 'Italy',               minLen: 9,  maxLen: 10 },
  { code: 'JP', dial: '+81',  flag: '\u{1F1EF}\u{1F1F5}', name: 'Japan',               minLen: 10, maxLen: 11 },
  { code: 'KE', dial: '+254', flag: '\u{1F1F0}\u{1F1EA}', name: 'Kenya',               minLen: 9,  maxLen: 9 },
  { code: 'KR', dial: '+82',  flag: '\u{1F1F0}\u{1F1F7}', name: 'South Korea',         minLen: 10, maxLen: 11 },
  { code: 'KW', dial: '+965', flag: '\u{1F1F0}\u{1F1FC}', name: 'Kuwait',              minLen: 8,  maxLen: 8 },
  { code: 'LT', dial: '+370', flag: '\u{1F1F1}\u{1F1F9}', name: 'Lithuania',           minLen: 8,  maxLen: 8 },
  { code: 'LU', dial: '+352', flag: '\u{1F1F1}\u{1F1FA}', name: 'Luxembourg',          minLen: 9,  maxLen: 9 },
  { code: 'LV', dial: '+371', flag: '\u{1F1F1}\u{1F1FB}', name: 'Latvia',              minLen: 8,  maxLen: 8 },
  { code: 'MA', dial: '+212', flag: '\u{1F1F2}\u{1F1E6}', name: 'Morocco',             minLen: 9,  maxLen: 9 },
  { code: 'MX', dial: '+52',  flag: '\u{1F1F2}\u{1F1FD}', name: 'Mexico',              minLen: 10, maxLen: 10 },
  { code: 'MY', dial: '+60',  flag: '\u{1F1F2}\u{1F1FE}', name: 'Malaysia',            minLen: 9,  maxLen: 10 },
  { code: 'NG', dial: '+234', flag: '\u{1F1F3}\u{1F1EC}', name: 'Nigeria',             minLen: 10, maxLen: 10 },
  { code: 'NL', dial: '+31',  flag: '\u{1F1F3}\u{1F1F1}', name: 'Netherlands',         minLen: 9,  maxLen: 9 },
  { code: 'NO', dial: '+47',  flag: '\u{1F1F3}\u{1F1F4}', name: 'Norway',              minLen: 8,  maxLen: 8 },
  { code: 'NZ', dial: '+64',  flag: '\u{1F1F3}\u{1F1FF}', name: 'New Zealand',         minLen: 8,  maxLen: 10 },
  { code: 'PE', dial: '+51',  flag: '\u{1F1F5}\u{1F1EA}', name: 'Peru',                minLen: 9,  maxLen: 9 },
  { code: 'PH', dial: '+63',  flag: '\u{1F1F5}\u{1F1ED}', name: 'Philippines',         minLen: 10, maxLen: 10 },
  { code: 'PK', dial: '+92',  flag: '\u{1F1F5}\u{1F1F0}', name: 'Pakistan',            minLen: 10, maxLen: 10 },
  { code: 'PL', dial: '+48',  flag: '\u{1F1F5}\u{1F1F1}', name: 'Poland',              minLen: 9,  maxLen: 9 },
  { code: 'PT', dial: '+351', flag: '\u{1F1F5}\u{1F1F9}', name: 'Portugal',            minLen: 9,  maxLen: 9 },
  { code: 'QA', dial: '+974', flag: '\u{1F1F6}\u{1F1E6}', name: 'Qatar',               minLen: 8,  maxLen: 8 },
  { code: 'RO', dial: '+40',  flag: '\u{1F1F7}\u{1F1F4}', name: 'Romania',             minLen: 9,  maxLen: 9 },
  { code: 'RS', dial: '+381', flag: '\u{1F1F7}\u{1F1F8}', name: 'Serbia',              minLen: 8,  maxLen: 9 },
  { code: 'RU', dial: '+7',   flag: '\u{1F1F7}\u{1F1FA}', name: 'Russia',              minLen: 10, maxLen: 10 },
  { code: 'SA', dial: '+966', flag: '\u{1F1F8}\u{1F1E6}', name: 'Saudi Arabia',        minLen: 9,  maxLen: 9 },
  { code: 'SE', dial: '+46',  flag: '\u{1F1F8}\u{1F1EA}', name: 'Sweden',              minLen: 9,  maxLen: 10 },
  { code: 'SG', dial: '+65',  flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapore',           minLen: 8,  maxLen: 8 },
  { code: 'SI', dial: '+386', flag: '\u{1F1F8}\u{1F1EE}', name: 'Slovenia',            minLen: 8,  maxLen: 8 },
  { code: 'SK', dial: '+421', flag: '\u{1F1F8}\u{1F1F0}', name: 'Slovakia',            minLen: 9,  maxLen: 9 },
  { code: 'TH', dial: '+66',  flag: '\u{1F1F9}\u{1F1ED}', name: 'Thailand',            minLen: 9,  maxLen: 9 },
  { code: 'TR', dial: '+90',  flag: '\u{1F1F9}\u{1F1F7}', name: 'Turkey',              minLen: 10, maxLen: 10 },
  { code: 'TW', dial: '+886', flag: '\u{1F1F9}\u{1F1FC}', name: 'Taiwan',              minLen: 9,  maxLen: 9 },
  { code: 'UA', dial: '+380', flag: '\u{1F1FA}\u{1F1E6}', name: 'Ukraine',             minLen: 9,  maxLen: 9 },
  { code: 'US', dial: '+1',   flag: '\u{1F1FA}\u{1F1F8}', name: 'United States',       minLen: 10, maxLen: 10 },
  { code: 'UY', dial: '+598', flag: '\u{1F1FA}\u{1F1FE}', name: 'Uruguay',             minLen: 8,  maxLen: 9 },
  { code: 'VE', dial: '+58',  flag: '\u{1F1FB}\u{1F1EA}', name: 'Venezuela',           minLen: 10, maxLen: 10 },
  { code: 'VN', dial: '+84',  flag: '\u{1F1FB}\u{1F1F3}', name: 'Vietnam',             minLen: 9,  maxLen: 10 },
  { code: 'ZA', dial: '+27',  flag: '\u{1F1FF}\u{1F1E6}', name: 'South Africa',        minLen: 9,  maxLen: 9 },
];

const _byCode = new Map(COUNTRY_CODES.map(c => [c.code, c]));

/**
 * Look up a country entry by ISO alpha-2 code. Returns undefined if the
 * code isn't in our table — callers should fall back to their default.
 */
export function countryByCode(iso: string): CountryEntry | undefined {
  return _byCode.get(iso);
}

/**
 * Filter the master list to just the admin-curated subset. Order in the
 * input array is preserved (so the admin's preferred order — first picked
 * = suggested default — can flow through to the visitor's picker UI).
 */
export function pickCountries(allowedIsos: readonly string[]): CountryEntry[] {
  return allowedIsos.map(iso => _byCode.get(iso)).filter((c): c is CountryEntry => !!c);
}
