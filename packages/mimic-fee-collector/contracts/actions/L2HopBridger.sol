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

import './BaseHopBridger.sol';

contract L2HopBridger is BaseHopBridger {
    using FixedPoint for uint256;

    uint256 public maxBonderFeePct;
    mapping (address => address) public getTokenAmm;

    event MaxBonderFeePctSet(uint256 maxBonderFeePct);
    event TokenAmmSet(address indexed token, address indexed amm);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function canExecute(uint256 chainId, address token, uint256 amount, uint256 slippage, uint256 bonderFee)
        external
        view
        returns (bool)
    {
        return
            getTokenAmm[token] != address(0) &&
            isChainAllowed[chainId] &&
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
        getTokenAmm[token] = amm;
        emit TokenAmmSet(token, amm);
    }

    function call(uint256 chainId, address token, uint256 amount, uint256 slippage, uint256 bonderFee) external auth {
        address amm = getTokenAmm[token];
        require(amm != address(0), 'BRIDGER_TOKEN_AMM_NOT_SET');
        require(isChainAllowed[chainId], 'BRIDGER_CHAIN_NOT_ALLOWED');
        require(slippage <= maxSlippage, 'BRIDGER_SLIPPAGE_ABOVE_MAX');
        require(bonderFee.divUp(amount) <= maxBonderFeePct, 'BRIDGER_BONDER_FEE_ABOVE_MAX');
        _validateThreshold(token, amount);

        _collect(token, amount);
        bytes memory data = _isL1(chainId) ? abi.encode(amm, bonderFee) : abi.encode(amm, bonderFee, maxDeadline);
        smartVault.bridge(HOP_SOURCE, chainId, token, amount, ISmartVault.BridgeLimit.Slippage, slippage, data);
        emit Executed();
    }
}
