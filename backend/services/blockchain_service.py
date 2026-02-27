from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
from sqlalchemy.orm import Session

from core.config import settings
from db.base import (
    BlockchainContractLink,
    BlockchainWallet,
    Contract,
    ContractStatus,
    Merchant,
    Supplier,
)


class BlockchainServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class BlockchainService:
    def _base_url(self) -> str:
        return settings.BLOCKCHAIN_ORACLE_URL.rstrip("/")

    def _timeout(self) -> float:
        return float(settings.BLOCKCHAIN_REQUEST_TIMEOUT_SECONDS)

    def _assert_enabled(self) -> None:
        if not settings.BLOCKCHAIN_ENABLED:
            raise BlockchainServiceError("Blockchain integration is disabled.", 503)

    @staticmethod
    def _extract_error_message(payload: Any) -> str:
        if isinstance(payload, dict):
            if isinstance(payload.get("error"), str):
                return payload["error"]
            if isinstance(payload.get("detail"), str):
                return payload["detail"]
        return "Unexpected oracle error."

    async def _request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        self._assert_enabled()
        url = f"{self._base_url()}{path}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout()) as client:
                response = await client.request(method, url, json=payload)
        except httpx.RequestError as exc:
            raise BlockchainServiceError(f"Could not reach blockchain oracle: {exc}") from exc

        if response.status_code >= 400:
            try:
                error_payload = response.json()
            except ValueError:
                error_payload = None
            error_message = self._extract_error_message(error_payload)
            raise BlockchainServiceError(
                f"Blockchain oracle request failed ({response.status_code}): {error_message}",
                502 if response.status_code >= 500 else 400,
            )

        try:
            body = response.json()
        except ValueError as exc:
            raise BlockchainServiceError("Oracle response is not valid JSON.") from exc

        if not isinstance(body, dict):
            raise BlockchainServiceError("Unexpected oracle response shape.")
        return body

    @staticmethod
    def map_oracle_status_to_contract_status(oracle_status: Optional[str]) -> Optional[ContractStatus]:
        if not oracle_status:
            return None

        mapping = {
            "Created": ContractStatus.PENDING,
            "PendingDispatch": ContractStatus.APPROVED,
            "Dispatched": ContractStatus.DISPATCHED,
            "Delivered": ContractStatus.DELIVERED,
            "Repaying": ContractStatus.DELIVERED,
            "Settled": ContractStatus.SETTLED,
            "Disputed": ContractStatus.REJECTED,
            "Cancelled": ContractStatus.REJECTED,
        }
        return mapping.get(oracle_status)

    def _get_wallet_mapping(self, db: Session, owner_type: str, owner_db_id: int) -> Optional[BlockchainWallet]:
        return (
            db.query(BlockchainWallet)
            .filter(
                BlockchainWallet.owner_type == owner_type,
                BlockchainWallet.owner_db_id == owner_db_id,
            )
            .first()
        )

    async def _ensure_wallet(self, db: Session, owner_type: str, owner_db_id: int, owner_id: str) -> BlockchainWallet:
        existing = self._get_wallet_mapping(db, owner_type=owner_type, owner_db_id=owner_db_id)
        if existing:
            return existing

        created = await self._request(
            "POST",
            "/wallets/create",
            payload={"type": owner_type, "ownerId": owner_id},
        )
        wallet_id = created.get("walletId")
        public_key = created.get("publicKey")
        if not isinstance(wallet_id, str) or not wallet_id:
            raise BlockchainServiceError("Oracle wallet response missing walletId.")

        mapping = BlockchainWallet(
            owner_type=owner_type,
            owner_db_id=owner_db_id,
            wallet_id=wallet_id,
            public_key=public_key if isinstance(public_key, str) else None,
        )
        db.add(mapping)
        db.commit()
        db.refresh(mapping)
        return mapping

    async def ensure_wallet_for_merchant(self, db: Session, merchant: Merchant) -> BlockchainWallet:
        return await self._ensure_wallet(
            db=db,
            owner_type="merchant",
            owner_db_id=merchant.id,
            owner_id=merchant.merchant_id,
        )

    async def ensure_wallet_for_supplier(self, db: Session, supplier: Supplier) -> BlockchainWallet:
        return await self._ensure_wallet(
            db=db,
            owner_type="supplier",
            owner_db_id=supplier.id,
            owner_id=supplier.supplier_id,
        )

    def _get_contract_link(self, db: Session, contract_db_id: int) -> Optional[BlockchainContractLink]:
        return (
            db.query(BlockchainContractLink)
            .filter(BlockchainContractLink.contract_db_id == contract_db_id)
            .first()
        )

    def get_contract_link_or_fail(self, db: Session, contract_db_id: int) -> BlockchainContractLink:
        link = self._get_contract_link(db, contract_db_id)
        if not link:
            raise BlockchainServiceError("No blockchain contract mapping found for this contract.", 404)
        return link

    def _upsert_contract_link(
        self,
        db: Session,
        contract_db_id: int,
        blockchain_contract_id: str,
        create_tx_hash: Optional[str] = None,
        last_tx_hash: Optional[str] = None,
        last_known_status: Optional[str] = None,
    ) -> BlockchainContractLink:
        link = self._get_contract_link(db, contract_db_id)
        if not link:
            link = BlockchainContractLink(
                contract_db_id=contract_db_id,
                blockchain_contract_id=blockchain_contract_id,
                create_tx_hash=create_tx_hash,
                last_tx_hash=last_tx_hash or create_tx_hash,
                last_known_status=last_known_status,
            )
            db.add(link)
        else:
            link.blockchain_contract_id = blockchain_contract_id
            if create_tx_hash:
                link.create_tx_hash = create_tx_hash
            if last_tx_hash:
                link.last_tx_hash = last_tx_hash
            if last_known_status:
                link.last_known_status = last_known_status

        db.commit()
        db.refresh(link)
        return link

    async def create_credit_contract(
        self,
        db: Session,
        contract_db_id: int,
        merchant: Merchant,
        supplier: Supplier,
        amount: float,
    ) -> BlockchainContractLink:
        merchant_wallet = await self.ensure_wallet_for_merchant(db, merchant)
        supplier_wallet = await self.ensure_wallet_for_supplier(db, supplier)

        created = await self._request(
            "POST",
            "/contracts/create",
            payload={
                "merchantWalletId": merchant_wallet.wallet_id,
                "supplierWalletId": supplier_wallet.wallet_id,
                "amount": amount,
                "dispatchDeadlineHours": settings.BLOCKCHAIN_DISPATCH_DEADLINE_HOURS,
            },
        )

        blockchain_contract_id = created.get("contractId")
        tx_hash = created.get("stellarTxHash")
        status = created.get("status")
        if not isinstance(blockchain_contract_id, str) or not blockchain_contract_id:
            raise BlockchainServiceError("Oracle contract response missing contractId.")

        return self._upsert_contract_link(
            db=db,
            contract_db_id=contract_db_id,
            blockchain_contract_id=blockchain_contract_id,
            create_tx_hash=tx_hash if isinstance(tx_hash, str) else None,
            last_tx_hash=tx_hash if isinstance(tx_hash, str) else None,
            last_known_status=status if isinstance(status, str) else None,
        )

    async def approve_contract(self, db: Session, contract: Contract, supplier: Supplier) -> Dict[str, Any]:
        link = self.get_contract_link_or_fail(db, contract.id)
        supplier_wallet = await self.ensure_wallet_for_supplier(db, supplier)
        approved = await self._request(
            "POST",
            f"/contracts/{link.blockchain_contract_id}/approve",
            payload={"supplierWalletId": supplier_wallet.wallet_id},
        )
        tx_hash = approved.get("txHash")
        status = approved.get("status")
        if isinstance(tx_hash, str):
            link.last_tx_hash = tx_hash
        if isinstance(status, str):
            link.last_known_status = status
        db.add(link)
        db.commit()
        db.refresh(link)
        return approved

    async def dispatch_contract(self, db: Session, contract: Contract, supplier: Supplier) -> Dict[str, Any]:
        link = self.get_contract_link_or_fail(db, contract.id)
        supplier_wallet = await self.ensure_wallet_for_supplier(db, supplier)
        result = await self._request(
            "POST",
            f"/contracts/{link.blockchain_contract_id}/dispatch",
            payload={"supplierWalletId": supplier_wallet.wallet_id},
        )
        tx_hash = result.get("txHash")
        status = result.get("status")
        if isinstance(tx_hash, str):
            link.last_tx_hash = tx_hash
        if isinstance(status, str):
            link.last_known_status = status
        db.add(link)
        db.commit()
        db.refresh(link)
        return result

    async def deliver_contract(self, db: Session, contract: Contract, merchant: Merchant) -> Dict[str, Any]:
        link = self.get_contract_link_or_fail(db, contract.id)
        merchant_wallet = await self.ensure_wallet_for_merchant(db, merchant)
        result = await self._request(
            "POST",
            f"/contracts/{link.blockchain_contract_id}/deliver",
            payload={"merchantWalletId": merchant_wallet.wallet_id},
        )
        tx_hash = result.get("txHash")
        status = result.get("status")
        if isinstance(tx_hash, str):
            link.last_tx_hash = tx_hash
        if isinstance(status, str):
            link.last_known_status = status
        db.add(link)
        db.commit()
        db.refresh(link)
        return result

    async def record_repayment(self, db: Session, contract: Contract, amount: float) -> Dict[str, Any]:
        link = self.get_contract_link_or_fail(db, contract.id)
        result = await self._request(
            "POST",
            f"/contracts/{link.blockchain_contract_id}/repay",
            payload={"amount": amount},
        )
        tx_hash = result.get("txHash")
        status_payload = await self._request("GET", f"/contracts/{link.blockchain_contract_id}/status")
        status = status_payload.get("status")
        if isinstance(tx_hash, str):
            link.last_tx_hash = tx_hash
        if isinstance(status, str):
            link.last_known_status = status
        db.add(link)
        db.commit()
        db.refresh(link)
        return result

    async def settle_contract(self, db: Session, contract: Contract) -> Dict[str, Any]:
        link = self.get_contract_link_or_fail(db, contract.id)
        result = await self._request(
            "POST",
            f"/contracts/{link.blockchain_contract_id}/settle",
        )
        tx_hash = result.get("txHash")
        status = result.get("status")
        if isinstance(tx_hash, str):
            link.last_tx_hash = tx_hash
        if isinstance(status, str):
            link.last_known_status = status
        db.add(link)
        db.commit()
        db.refresh(link)
        return result


blockchain_service = BlockchainService()
