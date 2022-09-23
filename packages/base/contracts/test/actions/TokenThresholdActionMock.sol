// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/TokenThresholdAction.sol';

contract TokenThresholdActionMock is TokenThresholdAction {
    constructor(address _admin, IWallet _wallet) BaseAction(_admin, _wallet) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function validateThreshold(address token, uint256 amount) external {
        _validateThreshold(token, amount);
    }
}
