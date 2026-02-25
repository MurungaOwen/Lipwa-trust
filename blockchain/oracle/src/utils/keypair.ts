import crypto from "crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { config } from "../config";

function getKeyMaterial(): Buffer {
  return crypto
    .createHash("sha256")
    .update(config.walletEncryptionKey, "utf8")
    .digest();
}

export function generateKeypair(): { publicKey: string; secretKey: string } {
  const keypair = Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKeyMaterial();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const bytes = Buffer.from(payload, "base64");
  const iv = bytes.subarray(0, 12);
  const tag = bytes.subarray(12, 28);
  const encrypted = bytes.subarray(28);

  const key = getKeyMaterial();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");

  return plain;
}
