// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../../actions/base/config/GasLimitConfig.sol';

contract GasLimitConfigMock is GasLimitConfig {
    event FeeData(uint256 gasPrice, uint256 baseFee, uint256 priorityFee);

    constructor(uint256 gasPriceLimit, uint256 priorityFeeLimit) GasLimitConfig(gasPriceLimit, priorityFeeLimit) {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }

    function call() external {
        _validateGasLimit();
        emit FeeData(tx.gasprice, block.basefee, tx.gasprice - block.basefee);
    }
}
