import {
  BASE_FEE,
  Horizon,
  Keypair,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { config } from "../config";
import { AppError } from "../utils/errors";

export const sorobanRpc = new rpc.Server(config.sorobanRpcUrl, {
  allowHttp: config.sorobanRpcUrl.startsWith("http://"),
});

export const horizon = new Horizon.Server(config.horizonUrl, {
  allowHttp: config.horizonUrl.startsWith("http://"),
});

export async function buildTransaction(
  sourcePublicKey: string,
  operations: any[],
  timeoutSeconds = 60,
): Promise<any> {
  const sourceAccount = await sorobanRpc.getAccount(sourcePublicKey);

  let txBuilder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  });

  operations.forEach((operation) => {
    txBuilder = txBuilder.addOperation(operation);
  });

  const tx = txBuilder.setTimeout(timeoutSeconds).build();
  return sorobanRpc.prepareTransaction(tx);
}

export async function signAndSubmit(
  tx: any,
  signerSecret: string,
): Promise<{ txHash: string; status: string; result: any }> {
  const signer = Keypair.fromSecret(signerSecret);
  tx.sign(signer);

  const sendResult = await sorobanRpc.sendTransaction(tx);
  const txHash = tx.hash().toString("hex");

  if (sendResult.status === "ERROR") {
    throw new AppError(
      `[STELLAR] Transaction failed: ${JSON.stringify(sendResult.errorResult)}`,
      500,
    );
  }

  const confirmation = await waitForConfirmation(txHash);

  return {
    txHash,
    status: confirmation.status,
    result: confirmation,
  };
}

export async function waitForConfirmation(
  txHash: string,
  maxAttempts = 30,
  intervalMs = 1500,
): Promise<any> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const tx = await sorobanRpc.getTransaction(txHash);

    if (tx.status === "SUCCESS") {
      return tx;
    }

    if (tx.status === "FAILED") {
      throw new AppError(`[STELLAR] Transaction failed on-chain: ${txHash}`, 500);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new AppError(
    `[STELLAR] Transaction confirmation timeout: ${txHash}`,
    504,
  );
}

export async function fundWithFriendbot(publicKey: string): Promise<void> {
  if (config.stellarNetwork !== "testnet") {
    throw new AppError("Friendbot is available only on testnet", 400);
  }

  const url = `${config.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new AppError(`[STELLAR] Friendbot failed: ${body}`, 500);
  }
}

export function keypairFromSecret(secret: string): Keypair {
  return Keypair.fromSecret(secret);
}
