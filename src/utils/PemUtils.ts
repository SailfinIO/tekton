// src/utils/PemUtils.ts

import { PemType } from '../enums';
import { PemFormatError, PemConversionError } from '../errors';

export class PemUtils {
  /**
   * Extracts the base64 content from a PEM string.
   * @param pem - The PEM-encoded string.
   * @param type - The type of PEM (e.g., CERTIFICATE, PRIVATE KEY).
   * @returns The base64-encoded string without headers and footers.
   * @throws {PemFormatError} If the PEM format is invalid.
   */
  static extractBase64FromPem(pem: string, type: PemType): string {
    // Trim leading and trailing whitespace
    pem = pem.trim();

    const regex = new RegExp(
      `-----BEGIN ${type}-----\\s*([A-Za-z0-9+/=\\s]+)\\s*-----END ${type}-----`,
      'i',
    );
    const match = pem.match(regex);
    if (!match || match[1].trim().length === 0) {
      throw new PemFormatError(`Invalid PEM format for type: ${type}`);
    }
    return match[1].replace(/[\r\n\s]/g, '');
  }
  /**
   * Converts a PEM string to a Buffer.
   * @param pem - The PEM-encoded string.
   * @param type - The type of PEM (e.g., CERTIFICATE, PRIVATE KEY).
   * @returns A Buffer containing the binary data.
   * @throws {PemFormatError} If the PEM format is invalid.
   */
  static pemToBuffer(pem: string, type: PemType): Buffer {
    const base64 = this.extractBase64FromPem(pem, type);
    return Buffer.from(base64, 'base64');
  }

  /**
   * Validates if a string is a valid PEM format for the specified type.
   * @param pem - The PEM-encoded string.
   * @param type - The type of PEM (e.g., CERTIFICATE, PRIVATE KEY).
   * @returns Boolean indicating validity.
   */
  static isValidPem(pem: string, type: PemType): boolean {
    const regex = new RegExp(
      `-----BEGIN ${type}-----[\\s\\S]+-----END ${type}-----`,
      'i',
    );
    return regex.test(pem);
  }

  /**
   * Validates if a string is a valid base64 format.
   * @param str - The string to validate.
   * @returns Boolean indicating validity.
   */
  static isValidBase64(str: string): boolean {
    // Remove all whitespace for validation
    const sanitizedStr = str.replace(/\s+/g, '');
    // Base64 regex pattern
    const base64Regex =
      /^(?:[A-Z0-9+\/]{4})*(?:[A-Z0-9+\/]{2}==|[A-Z0-9+\/]{3}=)?$/i;
    return base64Regex.test(sanitizedStr);
  }

  /**
   * Converts a Buffer to a PEM string.
   * @param buffer - The Buffer containing the binary data.
   * @param type - The type of PEM (e.g., CERTIFICATE, PRIVATE KEY).
   * @returns The PEM-encoded string.
   * @throws {PemConversionError} If conversion fails.
   */
  static bufferToPem(buffer: Buffer, type: PemType): string {
    if (!Buffer.isBuffer(buffer)) {
      throw new PemConversionError('Input is not a Buffer.');
    }

    if (buffer.length === 0) {
      throw new PemConversionError('Buffer is empty.');
    }

    const base64 = buffer.toString('base64');
    if (!this.isValidBase64(base64)) {
      throw new PemConversionError(
        'Buffer does not contain valid base64 data.',
      );
    }

    const header = `-----BEGIN ${type}-----\n`;
    const footer = `\n-----END ${type}-----\n`;
    return header + this.formatBase64(base64) + footer;
  }

  /**
   * Formats a base64 string to a PEM format with line breaks every 64 characters.
   * @param base64 - The base64-encoded string.
   * @returns The formatted string.
   */
  private static formatBase64(base64: string): string {
    return base64.match(/.{1,64}/g)?.join('\n') || '';
  }
}
