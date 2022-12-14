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

import '@mimic-fi/v2-bridge-connector/contracts/interfaces/IHopL1Bridge.sol';
import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';

import './BaseHopBridger.sol';

contract L1HopBridger is BaseHopBridger {
    using FixedPoint for uint256;

    mapping (address => address) public getTokenBridge;
    mapping (address => uint256) public getMaxRelayerFeePct;

    event TokenBridgeSet(address indexed token, address indexed bridge);
    event MaxRelayerFeePctSet(address indexed relayer, uint256 maxFeePct);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function canExecute(
        uint256 chainId,
        address token,
        uint256 amount,
        uint256 slippage,
        address relayer,
        uint256 relayerFee
    ) external view returns (bool) {
        return
            getTokenBridge[token] != address(0) &&
            isChainAllowed[chainId] &&
            slippage <= maxSlippage &&
            relayerFee.divUp(amount) <= getMaxRelayerFeePct[relayer] &&
            _passesThreshold(token, amount);
    }

    function setMaxRelayerFeePct(address relayer, uint256 newMaxFeePct) external auth {
        require(newMaxFeePct <= FixedPoint.ONE, 'BRIDGER_RELAYER_FEE_PCT_GT_ONE');
        getMaxRelayerFeePct[relayer] = newMaxFeePct;
        emit MaxRelayerFeePctSet(relayer, newMaxFeePct);
    }

    function setTokenBridge(address token, address bridge) external auth {
        require(token != address(0), 'BRIDGER_TOKEN_ZERO');
        bool isValidBridgeToken = bridge == address(0) || IHopL1Bridge(bridge).l1CanonicalToken() == token;
        require(isValidBridgeToken, 'BRIDGER_BRIDGE_TOKEN_DONT_MATCH');
        getTokenBridge[token] = bridge;
        emit TokenBridgeSet(token, bridge);
    }

    function call(uint256 chainId, address token, uint256 amount, uint256 slippage, address relayer, uint256 relayerFee)
        external
        auth
    {
        address bridge = getTokenBridge[token];
        require(bridge != address(0), 'BRIDGER_TOKEN_BRIDGE_NOT_SET');
        require(isChainAllowed[chainId], 'BRIDGER_CHAIN_NOT_ALLOWED');
        require(slippage <= maxSlippage, 'BRIDGER_SLIPPAGE_ABOVE_MAX');
        require(relayerFee.divUp(amount) <= getMaxRelayerFeePct[relayer], 'BRIDGER_RELAYER_FEE_ABOVE_MAX');
        _validateThreshold(token, amount);

        _collect(token, amount);
        bytes memory data = abi.encode(bridge, maxDeadline, relayer, relayerFee);
        smartVault.bridge(HOP_SOURCE, chainId, token, amount, ISmartVault.BridgeLimit.Slippage, slippage, data);
        emit Executed();
    }
}
