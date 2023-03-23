// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../actions/OracledAction.sol';

contract OracledActionMock is OracledAction {
    event LogPrice(uint256 price);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getPrice(address base, address quote) external {
        emit LogPrice(_getPrice(base, quote));
    }
}
