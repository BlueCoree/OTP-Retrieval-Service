import { extractOtps } from './extract-otp';
import { describe, expect, it } from '@jest/globals';

describe('extractOtps', () => {
  it('extracts a code next to a keyword', () => {
    expect(extractOtps('Your verification code is 482913. It expires in 5 minutes.'))
      .toBe('482913');
  });

  it('works with Indonesian wording', () => {
    expect(extractOtps('Kode OTP Anda adalah 731905')).toBe('731905');
  });

  it('ignores numbers without a keyword nearby', () => {
    expect(extractOtps('Welcome to 2026! Your order #123456 shipped.')).toBeNull();
  });

  it('returns null when there is no digit sequence', () => {
    expect(extractOtps('Hello, no code in this email.')).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(extractOtps('')).toBeNull();
  });

  it('ignores codes that are too short or too long', () => {
    expect(extractOtps('Your code is 12')).toBeNull();
    expect(extractOtps('Your code is 123456789')).toBeNull();
  });
});