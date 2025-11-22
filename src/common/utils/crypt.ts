import { AES, enc } from 'crypto-js';

export const encryptAndEncode = (data: string, secretKey: string) => {
  const encrypted = AES.encrypt(data, secretKey).toString();
  return encodeURIComponent(encrypted);
};

export const decodeAndDecrypt = (cipherText: string, secretKey: string) => {
  const decodedCipherText = decodeURIComponent(cipherText);
  const bytes = AES.decrypt(decodedCipherText, secretKey);
  return bytes.toString(enc.Utf8);
};
