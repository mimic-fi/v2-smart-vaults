// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/RelayedAction.sol';

contract RelayedActionMock is RelayedAction {
    uint256 public constant override BASE_GAS = 21e3 + 20e3;

    constructor(address _admin, IWallet _wallet) BaseAction(_admin, _wallet) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function call() external redeemGas {
        // solhint-disable-previous-line no-empty-blocks
    }
}
