import { Router } from "express";
import { createWallet, getWalletById } from "../services/wallet";
import { AppError, asErrorMessage } from "../utils/errors";

const walletTypes = new Set(["merchant", "supplier", "platform"]);

export const walletsRouter = Router();

walletsRouter.post("/create", async (req, res) => {
  try {
    const { type, ownerId } = req.body as {
      type?: string;
      ownerId?: string;
    };

    if (!type || !ownerId) {
      throw new AppError("type and ownerId are required", 400);
    }

    if (!walletTypes.has(type)) {
      throw new AppError("type must be merchant | supplier | platform", 400);
    }

    const wallet = await createWallet(type as "merchant" | "supplier" | "platform", ownerId);

    return res.status(201).json({
      walletId: wallet.walletId,
      publicKey: wallet.publicKey,
    });
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return res.status(statusCode).json({
      error: asErrorMessage(error),
    });
  }
});

walletsRouter.get("/:id", async (req, res) => {
  try {
    const wallet = await getWalletById(req.params.id);
    return res.json(wallet);
  } catch (error) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    return res.status(statusCode).json({
      error: asErrorMessage(error),
    });
  }
});
