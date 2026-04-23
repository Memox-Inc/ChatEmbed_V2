import type { CountryEntry } from './country-data';

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email address';
  return null;
}

export function validateName(name: string): string | null {
  if (!name) return 'Full name is required';
  return null;
}

export function validatePhone(
  rawPhone: string,
  country: CountryEntry,
): string | null {
  const digits = stripPhoneDigits(rawPhone);
  const dialDigits = country.dial.replace(/\D/g, '');

  let normalizedDigits = digits;
  if (digits.indexOf(dialDigits) === 0 && digits.length > dialDigits.length) {
    const stripped = digits.substring(dialDigits.length);
    if (stripped.length >= country.minLen) {
      normalizedDigits = stripped;
    }
  }

  if (!rawPhone) return 'Phone number is required';
  if (normalizedDigits.length < country.minLen)
    return `Phone number is too short for ${country.name}`;
  if (normalizedDigits.length > country.maxLen)
    return `Phone number is too long for ${country.name}`;
  return null;
}

export function validateZip(zip: string): string | null {
  if (!zip) return 'Zip code is required';
  if (!/^\d+$/.test(zip)) return 'Zip code must contain only numbers';
  if (zip.length < 4) return 'Zip code must be at least 4 digits';
  if (zip.length > 10) return 'Zip code must be 10 digits or less';
  return null;
}

export function stripPhoneDigits(val: string): string {
  return val.replace(/\D/g, '');
}

export function normalizePhoneE164(localNumber: string, dialCode: string): string {
  let digits = localNumber.replace(/\D/g, '');
  const dialDigits = dialCode.replace(/\D/g, '');
  if (digits.length > 0 && digits.indexOf(dialDigits) === 0 && digits.length > dialDigits.length) {
    const withoutDial = digits.substring(dialDigits.length);
    if (withoutDial.length >= 7) {
      digits = withoutDial;
    }
  }
  return dialCode + digits;
}
