export function toBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) output[i] = binary.charCodeAt(i);

  return output;
}
