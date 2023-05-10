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

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/TokenThresholdAction.sol';
import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';

contract ConnextBridger is BaseAction, TokenThresholdAction {
    using FixedPoint for uint256;
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Connext source number
    uint8 internal constant CONNEXT_SOURCE = 2;

    uint256 public maxRelayerFeePct;
    EnumerableSet.UintSet private allowedChains;
    EnumerableSet.AddressSet private allowedTokens;

    event MaxRelayerFeePctSet(uint256 maxFeePct);
    event AllowedTokenSet(address indexed token, bool allowed);
    event AllowedChainSet(uint256 indexed chainId, bool allowed);

    struct ConnextBridgerConfig {
        address smartVault;
        uint256 maxRelayerFeePct;
        address thresholdToken;
        uint256 thresholdAmount;
        address[] allowedTokens;
        uint256[] allowedChainIds;
    }

    constructor(ConnextBridgerConfig memory config, address admin, address registry) BaseAction(admin, registry) {
        require(address(config.smartVault) != address(0), 'SMART_VAULT_ZERO');
        smartVault = ISmartVault(config.smartVault);
        emit SmartVaultSet(config.smartVault);

        _setMaxRelayerFeePct(maxRelayerFeePct);
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

    function getAllowedChainsLength() external view returns (uint256) {
        return allowedChains.length();
    }

    function getAllowedChains() external view returns (uint256[] memory) {
        return allowedChains.values();
    }

    function isChainAllowed(uint256 chainId) public view returns (bool) {
        return allowedChains.contains(chainId);
    }

    function setMaxRelayerFeePct(uint256 newMaxRelayerFeePct) external auth {
        _setMaxRelayerFeePct(newMaxRelayerFeePct);
    }

    function setAllowedToken(address token, bool allowed) external auth {
        _setAllowedToken(token, allowed);
    }

    function setAllowedChain(uint256 chainId, bool allowed) external auth {
        _setAllowedChain(chainId, allowed);
    }

    function call(uint256 chainId, address token, uint256 amount, uint256 relayerFee) external auth nonReentrant {
        require(isChainAllowed(chainId), 'BRIDGER_CHAIN_NOT_ALLOWED');
        require(isTokenAllowed(token), 'BRIDGER_TOKEN_NOT_ALLOWED');
        require(amount > 0, 'BRIDGER_AMOUNT_ZERO');
        require(relayerFee.divUp(amount) <= maxRelayerFeePct, 'BRIDGER_RELAYER_FEE_ABOVE_MAX');
        _validateThreshold(token, amount);

        if (Denominations.isNativeToken(token)) smartVault.wrap(amount, new bytes(0));
        smartVault.bridge(
            CONNEXT_SOURCE,
            chainId,
            _wrappedIfNative(token),
            amount,
            ISmartVault.BridgeLimit.MinAmountOut,
            amount - relayerFee,
            address(smartVault),
            abi.encode(relayerFee)
        );
        emit Executed();
    }

    function _setMaxRelayerFeePct(uint256 newMaxRelayerFeePct) private {
        require(newMaxRelayerFeePct <= FixedPoint.ONE, 'BRIDGER_RELAYER_FEE_PCT_GT_ONE');
        maxRelayerFeePct = newMaxRelayerFeePct;
        emit MaxRelayerFeePctSet(newMaxRelayerFeePct);
    }

    function _setAllowedToken(address token, bool allowed) private {
        require(token != address(0), 'BRIDGER_TOKEN_ZERO');
        if (allowed ? allowedTokens.add(token) : allowedTokens.remove(token)) {
            emit AllowedTokenSet(token, allowed);
        }
    }

    function _setAllowedChain(uint256 chainId, bool allowed) private {
        require(chainId != 0, 'BRIDGER_CHAIN_ID_ZERO');
        require(chainId != block.chainid, 'BRIDGER_SAME_CHAIN_ID');
        if (allowed ? allowedChains.add(chainId) : allowedChains.remove(chainId)) {
            emit AllowedChainSet(chainId, allowed);
        }
    }
}
