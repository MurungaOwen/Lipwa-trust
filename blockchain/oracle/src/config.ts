import dotenv from "dotenv";
import { Networks } from "@stellar/stellar-sdk";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[CONFIG] Missing required env var: ${name}`);
  }
  return value;
}

const stellarNetwork = process.env.STELLAR_NETWORK ?? "testnet";
const networkPassphrase =
  stellarNetwork === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

export const config = {
  stellarNetwork,
  networkPassphrase,
  sorobanRpcUrl: required("SOROBAN_RPC_URL"),
  horizonUrl: required("HORIZON_URL"),
  friendbotUrl: process.env.FRIENDBOT_URL ?? "https://friendbot.stellar.org",
  platformSecretKey: required("PLATFORM_SECRET_KEY"),
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.PORT ?? "3001"),
  walletEncryptionKey:
    process.env.WALLET_ENCRYPTION_KEY ?? required("PLATFORM_SECRET_KEY"),
  contractWasmPath: process.env.CONTRACT_WASM_PATH,
  kesxTokenContractId: process.env.KESX_TOKEN_CONTRACT_ID,
  inventoryContractId: process.env.INVENTORY_CONTRACT_ID,
};
