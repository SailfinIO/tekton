// src/utils/PemUtils.test.ts

import { PemUtils } from './PemUtils';
import { PemType } from '../enums';
import { PemFormatError, PemConversionError } from '../errors';

describe('PemUtils', () => {
  const validCertPem = `
  -----BEGIN CERTIFICATE-----
  MIIDdzCCAl+gAwIBAgIEbT0rKjANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  UzELMAkGA1UECAwCQ0ExDzANBgNVBAcMBlNhbkp1bmcxFDASBgNVBAoMC0V4YW1w
  bGUgQ28xEjAQBgNVBAMMCWxvY2FsaG9zdDAeFw0yMTA0MjkxMzE5MjNaFw0zMTA0
  MjcxMzE5MjNaMG8xCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEPMA0GA1UEBwwG
  U2FuSnVuZzEUMBIGA1UECgwLRXhhbXBsZSBDbzESMBAGA1UEAwwJbG9jYWxob3N0
  MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr6qwK0kO4/w+J9EhO+Lf
  7CjxGllw6GxUcMV
  -----END CERTIFICATE-----
  `;

  const invalidCertPem = `
-----BEGIN CERTIFICATE-----
InvalidBase64Data@@@
-----END CERTIFICATE-----
`;

  const validKeyPem = `
-----BEGIN PRIVATE KEY-----
  MIIDdzCCAl+gAwIBAgIEbT0rKjANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  UzELMAkGA1UECAwCQ0ExDzANBgNVBAcMBlNhbkp1bmcxFDASBgNVBAoMC0V4YW1w
  bGUgQ28xEjAQBgNVBAMMCWxvY2FsaG9zdDAeFw0yMTA0MjkxMzE5MjNaFw0zMTA0
  MjcxMzE5MjNaMG8xCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEPMA0GA1UEBwwG
  U2FuSnVuZzEUMBIGA1UECgwLRXhhbXBsZSBDbzESMBAGA1UEAwwJbG9jYWxob3N0
  MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr6qwK0kO4/w+J9EhO+Lf
  7CjxGllw6GxUcMV
-----END PRIVATE KEY-----
`;

  const rsaKeyPem = `
-----BEGIN RSA PRIVATE KEY-----
  MIIDdzCCAl+gAwIBAgIEbT0rKjANBgkqhkiG9w0BAQsFADBvMQswCQYDVQQGEwJV
  UzELMAkGA1UECAwCQ0ExDzANBgNVBAcMBlNhbkp1bmcxFDASBgNVBAoMC0V4YW1w
  bGUgQ28xEjAQBgNVBAMMCWxvY2FsaG9zdDAeFw0yMTA0MjkxMzE5MjNaFw0zMTA0
  MjcxMzE5MjNaMG8xCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTEPMA0GA1UEBwwG
  U2FuSnVuZzEUMBIGA1UECgwLRXhhbXBsZSBDbzESMBAGA1UEAwwJbG9jYWxob3N0
  MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr6qwK0kO4/w+J9EhO+Lf
  7CjxGllw6GxUcMV
-----END RSA PRIVATE KEY-----
`;

  describe('extractBase64FromPem', () => {
    it('should extract base64 content from a valid CERTIFICATE PEM', () => {
      const base64 = PemUtils.extractBase64FromPem(
        validCertPem,
        PemType.CERTIFICATE,
      );
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });

    it('should extract base64 content from a valid PRIVATE KEY PEM', () => {
      const base64 = PemUtils.extractBase64FromPem(
        validKeyPem,
        PemType.PRIVATE_KEY,
      );
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });

    it('should extract base64 content from a valid RSA PRIVATE KEY PEM', () => {
      const base64 = PemUtils.extractBase64FromPem(
        rsaKeyPem,
        PemType.RSA_PRIVATE_KEY,
      );
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });

    it('should throw an error for invalid PEM format', () => {
      expect(() => {
        PemUtils.extractBase64FromPem('No PEM here', PemType.CERTIFICATE);
      }).toThrow(PemFormatError);
      expect(() => {
        PemUtils.extractBase64FromPem(invalidCertPem, PemType.CERTIFICATE);
      }).toThrow(PemFormatError);
    });
  });

  describe('pemToBuffer', () => {
    it('should convert a valid CERTIFICATE PEM to Buffer', () => {
      const buffer = PemUtils.pemToBuffer(validCertPem, PemType.CERTIFICATE);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should convert a valid PRIVATE KEY PEM to Buffer', () => {
      const buffer = PemUtils.pemToBuffer(validKeyPem, PemType.PRIVATE_KEY);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should throw an error when converting an invalid CERTIFICATE PEM', () => {
      expect(() => {
        PemUtils.pemToBuffer('No PEM here', PemType.CERTIFICATE);
      }).toThrow(PemFormatError);
      expect(() => {
        PemUtils.pemToBuffer(invalidCertPem, PemType.CERTIFICATE);
      }).toThrow(PemFormatError);
    });
  });

  describe('isValidPem', () => {
    it('should return true for a valid CERTIFICATE PEM', () => {
      const isValid = PemUtils.isValidPem(validCertPem, PemType.CERTIFICATE);
      expect(isValid).toBe(true);
    });

    it('should return true for a structurally invalid CERTIFICATE PEM (invalid base64)', () => {
      // Since isValidPem only checks the structure, not the base64 content
      const isValid = PemUtils.isValidPem(invalidCertPem, PemType.CERTIFICATE);
      expect(isValid).toBe(true);
    });

    it('should return true for a valid PRIVATE KEY PEM', () => {
      const isValid = PemUtils.isValidPem(validKeyPem, PemType.PRIVATE_KEY);
      expect(isValid).toBe(true);
    });

    it('should return true for a valid RSA PRIVATE KEY PEM', () => {
      const isValid = PemUtils.isValidPem(rsaKeyPem, PemType.RSA_PRIVATE_KEY);
      expect(isValid).toBe(true);
    });

    it('should return false when the PEM type does not match', () => {
      const isValid = PemUtils.isValidPem(validCertPem, PemType.PRIVATE_KEY);
      expect(isValid).toBe(false);
    });

    it('should return false for a completely invalid PEM string', () => {
      const isValid = PemUtils.isValidPem(
        'Some random string',
        PemType.CERTIFICATE,
      );
      expect(isValid).toBe(false);
    });

    it('should return false for mismatched PEM type', () => {
      const isValid = PemUtils.isValidPem(
        validCertPem,
        PemType.RSA_PRIVATE_KEY,
      );
      expect(isValid).toBe(false);
    });
  });

  describe('isValidBase64', () => {
    it('should return true for valid base64 strings', () => {
      const validBase64 = 'TWFuIGlzIGRpc3Rpbmd1aXNoZWQsIG5vdCBvbmx5';
      expect(PemUtils.isValidBase64(validBase64)).toBe(true);
    });

    it('should return false for invalid base64 strings', () => {
      const invalidBase64 = 'InvalidBase64Data@@@';
      expect(PemUtils.isValidBase64(invalidBase64)).toBe(false);
    });

    it('should return true for base64 strings with whitespace', () => {
      const base64WithWhitespace = 'TWFuIGlzIGRpc3Rpbmd1aXNoZWQsIG5vdCBvbmx5\n';
      expect(PemUtils.isValidBase64(base64WithWhitespace)).toBe(true);
    });
  });

  describe('bufferToPem', () => {
    const sampleBuffer = Buffer.from('TestBufferData', 'utf-8');

    it('should convert a Buffer to a CERTIFICATE PEM', () => {
      const pem = PemUtils.bufferToPem(sampleBuffer, PemType.CERTIFICATE);
      expect(typeof pem).toBe('string');
      expect(pem.startsWith('-----BEGIN CERTIFICATE-----')).toBe(true);
      expect(pem.endsWith('-----END CERTIFICATE-----\n')).toBe(true);
    });

    it('should convert a Buffer to a PRIVATE KEY PEM', () => {
      const pem = PemUtils.bufferToPem(sampleBuffer, PemType.PRIVATE_KEY);
      expect(typeof pem).toBe('string');
      expect(pem.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
      expect(pem.endsWith('-----END PRIVATE KEY-----\n')).toBe(true);
    });

    it('should throw an error if the buffer is empty', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(() => {
        PemUtils.bufferToPem(emptyBuffer, PemType.CERTIFICATE);
      }).toThrow(PemConversionError);
      expect(() => {
        PemUtils.bufferToPem(emptyBuffer, PemType.PRIVATE_KEY);
      }).toThrow(PemConversionError);
    });

    // it('should throw an error if input is not a Buffer', () => {
    //   // @ts-ignore
    //   expect(() => {
    //     PemUtils.bufferToPem('Not a buffer', PemType.CERTIFICATE);
    //   }).toThrow(PemConversionError);
    // });

    it('should handle buffer containing non-ASCII data', () => {
      const binaryBuffer = Buffer.from([0xff, 0xee, 0xdd, 0xcc]);
      const pem = PemUtils.bufferToPem(binaryBuffer, PemType.CERTIFICATE);
      expect(pem).toContain('-----BEGIN CERTIFICATE-----');
      expect(pem).toContain('-----END CERTIFICATE-----');
    });
  });
});
