import httpx
from typing import Optional, Dict, Any
from core.config import settings

ORACLE_URL = settings.BLOCKCHAIN_ORACLE_URL

async def create_blockchain_wallet(owner_id: str, wallet_type: str) -> Optional[Dict[str, Any]]:
    """Creates a wallet in the blockchain oracle."""
    if not settings.BLOCKCHAIN_ENABLED:
        return {"walletId": f"MOCK-WALLET-{owner_id}", "publicKey": f"MOCK-PUBKEY-{owner_id}"}
    
    async with httpx.AsyncClient(timeout=settings.BLOCKCHAIN_REQUEST_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(
                f"{ORACLE_URL}/wallets/create",
                json={"type": wallet_type, "ownerId": owner_id}
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Blockchain Oracle Error (create_wallet): {e}")
            return None

async def create_blockchain_contract(
    merchant_wallet_id: str, 
    supplier_wallet_id: str, 
    amount: float, 
    deadline_hours: int = 24
) -> Optional[Dict[str, Any]]:
    """Creates a credit contract in the blockchain oracle."""
    if not settings.BLOCKCHAIN_ENABLED:
        return {"contractId": f"MOCK-CONTRACT-{merchant_wallet_id}"}

    async with httpx.AsyncClient(timeout=settings.BLOCKCHAIN_REQUEST_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(
                f"{ORACLE_URL}/contracts/create",
                json={
                    "merchantWalletId": merchant_wallet_id,
                    "supplierWalletId": supplier_wallet_id,
                    "amount": amount,
                    "dispatchDeadlineHours": deadline_hours
                }
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Blockchain Oracle Error (create_contract): {e}")
            return None

async def fund_blockchain_contract(contract_id: str, from_wallet_id: str, amount: float) -> bool:
    """Funds the escrow for a contract."""
    if not settings.BLOCKCHAIN_ENABLED:
        return True

    async with httpx.AsyncClient(timeout=settings.BLOCKCHAIN_REQUEST_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(
                f"{ORACLE_URL}/contracts/{contract_id}/fund",
                json={"fromWalletId": from_wallet_id, "amount": amount}
            )
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Blockchain Oracle Error (fund_contract): {e}")
            return False

async def dispatch_blockchain_goods(contract_id: str, supplier_wallet_id: str) -> bool:
    """Marks goods as dispatched in the oracle."""
    if not settings.BLOCKCHAIN_ENABLED:
        return True

    async with httpx.AsyncClient(timeout=settings.BLOCKCHAIN_REQUEST_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(
                f"{ORACLE_URL}/contracts/{contract_id}/dispatch",
                json={"supplierWalletId": supplier_wallet_id}
            )
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Blockchain Oracle Error (dispatch): {e}")
            return False

async def confirm_blockchain_delivery(contract_id: str, merchant_wallet_id: str) -> bool:
    """Confirms delivery in the oracle, triggering payout."""
    if not settings.BLOCKCHAIN_ENABLED:
        return True

    async with httpx.AsyncClient(timeout=settings.BLOCKCHAIN_REQUEST_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(
                f"{ORACLE_URL}/contracts/{contract_id}/deliver",
                json={"merchantWalletId": merchant_wallet_id}
            )
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Blockchain Oracle Error (deliver): {e}")
            return False

async def record_blockchain_repayment(contract_id: str, amount: float) -> bool:
    """Records repayment in the oracle."""
    if not settings.BLOCKCHAIN_ENABLED:
        return True

    async with httpx.AsyncClient(timeout=settings.BLOCKCHAIN_REQUEST_TIMEOUT_SECONDS) as client:
        try:
            response = await client.post(
                f"{ORACLE_URL}/contracts/{contract_id}/repay",
                json={"amount": amount}
            )
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Blockchain Oracle Error (repay): {e}")
            return False

async def get_blockchain_contract_status(contract_id: str) -> Optional[Dict[str, Any]]:
    """Fetches live on-chain state for a contract from the oracle."""
    if not settings.BLOCKCHAIN_ENABLED:
        return {
            "contractId": contract_id,
            "status": "Created",
            "amount": 0,
            "repaid": 0,
            "escrowBalance": 0,
            "mock": True
        }

    async with httpx.AsyncClient(timeout=settings.BLOCKCHAIN_REQUEST_TIMEOUT_SECONDS) as client:
        try:
            response = await client.get(f"{ORACLE_URL}/contracts/{contract_id}/status")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Blockchain Oracle Error (get_status): {e}")
            return None
