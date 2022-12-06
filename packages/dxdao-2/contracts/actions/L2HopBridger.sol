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

import '@mimic-fi/v2-bridge-connector/contracts/interfaces/IHopL2AMM.sol';
import '@mimic-fi/v2-helpers/contracts/math/FixedPoint.sol';
import '@mimic-fi/v2-smart-vault/contracts/ISmartVault.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/TokenThresholdAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';

contract L2HopBridger is BaseAction, TokenThresholdAction, RelayedAction {
    using FixedPoint for uint256;

    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 80e3;

    // Hop Exchange source number
    uint8 public constant HOP_SOURCE = 0;

    // Ethereum mainnet chain ID
    uint256 public constant ETHEREUM_MAINNET = 1;

    uint256 public maxDeadline;
    uint256 public maxSlippage;
    uint256 public maxBonderFeePct;
    mapping (uint256 => bool) public isChainAllowed;
    mapping (address => address) public getTokenAmm;

    event MaxDeadlineSet(uint256 maxDeadline);
    event MaxSlippageSet(uint256 maxSlippage);
    event MaxBonderFeePctSet(uint256 maxBonderFeePct);
    event AllowedChainSet(uint256 indexed chainId, bool allowed);
    event TokenAmmSet(address indexed token, address indexed amm);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function setMaxDeadline(uint256 newMaxDeadline) external auth {
        require(newMaxDeadline > 0, 'BRIDGER_MAX_DEADLINE_ZERO');
        maxDeadline = newMaxDeadline;
        emit MaxDeadlineSet(newMaxDeadline);
    }

    function setMaxSlippage(uint256 newMaxSlippage) external auth {
        require(newMaxSlippage <= FixedPoint.ONE, 'BRIDGER_SLIPPAGE_ABOVE_ONE');
        maxSlippage = newMaxSlippage;
        emit MaxSlippageSet(newMaxSlippage);
    }

    function setMaxBonderFeePct(uint256 newMaxBonderFeePct) external auth {
        require(newMaxBonderFeePct <= FixedPoint.ONE, 'BRIDGER_BONDER_FEE_PCT_ABOVE_ONE');
        maxBonderFeePct = newMaxBonderFeePct;
        emit MaxBonderFeePctSet(newMaxBonderFeePct);
    }

    function setAllowedChain(uint256 chainId, bool allowed) external auth {
        require(chainId != 0, 'BRIDGER_CHAIN_ID_ZERO');
        require(chainId != block.chainid, 'BRIDGER_SAME_CHAIN_ID');
        isChainAllowed[chainId] = allowed;
        emit AllowedChainSet(chainId, allowed);
    }

    function setTokenAmm(address token, address amm) external auth {
        require(token != address(0), 'BRIDGER_TOKEN_ZERO');
        require(amm == address(0) || IHopL2AMM(amm).l2CanonicalToken() == token, 'BRIDGER_AMM_TOKEN_DOES_NOT_MATCH');
        getTokenAmm[token] = amm;
        emit TokenAmmSet(token, amm);
    }

    function call(uint256 chainId, address token, uint256 amount, uint256 slippage, uint256 bonderFeePct)
        external
        auth
    {
        (isRelayer[msg.sender] ? _relayedCall : _call)(chainId, token, amount, slippage, bonderFeePct);
    }

    function _relayedCall(uint256 chainId, address token, uint256 amount, uint256 slippage, uint256 bonderFeePct)
        internal
        redeemGas
    {
        _call(chainId, token, amount, slippage, bonderFeePct);
    }

    function _call(uint256 chainId, address token, uint256 amount, uint256 slippage, uint256 bonderFeePct) internal {
        address amm = getTokenAmm[token];
        require(amm != address(0), 'BRIDGER_TOKEN_AMM_NOT_SET');
        require(isChainAllowed[chainId], 'BRIDGER_CHAIN_NOT_ALLOWED');
        require(slippage <= maxSlippage, 'BRIDGER_SLIPPAGE_ABOVE_MAX');
        require(bonderFeePct <= maxBonderFeePct, 'BRIDGER_BONDER_FEE_ABOVE_MAX');
        _validateThreshold(token, amount);

        uint256 fee = amount.mulDown(bonderFeePct);
        bytes memory data = chainId == ETHEREUM_MAINNET ? abi.encode(amm, fee) : abi.encode(amm, fee, maxDeadline);
        smartVault.bridge(HOP_SOURCE, chainId, token, amount, ISmartVault.BridgeLimit.Slippage, slippage, data);
        emit Executed();
    }
}
