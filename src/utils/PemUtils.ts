// src/utils/PemUtils.ts

export class PemUtils {
  /**
   * Extracts the base64 content from a PEM string.
   * @param pem - The PEM-encoded string.
   * @param type - The type of PEM (e.g., CERTIFICATE, PRIVATE KEY).
   * @returns The base64-encoded string without headers and footers.
   */
  static extractBase64FromPem(pem: string, type: string): string {
    const regex = new RegExp(
      `-----BEGIN ${type}-----(.*?)-----END ${type}-----`,
      's',
    );
    const match = pem.match(regex);
    if (!match || match.length < 2) {
      throw new Error(`Invalid PEM format for type: ${type}`);
    }
    return match[1].replace(/[\r\n]/g, '').trim();
  }

  /**
   * Converts a PEM string to a Buffer.
   * @param pem - The PEM-encoded string.
   * @param type - The type of PEM (e.g., CERTIFICATE, PRIVATE KEY).
   * @returns A Buffer containing the binary data.
   */
  static pemToBuffer(pem: string, type: string): Buffer {
    const base64 = this.extractBase64FromPem(pem, type);
    return Buffer.from(base64, 'base64');
  }

  /**
   * Validates if a string is a valid PEM format for the specified type.
   * @param pem - The PEM-encoded string.
   * @param type - The type of PEM (e.g., CERTIFICATE, PRIVATE KEY).
   * @returns Boolean indicating validity.
   */
  static isValidPem(pem: string, type: string): boolean {
    const regex = new RegExp(
      `-----BEGIN ${type}-----[\\s\\S]+-----END ${type}-----`,
    );
    return regex.test(pem);
  }
}
