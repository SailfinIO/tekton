// src/utils/__mocks__/PemUtils.ts

import { PemType } from '../../enums';
import { PemFormatError, PemConversionError } from '../../errors';

// Mock implementation for PemUtils class with static methods
export class PemUtils {
  static isValidPem = jest.fn((pem: string, type: PemType) => {
    const pemRegex = new RegExp(
      `-----BEGIN ${type}-----[\\s\\S]+-----END ${type}-----`,
      'i',
    );
    return pemRegex.test(pem);
  });

  static bufferToPem = jest.fn((buffer: Buffer, type: PemType) => {
    const base64Data = buffer.toString('base64');
    return `-----BEGIN ${type}-----\n${base64Data}\n-----END ${type}-----`;
  });

  static pemToBuffer = jest.fn((pem: string, type: PemType) => {
    const base64Data = pem
      .replace(`-----BEGIN ${type}-----`, '')
      .replace(`-----END ${type}-----`, '')
      .replace(/\n/g, '');
    if (!PemUtils.isValidPem(pem, type)) {
      throw new PemFormatError(`Invalid PEM format for type: ${type}`);
    }
    return Buffer.from(base64Data, 'base64');
  });

  static isValidBase64 = jest.fn((data: string) => {
    const sanitizedStr = data.replace(/\s+/g, '');
    const base64Regex =
      /^(?:[A-Z0-9+\/]{4})*(?:[A-Z0-9+\/]{2}==|[A-Z0-9+\/]{3}=)?$/i;
    return base64Regex.test(sanitizedStr);
  });

  static extractBase64FromPem = jest.fn((pem: string, type: PemType) => {
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
  });

  static formatBase64 = jest.fn((base64: string) => {
    return base64.match(/.{1,64}/g)?.join('\n') || '';
  });
}
