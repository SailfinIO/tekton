// src/utils/PemUtils.test.ts

import { PemUtils } from './PemUtils';

describe('PemUtils', () => {
  const validCertPem = `
-----BEGIN CERTIFICATE-----
MIIDdzCCAl+gAwIBAgIEbT...
-----END CERTIFICATE-----
`;

  const invalidCertPem = `
-----BEGIN CERTIFICATE-----
InvalidBase64Data@@@
-----END CERTIFICATE-----
`;

  const validKeyPem = `
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BA...
-----END PRIVATE KEY-----
`;

  describe('extractBase64FromPem', () => {
    it('should extract base64 content from a valid CERTIFICATE PEM', () => {
      const base64 = PemUtils.extractBase64FromPem(validCertPem, 'CERTIFICATE');
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });

    it('should throw an error for invalid PEM format', () => {
      expect(() => {
        PemUtils.extractBase64FromPem('No PEM here', 'CERTIFICATE');
      }).toThrowError('Invalid PEM format for type: CERTIFICATE');
    });
  });

  describe('pemToBuffer', () => {
    it('should convert a valid CERTIFICATE PEM to Buffer', () => {
      const buffer = PemUtils.pemToBuffer(validCertPem, 'CERTIFICATE');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should throw an error when converting an invalid PEM', () => {
      expect(() => {
        PemUtils.pemToBuffer('No PEM here', 'CERTIFICATE');
      }).toThrowError('Invalid PEM format for type: CERTIFICATE');
    });
  });

  describe('isValidPem', () => {
    it('should return true for a valid CERTIFICATE PEM', () => {
      const isValid = PemUtils.isValidPem(validCertPem, 'CERTIFICATE');
      expect(isValid).toBe(true);
    });

    it('should return true for a structurally invalid CERTIFICATE PEM (invalid base64)', () => {
      // Since isValidPem only checks the structure, not the base64 content
      const isValid = PemUtils.isValidPem(invalidCertPem, 'CERTIFICATE');
      expect(isValid).toBe(true);
    });

    it('should return true for a valid PRIVATE KEY PEM', () => {
      const isValid = PemUtils.isValidPem(validKeyPem, 'PRIVATE KEY');
      expect(isValid).toBe(true);
    });

    it('should return false when the PEM type does not match', () => {
      const isValid = PemUtils.isValidPem(validCertPem, 'PRIVATE KEY');
      expect(isValid).toBe(false);
    });

    it('should return false for a completely invalid PEM string', () => {
      const isValid = PemUtils.isValidPem('Some random string', 'CERTIFICATE');
      expect(isValid).toBe(false);
    });

    it('should correctly handle RSA PRIVATE KEY PEM', () => {
      const rsaKeyPem = `
      -----BEGIN RSA PRIVATE KEY-----
      MIIEowIBAAKCAQEA...
      -----END RSA PRIVATE KEY-----
        `;
      const base64 = PemUtils.extractBase64FromPem(
        rsaKeyPem,
        'RSA PRIVATE KEY',
      );
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });

    it('should return false for mismatched PEM type', () => {
      const isValid = PemUtils.isValidPem(validCertPem, 'RSA PRIVATE KEY');
      expect(isValid).toBe(false);
    });
  });
});
