// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../../../actions/base/BaseAction.sol';

contract BaseActionMock is BaseAction {
    // Cost in gas of a call op + gas cost computation + withdraw form SV
    uint256 public constant override BASE_GAS = 21e3 + 20e3;

    constructor(address admin, address smartVault)
        BaseAction(
            Params(
                admin,
                smartVault,
                0, // gas price limit
                0, // tx fee limit
                0, // tx cost limit
                new address[](0), // allowed relayers
                0, // initial delay
                0, // time-lock delay
                ITokenConfig.TokensAcceptanceType.DenyList, // token acceptance list type
                new address[](0), // tokens acceptance list
                Threshold(address(0), 0, 0), // default threshold
                new address[](0), // list of custom threshold tokens
                new Threshold[](0), // list of custom threshold values
                new bytes32[](0), // custom param keys
                new bytes32[](0) // custom param values
            )
        )
    {
        // solhint-disable-previous-line no-empty-blocks
    }

    function call(address token) external redeemGas(token) {
        _validateAction();
        _validateToken(token);
        emit Executed();
    }
}
