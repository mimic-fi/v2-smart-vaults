// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/BaseAction.sol';

contract BaseActionMock is BaseAction {
    // Cost in gas of a call op + gas cost computation + withdraw form SV
    uint256 public constant override BASE_GAS = 21e3 + 20e3;

    constructor(address admin, address smartVault)
        BaseAction(Params(admin, smartVault, 0, 0, 0, new address[](0), 0, 0, new bytes32[](0), new bytes32[](0)))
    {
        // solhint-disable-previous-line no-empty-blocks
    }

    function call(address token) external redeemGas(token) {
        emit Executed();
    }
}
