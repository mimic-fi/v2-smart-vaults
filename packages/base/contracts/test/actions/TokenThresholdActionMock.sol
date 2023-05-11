// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/TokenThresholdAction.sol';

contract TokenThresholdActionMock is TokenThresholdAction {
    constructor(address smartVault, address admin, address registry) BaseAction(admin, registry) {
        _setSmartVault(smartVault);
    }

    function call(address token, uint256 amount) external view {
        _validateThreshold(token, amount);
    }
}
