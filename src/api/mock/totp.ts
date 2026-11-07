// RFC 6238 TOTP with WebCrypto, so the demo backend checks real authenticator codes the way the
// server will: 30-second steps, SHA-1, six digits, one step of clock drift either side.

let ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function randomSecret(length = 32) {
  let bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}

function base32Decode(secret: string) {
  let bits = "";
  for (let char of secret.replace(/=+$/, "").toUpperCase()) {
    let value = ALPHABET.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  let bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return bytes;
}

async function codeAt(secret: string, step: number) {
  let key = await crypto.subtle.importKey("raw", base32Decode(secret), {name: "HMAC", hash: "SHA-1"}, false, ["sign"]);
  let counter = new ArrayBuffer(8);
  new DataView(counter).setUint32(4, step);
  let mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  let offset = mac[mac.length - 1] & 0xf;
  let binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

export async function verifyTotp(secret: string, code: string) {
  let step = Math.floor(Date.now() / 30000);
  for (let drift of [-1, 0, 1]) if ((await codeAt(secret, step + drift)) === code) return true;
  return false;
}

export async function sha256(text: string) {
  let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
