import { randomUUID } from "crypto";
import { Pool } from "pg";
import { config } from "../config";
import { PublicWallet, WalletRecord, WalletType } from "../models/wallet";
import { AppError } from "../utils/errors";
import { decryptSecret, encryptSecret, generateKeypair } from "../utils/keypair";
import { fundWithFriendbot } from "./stellar";

const pool = new Pool({ connectionString: config.databaseUrl });

export async function initWalletTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL UNIQUE,
      encrypted_secret TEXT NOT NULL,
      type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function mapPublicWallet(row: WalletRecord): PublicWallet {
  return {
    walletId: row.id,
    publicKey: row.public_key,
    type: row.type,
    ownerId: row.owner_id,
  };
}

export async function createWallet(
  type: WalletType,
  ownerId: string,
): Promise<PublicWallet> {
  const walletId = randomUUID();
  const { publicKey, secretKey } = generateKeypair();

  const encryptedSecret = encryptSecret(secretKey);

  await pool.query(
    `INSERT INTO wallets (id, public_key, encrypted_secret, type, owner_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [walletId, publicKey, encryptedSecret, type, ownerId],
  );

  console.log(`[WALLET] Created wallet ${walletId} (${type}) ${publicKey}`);

  await fundWithFriendbot(publicKey);

  const result = await pool.query<WalletRecord>(
    `SELECT id, public_key, encrypted_secret, type, owner_id, created_at
     FROM wallets WHERE id = $1`,
    [walletId],
  );

  return mapPublicWallet(result.rows[0]);
}

export async function getWalletById(id: string): Promise<PublicWallet> {
  const result = await pool.query<WalletRecord>(
    `SELECT id, public_key, encrypted_secret, type, owner_id, created_at
     FROM wallets WHERE id = $1`,
    [id],
  );

  if (result.rowCount === 0) {
    throw new AppError(`[WALLET] Wallet not found: ${id}`, 404);
  }

  return mapPublicWallet(result.rows[0]);
}

export async function getWalletSecret(id: string): Promise<string> {
  const result = await pool.query<WalletRecord>(
    `SELECT id, public_key, encrypted_secret, type, owner_id, created_at
     FROM wallets WHERE id = $1`,
    [id],
  );

  if (result.rowCount === 0) {
    throw new AppError(`[WALLET] Wallet not found: ${id}`, 404);
  }

  return decryptSecret(result.rows[0].encrypted_secret);
}

export async function getWalletPublicKey(id: string): Promise<string> {
  const wallet = await getWalletById(id);
  return wallet.publicKey;
}

export async function closeWalletPool(): Promise<void> {
  await pool.end();
}
