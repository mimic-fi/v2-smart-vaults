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
import '@mimic-fi/v2-helpers/contracts/math/UncheckedMath.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/BaseAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/TokenThresholdAction.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/RelayedAction.sol';

contract L2HopSwapper is BaseAction {
    using FixedPoint for uint256;
    using UncheckedMath for uint256;

    // Hop Exchange source number
    uint8 public constant HOP_SOURCE = 5;

    uint256 public maxSlippage;
    mapping (address => address) public getTokenAmm;

    event MaxSlippageSet(uint256 maxSlippage);
    event TokenAmmSet(address indexed token, address indexed amm);

    constructor(address admin, address registry) BaseAction(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function canExecute(address token, uint256 slippage) external view returns (bool) {
        return getTokenAmm[token] != address(0) && slippage <= maxSlippage;
    }

    function setMaxSlippage(uint256 newMaxSlippage) external auth {
        require(newMaxSlippage <= FixedPoint.ONE, 'SWAPPER_SLIPPAGE_ABOVE_ONE');
        maxSlippage = newMaxSlippage;
        emit MaxSlippageSet(newMaxSlippage);
    }

    function setTokenAmm(address token, address amm) external auth {
        require(token != address(0), 'SWAPPER_TOKEN_ZERO');
        require(amm == address(0) || IHopL2AMM(amm).l2CanonicalToken() == token, 'SWAPPER_AMM_TOKEN_DOES_NOT_MATCH');
        getTokenAmm[token] = amm;
        emit TokenAmmSet(token, amm);
    }

    function call(address token, uint256 slippage) external auth {
        address amm = getTokenAmm[token];
        require(amm != address(0), 'SWAPPER_TOKEN_AMM_NOT_SET');
        require(slippage <= maxSlippage, 'SWAPPER_SLIPPAGE_ABOVE_MAX');

        address hToken = IHopL2AMM(amm).hToken();
        uint256 balance = _balanceOf(hToken);
        bytes memory data = abi.encode(IHopL2AMM(amm).exchangeAddress());
        uint256 minAmountOut = balance.mulUp(FixedPoint.ONE.uncheckedSub(slippage));
        smartVault.swap(HOP_SOURCE, hToken, token, balance, ISmartVault.SwapLimit.MinAmountOut, minAmountOut, data);
        emit Executed();
    }
}
