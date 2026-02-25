import express from "express";
import { config } from "./config";
import { contractsRouter } from "./routes/contracts";
import { walletsRouter } from "./routes/wallets";
import { initContractTable } from "./services/contract";
import { initWalletTable } from "./services/wallet";

async function bootstrap(): Promise<void> {
  await initWalletTable();
  await initContractTable();

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "lipwa-trust-oracle" });
  });

  app.use("/wallets", walletsRouter);
  app.use("/contracts", contractsRouter);

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[ORACLE] Unhandled error", error);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(config.port, () => {
    console.log(`[ORACLE] listening on :${config.port}`);
    console.log(`[ORACLE] network=${config.stellarNetwork} rpc=${config.sorobanRpcUrl}`);
  });
}

bootstrap().catch((error) => {
  console.error("[ORACLE] bootstrap failed", error);
  process.exit(1);
});
