#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{contract, contractimpl, contracttype, testutils::Address as _, Address, Env, String};

#[derive(Clone)]
#[contracttype]
enum TokenDataKey {
    Balance(Address),
}

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn mint(env: Env, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("mint amount must be positive");
        }

        let key = TokenDataKey::Balance(to);
        let current: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(current + amount));
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        if amount < 0 {
            panic!("transfer amount must be non-negative");
        }

        let from_key = TokenDataKey::Balance(from);
        let to_key = TokenDataKey::Balance(to);

        let from_balance: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic!("insufficient balance");
        }

        let to_balance: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
        env.storage().instance().set(&from_key, &(from_balance - amount));
        env.storage().instance().set(&to_key, &(to_balance + amount));
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        env.storage()
            .instance()
            .get(&TokenDataKey::Balance(owner))
            .unwrap_or(0)
    }
}

fn setup(amount: i128) -> (Env, Address, Address, Address, Address, Address) {
    let env = Env::default();

    let contract_address = env.register_contract(None, InventoryCreditContract);
    let token_address = env.register_contract(None, MockToken);

    let contract = InventoryCreditContractClient::new(&env, &contract_address);
    let token = MockTokenClient::new(&env, &token_address);

    let merchant = Address::generate(&env);
    let supplier = Address::generate(&env);
    let platform = Address::generate(&env);

    contract
        .mock_all_auths()
        .create(&merchant, &supplier, &platform, &amount, &token_address, &u64::MAX);
    token.mint(&platform, &10_000);

    (
        env,
        contract_address,
        token_address,
        merchant,
        supplier,
        platform,
    )
}

#[test]
fn happy_path_lifecycle() {
    let (env, contract_address, token_address, _merchant, supplier, platform) = setup(1_000);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);
    let token = MockTokenClient::new(&env, &token_address);

    contract
        .mock_all_auths()
        .fund_escrow(&platform, &1_000_i128);
    let state = contract.get_state();
    assert_eq!(state.status, ContractStatus::PendingDispatch);
    assert_eq!(state.escrow_balance, 1_000);

    contract.mock_all_auths().dispatch();
    assert_eq!(contract.get_state().status, ContractStatus::Dispatched);

    contract.mock_all_auths().deliver();
    let state = contract.get_state();
    assert_eq!(state.status, ContractStatus::Delivered);
    assert_eq!(state.escrow_balance, 0);
    assert_eq!(token.balance(&supplier), 1_000);

    contract.mock_all_auths().record_repayment(&300);
    contract.mock_all_auths().record_repayment(&350);
    contract.mock_all_auths().record_repayment(&350);

    let state = contract.get_state();
    assert_eq!(state.status, ContractStatus::Repaying);
    assert_eq!(state.repaid, 1_000);

    contract.mock_all_auths().settle();
    assert_eq!(contract.get_state().status, ContractStatus::Settled);
}

#[test]
fn dispute_then_cancel_refunds_escrow() {
    let (env, contract_address, token_address, _merchant, _supplier, platform) = setup(500);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);
    let token = MockTokenClient::new(&env, &token_address);

    let initial_platform_balance = token.balance(&platform);

    contract.mock_all_auths().fund_escrow(&platform, &500);
    assert_eq!(token.balance(&platform), initial_platform_balance - 500);

    contract
        .mock_all_auths()
        .raise_dispute(&String::from_str(&env, "supplier delay"), &platform);

    assert_eq!(contract.get_state().status, ContractStatus::Disputed);

    contract.mock_all_auths().cancel();

    let final_state = contract.get_state();
    assert_eq!(final_state.status, ContractStatus::Cancelled);
    assert_eq!(final_state.escrow_balance, 0);

    assert_eq!(token.balance(&platform), initial_platform_balance);
    assert_eq!(token.balance(&contract_address), 0);
}

#[test]
fn invalid_transition_deliver_before_dispatch_fails() {
    let (env, contract_address, _token_address, _merchant, _supplier, platform) = setup(700);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);

    contract.mock_all_auths().fund_escrow(&platform, &700);
    let result = contract.mock_all_auths().try_deliver();
    assert!(result.is_err());
}

#[test]
fn auth_check_rejects_unsigned_dispatch() {
    let (env, contract_address, _token_address, _merchant, _supplier, platform) = setup(900);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);

    contract.mock_all_auths().fund_escrow(&platform, &900);

    // This call intentionally omits mocked auth and should fail auth checks.
    let result = contract.try_dispatch();
    assert!(result.is_err());
}
