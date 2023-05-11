// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/TokenThresholdAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';

import '../interfaces/IFeeClaimer.sol';

// solhint-disable avoid-low-level-calls

abstract contract Funder is BaseAction, TokenThresholdAction, RelayedAction {
    address public feeClaimer;

    address public tokenOut;
    uint256 public maxSlippage;
    EnumerableSet.AddressSet private allowedTokens;

    event TokenOutSet(address indexed tokenOut);
    event MaxSlippageSet(uint256 maxSlippage);
    event AllowedTokenSet(address indexed token, bool allowed);

    event TokenInSet(address indexed tokenIn);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    struct AxelarBridgerConfig {
        address smartVault;
        address thresholdToken;
        uint256 thresholdAmount;
        address[] allowedTokens;
        uint256[] allowedChainIds;
    }

    constructor(AxelarBridgerConfig memory config, address admin, address registry) BaseAction(admin, registry) {
        require(address(config.smartVault) != address(0), 'SMART_VAULT_ZERO');
        smartVault = ISmartVault(config.smartVault);
        emit SmartVaultSet(config.smartVault);

        for (uint256 i = 0; i < config.allowedTokens.length; i++) _setAllowedToken(config.allowedTokens[i], true);
        for (uint256 j = 0; j < config.allowedChainIds.length; j++) _setAllowedChain(config.allowedChainIds[j], true);

        thresholdToken = config.thresholdToken;
        thresholdAmount = config.thresholdAmount;
        emit ThresholdSet(config.thresholdToken, config.thresholdAmount);
    }

    function getAllowedTokensLength() external view returns (uint256) {
        return allowedTokens.length();
    }

    function getAllowedTokens() external view returns (address[] memory) {
        return allowedTokens.values();
    }

    function isTokenAllowed(address token) public view returns (bool) {
        return allowedTokens.contains(token);
    }


    function setTokenOut(address token) external auth {
        require(token == address(0) || token != tokenIn, 'SWAPPER_TOKEN_OUT_EQ_IN');
        tokenOut = token;
        emit TokenOutSet(token);
    }

    function setMaxSlippage(uint256 newMaxSlippage) external auth {
        require(newMaxSlippage <= FixedPoint.ONE, 'SWAPPER_SLIPPAGE_ABOVE_ONE');
        maxSlippage = newMaxSlippage;
        emit MaxSlippageSet(newMaxSlippage);
    }
}
