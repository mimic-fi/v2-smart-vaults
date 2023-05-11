// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/OracledAction.sol';

contract OracledActionMock is OracledAction {
    event LogPrice(uint256 price);

    constructor(address smartVault, address admin, address registry) BaseAction(admin, registry) {
        _setSmartVault(smartVault);
    }

    function getPrice(address base, address quote) external {
        emit LogPrice(_getPrice(base, quote));
    }
}
