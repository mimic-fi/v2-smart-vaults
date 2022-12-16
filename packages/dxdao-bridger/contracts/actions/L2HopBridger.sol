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
import '@mimic-fi/v2-helpers/contracts/utils/EnumerableMap.sol';

import './BaseHopBridger.sol';

contract L2HopBridger is BaseHopBridger {
    using FixedPoint for uint256;
    using EnumerableMap for EnumerableMap.AddressToAddressMap;

    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 80e3;

    uint256 public maxBonderFeePct;
    EnumerableMap.AddressToAddressMap private tokenAmms;

    event MaxBonderFeePctSet(uint256 maxBonderFeePct);
    event TokenAmmSet(address indexed token, address indexed amm);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function getTokensLength() external view override returns (uint256) {
        return tokenAmms.length();
    }

    function getTokenAmm(address token) external view returns (address amm) {
        (, amm) = tokenAmms.tryGet(token);
    }

    function getTokens() external view override returns (address[] memory tokens) {
        tokens = new address[](tokenAmms.length());
        for (uint256 i = 0; i < tokens.length; i++) {
            (address token, ) = tokenAmms.at(i);
            tokens[i] = token;
        }
    }

    function getTokenAmms() external view returns (address[] memory tokens, address[] memory amms) {
        tokens = new address[](tokenAmms.length());
        amms = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            (address token, address amm) = tokenAmms.at(i);
            tokens[i] = token;
            amms[i] = amm;
        }
    }

    function canExecute(address token, uint256 amount, uint256 slippage, uint256 bonderFee)
        external
        view
        returns (bool)
    {
        return
            tokenAmms.contains(token) &&
            destinationChainId != 0 &&
            slippage <= maxSlippage &&
            bonderFee.divUp(amount) <= maxBonderFeePct &&
            _passesThreshold(token, amount);
    }

    function setMaxBonderFeePct(uint256 newMaxBonderFeePct) external auth {
        require(newMaxBonderFeePct <= FixedPoint.ONE, 'BRIDGER_BONDER_FEE_PCT_ABOVE_ONE');
        maxBonderFeePct = newMaxBonderFeePct;
        emit MaxBonderFeePctSet(newMaxBonderFeePct);
    }

    function setTokenAmm(address token, address amm) external auth {
        require(token != address(0), 'BRIDGER_TOKEN_ZERO');
        require(amm == address(0) || IHopL2AMM(amm).l2CanonicalToken() == token, 'BRIDGER_AMM_TOKEN_DOES_NOT_MATCH');
        amm == address(0) ? tokenAmms.remove(token) : tokenAmms.set(token, amm);
        emit TokenAmmSet(token, amm);
    }

    function call(address token, uint256 amount, uint256 slippage, uint256 bonderFee) external auth {
        (isRelayer[msg.sender] ? _relayedCall : _call)(token, amount, slippage, bonderFee);
    }

    function _relayedCall(address token, uint256 amount, uint256 slippage, uint256 bonderFee) internal redeemGas {
        _call(token, amount, slippage, bonderFee);
    }

    function _call(address token, uint256 amount, uint256 slippage, uint256 bonderFee) internal {
        (bool existsAmm, address amm) = tokenAmms.tryGet(token);
        require(existsAmm, 'BRIDGER_TOKEN_AMM_NOT_SET');
        require(destinationChainId != 0, 'BRIDGER_CHAIN_NOT_SET');
        require(slippage <= maxSlippage, 'BRIDGER_SLIPPAGE_ABOVE_MAX');
        require(bonderFee.divUp(amount) <= maxBonderFeePct, 'BRIDGER_BONDER_FEE_ABOVE_MAX');
        _validateThreshold(token, amount);

        _collect(token, amount);
        bytes memory data = _bridgingToL1() ? abi.encode(amm, bonderFee) : abi.encode(amm, bonderFee, maxDeadline);
        _bridge(token, amount, slippage, data);
        emit Executed();
    }
}
