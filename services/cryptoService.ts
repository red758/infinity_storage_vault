
const ITERATIONS = 100000;
const KEY_LEN = 256;

async function deriveKey(pin: string, salt: Uint8Array) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

async function compress(data: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Response(data).body?.pipeThrough(new CompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

async function decompress(data: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Response(data).body?.pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

export async function encryptFile(data: ArrayBuffer, pin: string) {
  const compressed = await compress(data);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    compressed
  );

  return { encryptedData, iv, salt, compressedSize: encryptedData.byteLength };
}

export async function decryptFile(encryptedData: ArrayBuffer, pin: string, iv: Uint8Array, salt: Uint8Array) {
  try {
    const key = await deriveKey(pin, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    return await decompress(decrypted);
  } catch (e) {
    throw new Error('Verification failed');
  }
}
