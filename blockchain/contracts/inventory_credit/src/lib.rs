#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol,
};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ContractStatus {
    Created,
    PendingDispatch,
    Dispatched,
    Delivered,
    Repaying,
    Disputed,
    Cancelled,
    Settled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CreditContract {
    pub contract_id: Symbol,
    pub merchant: Address,
    pub supplier: Address,
    pub platform: Address,
    pub amount: i128,
    pub escrow_balance: i128,
    pub repaid: i128,
    pub status: ContractStatus,
    pub created_at: u64,
    pub dispatch_deadline: u64,
    pub token: Address,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    State,
}

#[contract]
pub struct InventoryCreditContract;

fn read_state(env: &Env) -> CreditContract {
    env.storage()
        .instance()
        .get(&DataKey::State)
        .unwrap_or_else(|| panic!("contract not initialized"))
}

fn write_state(env: &Env, state: &CreditContract) {
    env.storage().instance().set(&DataKey::State, state);
}

fn emit_audit(
    env: &Env,
    event: Symbol,
    contract_id: Symbol,
    old_status: ContractStatus,
    new_status: ContractStatus,
    caller: Address,
) {
    env.events().publish(
        (symbol_short!("audit"), event),
        (
            contract_id,
            old_status,
            new_status,
            env.ledger().timestamp(),
            caller,
        ),
    );
}

fn is_cancel_allowed(status: &ContractStatus) -> bool {
    matches!(
        status,
        ContractStatus::Created | ContractStatus::PendingDispatch | ContractStatus::Disputed
    )
}

#[contractimpl]
impl InventoryCreditContract {
    pub fn create(
        env: Env,
        merchant: Address,
        supplier: Address,
        platform: Address,
        amount: i128,
        token: Address,
        dispatch_deadline: u64,
    ) {
        if env.storage().instance().has(&DataKey::State) {
            panic!("contract already initialized");
        }
        if amount <= 0 {
            panic!("amount must be positive");
        }

        platform.require_auth();

        let state = CreditContract {
            contract_id: symbol_short!("credit"),
            merchant,
            supplier,
            platform: platform.clone(),
            amount,
            escrow_balance: 0,
            repaid: 0,
            status: ContractStatus::Created,
            created_at: env.ledger().timestamp(),
            dispatch_deadline,
            token,
        };

        write_state(&env, &state);
        emit_audit(
            &env,
            symbol_short!("create"),
            state.contract_id.clone(),
            ContractStatus::Created,
            ContractStatus::Created,
            platform,
        );
    }

    pub fn fund_escrow(env: Env, from: Address, amount: i128) {
        let mut state = read_state(&env);
        state.platform.require_auth();

        if from != state.platform {
            panic!("escrow can only be funded from platform address");
        }
        if amount <= 0 {
            panic!("fund amount must be positive");
        }
        if state.status != ContractStatus::Created {
            panic!("fund_escrow allowed only from Created state");
        }

        let old_status = state.status.clone();
        token::Client::new(&env, &state.token).transfer(&from, &env.current_contract_address(), &amount);

        state.escrow_balance += amount;
        state.status = ContractStatus::PendingDispatch;

        write_state(&env, &state);
        emit_audit(
            &env,
            symbol_short!("fund"),
            state.contract_id.clone(),
            old_status,
            state.status,
            from,
        );
    }

    pub fn dispatch(env: Env) {
        let mut state = read_state(&env);
        state.supplier.require_auth();
        let caller = state.supplier.clone();

        if state.status != ContractStatus::PendingDispatch {
            panic!("dispatch allowed only from PendingDispatch state");
        }
        if env.ledger().timestamp() > state.dispatch_deadline {
            panic!("dispatch deadline exceeded");
        }

        let old_status = state.status.clone();
        state.status = ContractStatus::Dispatched;

        write_state(&env, &state);
        emit_audit(
            &env,
            symbol_short!("dispatch"),
            state.contract_id.clone(),
            old_status,
            state.status,
            caller,
        );
    }

    pub fn deliver(env: Env) {
        let mut state = read_state(&env);
        state.merchant.require_auth();
        let caller = state.merchant.clone();

        if state.status != ContractStatus::Dispatched {
            panic!("deliver allowed only from Dispatched state");
        }

        let old_status = state.status.clone();
        let payout_amount = state.escrow_balance;

        if payout_amount > 0 {
            token::Client::new(&env, &state.token).transfer(
                &env.current_contract_address(),
                &state.supplier,
                &payout_amount,
            );
            state.escrow_balance = 0;
        }

        state.status = ContractStatus::Delivered;
        write_state(&env, &state);

        emit_audit(
            &env,
            symbol_short!("deliver"),
            state.contract_id.clone(),
            old_status,
            state.status,
            caller,
        );
    }

    pub fn record_repayment(env: Env, amount: i128) {
        let mut state = read_state(&env);
        state.platform.require_auth();
        let caller = state.platform.clone();

        if amount <= 0 {
            panic!("repayment amount must be positive");
        }
        if !matches!(
            state.status,
            ContractStatus::Delivered | ContractStatus::Repaying
        ) {
            panic!("record_repayment allowed only from Delivered or Repaying");
        }

        let old_status = state.status.clone();
        state.repaid += amount;
        state.status = ContractStatus::Repaying;

        write_state(&env, &state);
        emit_audit(
            &env,
            symbol_short!("repay"),
            state.contract_id.clone(),
            old_status,
            state.status,
            caller,
        );
    }

    pub fn settle(env: Env) {
        let mut state = read_state(&env);
        state.platform.require_auth();
        let caller = state.platform.clone();

        if !matches!(
            state.status,
            ContractStatus::Delivered | ContractStatus::Repaying
        ) {
            panic!("settle allowed only from Delivered or Repaying");
        }
        if state.repaid < state.amount {
            panic!("cannot settle before full repayment");
        }

        let old_status = state.status.clone();
        state.status = ContractStatus::Settled;

        write_state(&env, &state);
        emit_audit(
            &env,
            symbol_short!("settle"),
            state.contract_id.clone(),
            old_status,
            state.status,
            caller,
        );
    }

    pub fn raise_dispute(env: Env, reason: String, raised_by: Address) {
        let mut state = read_state(&env);
        raised_by.require_auth();

        if raised_by != state.merchant && raised_by != state.platform {
            panic!("only merchant or platform can raise dispute");
        }

        if matches!(state.status, ContractStatus::Settled | ContractStatus::Cancelled) {
            panic!("cannot dispute settled or cancelled contracts");
        }

        let old_status = state.status.clone();
        state.status = ContractStatus::Disputed;

        write_state(&env, &state);
        emit_audit(
            &env,
            symbol_short!("dispute"),
            state.contract_id.clone(),
            old_status,
            state.status.clone(),
            raised_by,
        );

        env.events().publish(
            (symbol_short!("audit"), symbol_short!("reason")),
            (state.contract_id, reason, env.ledger().timestamp()),
        );
    }

    pub fn cancel(env: Env) {
        let mut state = read_state(&env);
        state.platform.require_auth();
        let caller = state.platform.clone();

        if !is_cancel_allowed(&state.status) {
            panic!("cancel allowed only from Created, PendingDispatch, or Disputed");
        }

        let old_status = state.status.clone();
        let refund_amount = state.escrow_balance;

        if refund_amount > 0 {
            token::Client::new(&env, &state.token).transfer(
                &env.current_contract_address(),
                &state.platform,
                &refund_amount,
            );
            state.escrow_balance = 0;
        }

        state.status = ContractStatus::Cancelled;
        write_state(&env, &state);

        emit_audit(
            &env,
            symbol_short!("cancel"),
            state.contract_id.clone(),
            old_status,
            state.status,
            caller,
        );
    }

    pub fn get_state(env: Env) -> CreditContract {
        read_state(&env)
    }
}

#[cfg(test)]
mod test;
