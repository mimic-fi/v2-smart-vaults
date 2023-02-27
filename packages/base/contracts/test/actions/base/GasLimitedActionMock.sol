// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../actions/base/GasLimitedAction.sol';

contract GasLimitedActionMock is GasLimitedAction {
    event FeeData(uint256 gasPrice, uint256 baseFee, uint256 priorityFee);

    constructor(uint256 gasPriceLimit, uint256 priorityFeeLimit) GasLimitedAction(gasPriceLimit, priorityFeeLimit) {
        _authorize(msg.sender, Authorizer.authorize.selector);
    }

    function call() external {
        _validate();
        emit FeeData(tx.gasprice, block.basefee, tx.gasprice - block.basefee);
    }
}
