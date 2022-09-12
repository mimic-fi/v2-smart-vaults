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
import '@mimic-fi/v2-helpers/contracts/utils/Denominations.sol';
import '@mimic-fi/v2-price-oracle/contracts/IPriceOracle.sol';

import './BaseAction.sol';

abstract contract RelayedAction is BaseAction {
    using FixedPoint for uint256;

    // Base gas amount charged to cover default amounts
    // solhint-disable-next-line func-name-mixedcase
    function BASE_GAS() external view virtual returns (uint256);

    bytes private constant REDEEM_GAS_NOTE = bytes('RELAYER');

    uint256 internal _initialGas;
    uint256 public gasPriceLimit;
    uint256 public totalCostLimit;
    address public totalCostToken;
    mapping (address => bool) public isRelayer;

    event LimitsSet(uint256 gasPriceLimit, uint256 totalCostLimit, address totalCostToken);
    event RelayerSet(address indexed relayer, bool allowed);

    modifier redeemGas() {
        _beforeCall();
        _;
        _afterCall();
    }

    function setRelayer(address relayer, bool allowed) external auth {
        isRelayer[relayer] = allowed;
        emit RelayerSet(relayer, allowed);
    }

    function setLimits(uint256 _gasPriceLimit, uint256 _totalCostLimit, address _totalCostToken) external auth {
        gasPriceLimit = _gasPriceLimit;
        totalCostLimit = _totalCostLimit;
        totalCostToken = _totalCostToken;
        emit LimitsSet(_gasPriceLimit, _totalCostLimit, _totalCostToken);
    }

    function _beforeCall() internal {
        _initialGas = gasleft();
        uint256 limit = gasPriceLimit;
        require(limit == 0 || limit <= tx.gasprice, 'GAS_PRICE_ABOVE_LIMIT');
    }

    function _afterCall() internal {
        address payingToken = totalCostToken;
        uint256 totalGas = _initialGas - gasleft();
        uint256 totalCostEth = (totalGas + RelayedAction(this).BASE_GAS()) * tx.gasprice;
        uint256 totalCostAmount = totalCostEth.mulDown(_getTotalCostTokenPrice(payingToken));
        require(totalCostAmount <= totalCostLimit, 'TX_COST_ABOVE_LIMIT');
        wallet.withdraw(payingToken, totalCostAmount, wallet.feeCollector(), REDEEM_GAS_NOTE);
        delete _initialGas;
    }

    function _getTotalCostTokenPrice(address payingToken) private view returns (uint256) {
        address wrappedNativeToken = wallet.wrappedNativeToken();
        return
            payingToken == Denominations.NATIVE_TOKEN || payingToken == wrappedNativeToken
                ? FixedPoint.ONE
                : IPriceOracle(wallet.priceOracle()).getPrice(payingToken, wrappedNativeToken);
    }
}
