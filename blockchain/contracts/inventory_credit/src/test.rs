#![cfg(test)]

extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup(amount: i128) -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    let contract_address = env.register_contract(None, InventoryCreditContract);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);

    let merchant = Address::generate(&env);
    let supplier = Address::generate(&env);
    let platform = Address::generate(&env);

    contract
        .mock_all_auths()
        .create(&merchant, &supplier, &platform, &amount, &u64::MAX);

    (env, contract_address, merchant, supplier, platform)
}

#[test]
fn happy_path_lifecycle() {
    let (env, contract_address, _merchant, _supplier, _platform) = setup(1_000);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);

    contract.mock_all_auths().approve();
    assert_eq!(contract.get_state().status, ContractStatus::PendingDispatch);

    contract.mock_all_auths().dispatch();
    assert_eq!(contract.get_state().status, ContractStatus::Dispatched);

    contract.mock_all_auths().deliver();
    let state = contract.get_state();
    assert_eq!(state.status, ContractStatus::Delivered);

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
fn dispute_then_cancel() {
    let (env, contract_address, _merchant, _supplier, platform) = setup(500);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);

    contract.mock_all_auths().approve();
    contract
        .mock_all_auths()
        .raise_dispute(&String::from_str(&env, "supplier delay"), &platform);

    assert_eq!(contract.get_state().status, ContractStatus::Disputed);

    contract.mock_all_auths().cancel();
    assert_eq!(contract.get_state().status, ContractStatus::Cancelled);
}

#[test]
fn create_starts_in_created_state() {
    let (env, contract_address, _merchant, _supplier, _platform) = setup(700);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);

    assert_eq!(contract.get_state().status, ContractStatus::Created);
}

#[test]
fn approve_transitions_to_pending_dispatch() {
    let (env, contract_address, _merchant, _supplier, _platform) = setup(900);
    let contract = InventoryCreditContractClient::new(&env, &contract_address);

    contract.mock_all_auths().approve();
    assert_eq!(contract.get_state().status, ContractStatus::PendingDispatch);
}
