// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../config/TransactionGas.sol';

contract TransactionGasMock {
    using TransactionGas for TransactionGas.Config;

    TransactionGas.Config internal transactionGas;

    event FeeData(uint256 gasPrice, uint256 baseFee, uint256 priorityFee);

    function call() external {
        transactionGas.validate();
        emit FeeData(tx.gasprice, block.basefee, tx.gasprice - block.basefee);
    }

    function get() external view returns (uint256 gasPriceLimit, uint256 priorityFeeLimit) {
        return transactionGas.get();
    }

    function set(uint256 gasPriceLimit, uint256 priorityFeeLimit) external {
        return transactionGas.set(gasPriceLimit, priorityFeeLimit);
    }
}
