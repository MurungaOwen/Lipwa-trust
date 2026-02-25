import * as StellarSdk from "@stellar/stellar-sdk";
import { config } from "../config";
import { buildTransaction, fundWithFriendbot, signAndSubmit } from "../services/stellar";

const sdk: any = StellarSdk;
const horizon = new sdk.Horizon.Server(config.horizonUrl, {
  allowHttp: config.horizonUrl.startsWith("http://"),
});

async function submitClassicTx(sourceSecret: string, operations: any[]): Promise<string> {
  const sourceKeypair = sdk.Keypair.fromSecret(sourceSecret);
  const sourceAccount = await horizon.loadAccount(sourceKeypair.publicKey());

  let txBuilder = new sdk.TransactionBuilder(sourceAccount, {
    fee: sdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  });

  operations.forEach((op) => {
    txBuilder = txBuilder.addOperation(op);
  });

  const tx = txBuilder.setTimeout(60).build();
  tx.sign(sourceKeypair);

  const response = await horizon.submitTransaction(tx);
  return response.hash;
}

async function ensureFunded(publicKey: string): Promise<void> {
  try {
    await fundWithFriendbot(publicKey);
    console.log(`[SETUP] funded ${publicKey}`);
  } catch (error) {
    console.log(`[SETUP] friendbot skipped for ${publicKey}: ${(error as Error).message}`);
  }
}

async function createStellarAssetContract(asset: any): Promise<string | null> {
  if (typeof sdk.Operation.createStellarAssetContract !== "function") {
    return null;
  }

  const platformKeypair = sdk.Keypair.fromSecret(config.platformSecretKey);
  const tx = await buildTransaction(platformKeypair.publicKey(), [
    sdk.Operation.createStellarAssetContract({ asset }),
  ]);

  const result = await signAndSubmit(tx, config.platformSecretKey);

  const contractId =
    result.result?.createdContractId ||
    (result.result?.returnValue
      ? sdk.scValToNative(result.result.returnValue)
      : null);

  if (typeof contractId === "string") {
    return contractId;
  }

  return null;
}

async function main(): Promise<void> {
  const issuer = sdk.Keypair.random();
  const merchant = sdk.Keypair.random();
  const supplier = sdk.Keypair.random();
  const platform = sdk.Keypair.fromSecret(config.platformSecretKey);

  await ensureFunded(issuer.publicKey());
  await ensureFunded(merchant.publicKey());
  await ensureFunded(supplier.publicKey());
  await ensureFunded(platform.publicKey());

  const kesxAsset = new sdk.Asset("KESX", issuer.publicKey());

  const trustMerchantTxHash = await submitClassicTx(merchant.secret(), [
    sdk.Operation.changeTrust({
      asset: kesxAsset,
      limit: "1000000000",
    }),
  ]);

  const trustSupplierTxHash = await submitClassicTx(supplier.secret(), [
    sdk.Operation.changeTrust({
      asset: kesxAsset,
      limit: "1000000000",
    }),
  ]);

  const trustPlatformTxHash = await submitClassicTx(platform.secret(), [
    sdk.Operation.changeTrust({
      asset: kesxAsset,
      limit: "1000000000",
    }),
  ]);

  const mintToPlatformTxHash = await submitClassicTx(issuer.secret(), [
    sdk.Operation.payment({
      destination: platform.publicKey(),
      asset: kesxAsset,
      amount: "1000000",
    }),
  ]);

  const mintToMerchantTxHash = await submitClassicTx(issuer.secret(), [
    sdk.Operation.payment({
      destination: merchant.publicKey(),
      asset: kesxAsset,
      amount: "10000",
    }),
  ]);

  const mintToSupplierTxHash = await submitClassicTx(issuer.secret(), [
    sdk.Operation.payment({
      destination: supplier.publicKey(),
      asset: kesxAsset,
      amount: "10000",
    }),
  ]);

  const tokenContractId = await createStellarAssetContract(kesxAsset);

  console.log("[SETUP] Testnet setup complete");
  console.log(
    JSON.stringify(
      {
        issuer: {
          publicKey: issuer.publicKey(),
          secret: issuer.secret(),
        },
        merchant: {
          publicKey: merchant.publicKey(),
          secret: merchant.secret(),
        },
        supplier: {
          publicKey: supplier.publicKey(),
          secret: supplier.secret(),
        },
        platform: {
          publicKey: platform.publicKey(),
        },
        asset: {
          code: "KESX",
          issuer: issuer.publicKey(),
          tokenContractId,
        },
        tx: {
          trustMerchantTxHash,
          trustSupplierTxHash,
          trustPlatformTxHash,
          mintToPlatformTxHash,
          mintToMerchantTxHash,
          mintToSupplierTxHash,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[SETUP] failed", error);
  process.exit(1);
});
