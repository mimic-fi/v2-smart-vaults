// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../config/TransactionCost.sol';

contract TransactionCostMock {
    using TransactionCost for TransactionCost.Config;

    // Cost in gas of a call op + emit event
    uint256 public constant BASE_GAS = 21e3 + 3e3;

    TransactionCost.Config internal transactionCost;
    mapping (address => uint256) internal nativeRate;

    event TransactionCostPaid(address indexed token, uint256 amount);

    modifier redeemGas(address token) {
        transactionCost.initRelayedTx();
        _;
        transactionCost.payRelayedTx(token, BASE_GAS, getNativeTokenPrice, payTransactionCost);
    }

    function call(address token) external redeemGas(token) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function mockNativeTokenRate(address token, uint256 rate) external {
        nativeRate[token] = rate;
    }

    function getNativeTokenPrice(address token) internal view returns (uint256) {
        uint256 rate = nativeRate[token];
        require(rate > 0, 'TRANSACTION_COST_MOCK_RATE_0');
        return rate;
    }

    function payTransactionCost(address token, uint256 amount) internal {
        emit TransactionCostPaid(token, amount);
    }

    function hasRelayer(address relayer) external view returns (bool) {
        return transactionCost.hasRelayer(relayer);
    }

    function isTxCostValid(uint256 totalCost) external view returns (bool) {
        return transactionCost.isTxCostValid(totalCost);
    }

    function getRelayers() external view returns (address[] memory) {
        return transactionCost.getRelayers();
    }

    function getTxCostLimit() external view returns (uint256) {
        return transactionCost.getTxCostLimit();
    }

    function set(uint256 txCostLimit, address[] memory relayers) external {
        transactionCost.set(txCostLimit, relayers);
    }

    function setTxCostLimit(uint256 txCostLimit) external {
        transactionCost.setTxCostLimit(txCostLimit);
    }

    function setRelayers(address[] memory relayers) external {
        transactionCost.setRelayers(relayers);
    }

    function addRelayers(address[] memory relayers) external {
        transactionCost.addRelayers(relayers);
    }

    function addRelayer(address relayer) external returns (bool) {
        return transactionCost.addRelayer(relayer);
    }

    function cleanRelayers() external {
        transactionCost.cleanRelayers();
    }

    function removeRelayer(address relayer) external returns (bool) {
        return transactionCost.removeRelayer(relayer);
    }
}
