export type WalletType = "merchant" | "supplier" | "platform";

export interface WalletRecord {
  id: string;
  public_key: string;
  encrypted_secret: string;
  type: WalletType;
  owner_id: string;
  created_at: Date;
}

export interface PublicWallet {
  walletId: string;
  publicKey: string;
  type: WalletType;
  ownerId: string;
}
