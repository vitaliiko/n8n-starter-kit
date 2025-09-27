import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const CREDENTIALS_DIR = process.env.N8N_DEMO_CREDENTIALS_DIR ?? '/demo-data/credentials';
const LEGACY_KEY = process.env.N8N_DEMO_CREDENTIALS_KEY ?? 'super-secret-key';
const TARGET_KEY = process.env.N8N_ENCRYPTION_KEY;

if (!TARGET_KEY) {
  console.error('N8N_ENCRYPTION_KEY must be defined to import demo credentials.');
  process.exit(1);
}

const OPENSSL_MAGIC = Buffer.from('Salted__');

function deriveKeyAndIv(password, salt, keySize = 32, ivSize = 16) {
  let key = Buffer.alloc(0);
  let prev = Buffer.alloc(0);
  while (key.length < keySize + ivSize) {
    const hash = crypto.createHash('md5');
    hash.update(prev);
    hash.update(Buffer.from(password, 'utf8'));
    hash.update(salt);
    prev = hash.digest();
    key = Buffer.concat([key, prev]);
  }
  return {
    key: key.subarray(0, keySize),
    iv: key.subarray(keySize, keySize + ivSize),
  };
}

function decryptString(data, password) {
  if (typeof data !== 'string') {
    throw new Error('Credential data is not encrypted using a string payload.');
  }
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.subarray(0, OPENSSL_MAGIC.length).equals(OPENSSL_MAGIC)) {
    throw new Error('Credential data is not OpenSSL salted format.');
  }
  const salt = buffer.subarray(OPENSSL_MAGIC.length, OPENSSL_MAGIC.length + 8);
  const encrypted = buffer.subarray(OPENSSL_MAGIC.length + 8);
  const { key, iv } = deriveKeyAndIv(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(true);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function encryptString(plain, password) {
  const salt = crypto.randomBytes(8);
  const { key, iv } = deriveKeyAndIv(password, salt);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  return Buffer.concat([OPENSSL_MAGIC, salt, encrypted]).toString('base64');
}

async function rekeyFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const credential = JSON.parse(raw);

  const encryptedData = credential.data;
  if (typeof encryptedData !== 'string') {
    console.warn(`Skipping ${path.basename(filePath)} - credential data is not an encrypted string.`);
    return false;
  }

  const alreadyEncrypted = (() => {
    try {
      decryptString(encryptedData, TARGET_KEY);
      return true;
    } catch (error) {
      return false;
    }
  })();

  if (alreadyEncrypted) {
    return false;
  }

  let decrypted;
  try {
    decrypted = decryptString(encryptedData, LEGACY_KEY);
  } catch (error) {
    console.warn(`Skipping ${path.basename(filePath)} - unable to decrypt with legacy key: ${error.message}`);
    return false;
  }

  credential.data = encryptString(decrypted, TARGET_KEY);
  await fs.writeFile(filePath, `${JSON.stringify(credential, null, 2)}\n`, 'utf8');
  return true;
}

async function main() {
  let files;
  try {
    files = await fs.readdir(CREDENTIALS_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`Credentials directory not found at ${CREDENTIALS_DIR}, skipping re-key step.`);
      return;
    }
    throw error;
  }

  let updatedCount = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(CREDENTIALS_DIR, file);
    try {
      const updated = await rekeyFile(filePath);
      if (updated) {
        updatedCount += 1;
      }
    } catch (error) {
      console.warn(`Failed to re-key ${file}: ${error.message}`);
    }
  }

  if (updatedCount > 0) {
    console.log(`Re-keyed ${updatedCount} credential file(s) using the provided encryption key.`);
  } else {
    console.log('Credential files already use the provided encryption key - no changes made.');
  }
}

main().catch((error) => {
  console.error('Failed to re-key demo credentials:', error);
  process.exit(1);
});
