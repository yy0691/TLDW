import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Use a 32-byte key for AES-256
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET 
  ? Buffer.from(process.env.API_KEY_ENCRYPTION_SECRET, 'hex')
  : randomBytes(32); // Fallback for development

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export function encryptApiKey(apiKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine iv + authTag + encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decryptApiKey(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function getApiKeyPreview(apiKey: string): string {
  if (apiKey.length <= 4) {
    return '****';
  }
  return '•'.repeat(apiKey.length - 4) + apiKey.slice(-4);
}
