// Field validators for the lead-capture form.
//
// MMX-575 v2: extended with ``validateField`` dispatch + strictness-aware
// ``validatePhone`` that respects the admin's per-field ``phone_options``.
// Returns ``null`` on success, an error string on failure (the form
// surfaces it inline). Empty values are tolerated when the field is
// optional — required-ness is checked at the boundary.

import type { CountryEntry } from './country-data';
import type { LeadCaptureField, PhoneFieldOptions, PhoneValidationMode } from '../../config/types';

export function validateEmail(email: string): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email address';
  return null;
}

export function validateName(name: string): string | null {
  if (name.trim().length === 0) return 'Please enter a value';
  return null;
}

export function validateNumber(val: string): string | null {
  const trimmed = val.trim();
  if (!/^\d+$/.test(trimmed)) return 'Please enter digits only';
  return null;
}

/**
 * Phone validation, strictness-aware. ``country`` is the visitor's currently
 * selected country (already gated to ``phone_options.allowed_countries``).
 *
 * Modes:
 *   - ``strict`` (default): digit count must fall between the country's
 *     ``minLen`` and ``maxLen``.
 *   - ``loose``: digit count must be 5-15 (generic E.164 range).
 *   - ``none``: no validation; any non-empty string passes.
 */
export function validatePhone(
  rawPhone: string,
  country: CountryEntry,
  mode: PhoneValidationMode = 'strict',
): string | null {
  const digits = stripPhoneDigits(rawPhone);

  // Visitors sometimes paste +CC-prefixed numbers; strip the dial digits
  // before length-checking so a US number entered as "+15551234567" still
  // measures as 10, not 11.
  const dialDigits = country.dial.replace(/\D/g, '');
  let normalizedDigits = digits;
  if (digits.indexOf(dialDigits) === 0 && digits.length > dialDigits.length) {
    const stripped = digits.substring(dialDigits.length);
    if (stripped.length >= (country.minLen ?? 5)) {
      normalizedDigits = stripped;
    }
  }

  if (mode === 'none') return null;

  if (mode === 'loose') {
    if (normalizedDigits.length < 5 || normalizedDigits.length > 15) {
      return 'Please enter a valid phone number';
    }
    return null;
  }

  // strict
  if (normalizedDigits.length < country.minLen) {
    return `Please enter a valid ${country.name} phone number`;
  }
  if (normalizedDigits.length > country.maxLen) {
    return `Please enter a valid ${country.name} phone number`;
  }
  return null;
}

/**
 * Dispatch a field value to the right validator based on ``field.type``.
 * Returns an error string or ``null`` if valid.
 *
 * ``selectedCountry`` is required only when ``field.type === 'phone'``.
 */
export function validateField(
  field: LeadCaptureField,
  value: string,
  selectedCountry?: CountryEntry,
): string | null {
  const empty = value.trim().length === 0;
  if (empty) {
    return field.required ? 'This field is required' : null;
  }
  switch (field.type) {
    case 'email':
      return validateEmail(value);
    case 'phone':
      if (!selectedCountry) return null;
      return validatePhone(value, selectedCountry, field.phone_options?.validation ?? 'strict');
    case 'number':
      return validateNumber(value);
    case 'text':
    default:
      return validateName(value);
  }
}

export function stripPhoneDigits(val: string): string {
  return val.replace(/\D/g, '');
}

/**
 * E.164 normalization — strips local formatting, optionally drops a
 * redundant leading dial-code prefix the visitor might have re-typed,
 * and re-prepends the canonical dial code.
 */
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

/**
 * Helper for callers that only have a ``PhoneFieldOptions`` object —
 * gates incoming ISO against the allowed list and falls back to the
 * default. Never throws.
 */
export function resolveSelectedCountryIso(
  opt: PhoneFieldOptions | undefined,
  preferred?: string | null,
): string {
  if (!opt) return preferred || 'US';
  if (preferred && opt.allowed_countries.includes(preferred)) return preferred;
  return opt.default_country;
}
