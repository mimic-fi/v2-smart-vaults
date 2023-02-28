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

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '@mimic-fi/v2-smart-vault/contracts/ISmartVault.sol';
import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';
import '@mimic-fi/v2-helpers/contracts/utils/ERC20Helpers.sol';

import './IAction.sol';
import './base/GasLimitedAction.sol';
import './base/ParameterizedAction.sol';
import './base/RelayedAction.sol';
import './base/TimeLockedAction.sol';
import './base/TokenIndexedAction.sol';

/**
 * @title BaseAction
 * @dev Simple action implementation with a Smart Vault reference and using the Authorizer mixin
 */
abstract contract BaseAction is
    IAction,
    Authorizer,
    GasLimitedAction,
    ParameterizedAction,
    RelayedAction,
    TimeLockedAction,
    TokenIndexedAction
{
    using SafeERC20 for IERC20;

    // Smart Vault reference
    ISmartVault private _smartVault;

    /**
     * @dev Action params data struct
     * @param admin Address to be granted authorize and unauthorize permissions
     * @param smartVault Address of the smart vault to reference
     * @param gasPriceLimit Gas price limit expressed in the native token
     * @param priorityFeeLimit Priority fee limit expressed in the native token
     * @param txCostLimit Transaction cost limit to be set
     * @param relayers List of relayers to be added to the allow-list
     * @param initialDelay Initial delay to be set for the time-lock
     * @param delay Time-lock delay to be used after the initial delay has passed
     * @param tokensAcceptanceType Tokens acceptance type to be set
     * @param tokens List of tokens to be added to the token acceptance list
     * @param keys Custom params keys
     * @param values Custom params values
     */
    struct Params {
        address admin;
        address smartVault;
        uint256 gasPriceLimit;
        uint256 priorityFeeLimit;
        uint256 txCostLimit;
        address[] relayers;
        uint256 initialDelay;
        uint256 delay;
        ITokenIndexedAction.TokensAcceptanceType tokensAcceptanceType;
        address[] tokens;
        bytes32[] keys;
        bytes32[] values;
    }

    /**
     * @dev Creates a new BaseAction
     * @param params Action parameters
     */
    constructor(Params memory params)
        GasLimitedAction(params.gasPriceLimit, params.priorityFeeLimit)
        RelayedAction(params.txCostLimit, params.relayers)
        TimeLockedAction(params.initialDelay, params.delay)
        TokenIndexedAction(params.tokensAcceptanceType, params.tokens)
        ParameterizedAction(params.keys, params.values)
    {
        _smartVault = ISmartVault(params.smartVault);
        _authorize(params.admin, Authorizer.authorize.selector);
        _authorize(params.admin, Authorizer.unauthorize.selector);
    }

    /**
     * @dev It allows receiving native token transfers
     */
    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Tells the address or the Smart Vault referenced by the action
     */
    function getSmartVault() public view override returns (ISmartVault) {
        return _smartVault;
    }

    /**
     * @dev Tells the balance of the action for a given token
     * @param token Address of the token querying the balance of
     * @notice Denominations.NATIVE_TOKEN_ADDRESS can be used to query the native token balance
     */
    function getActionBalance(address token) public view returns (uint256) {
        return ERC20Helpers.balanceOf(token, address(this));
    }

    /**
     * @dev Tells the balance of the Smart Vault for a given token
     * @param token Address of the token querying the balance of
     * @notice Denominations.NATIVE_TOKEN_ADDRESS can be used to query the native token balance
     */
    function getSmartVaultBalance(address token) public view returns (uint256) {
        return ERC20Helpers.balanceOf(token, address(_smartVault));
    }

    /**
     * @dev Tells the total balance for a given token
     * @param token Address of the token querying the balance of
     * @notice Denominations.NATIVE_TOKEN_ADDRESS can be used to query the native token balance
     */
    function getTotalBalance(address token) public view returns (uint256) {
        return getActionBalance(token) + getSmartVaultBalance(token);
    }

    /**
     * @dev Transfers action's assets to the Smart Vault
     * @param token Address of the token to be transferred
     * @param amount Amount of tokens to be transferred
     * @notice Denominations.NATIVE_TOKEN_ADDRESS can be used to query the native token balance
     */
    function transferToSmartVault(address token, uint256 amount) external auth {
        _transferToSmartVault(token, amount);
    }

    /**
     * @dev Internal function to transfer action's assets to the Smart Vault
     * @param token Address of the token to be transferred
     * @param amount Amount of tokens to be transferred
     * @notice Denominations.NATIVE_TOKEN_ADDRESS can be used to query the native token balance
     */
    function _transferToSmartVault(address token, uint256 amount) internal {
        ERC20Helpers.transfer(token, address(_smartVault), amount);
    }

    /**
     * @dev Performs a gas cost payment to the Smart Vault's fee collector in an arbitrary token
     * @param token Address of the paying token
     * @param amount Amount of tokens to be transferred to the Smart Vault's fee collector
     * @param data Redeem gas cost note
     */
    function _redeemGasCost(address token, uint256 amount, bytes memory data) internal override {
        _smartVault.withdraw(token, amount, _smartVault.feeCollector(), data);
    }

    /**
     * @dev Tells whether the given token is either the native or wrapped native token
     * @param token Address of the token being queried
     */
    function _getNativeTokenPrice(address token) internal view virtual override returns (uint256) {
        return _isWrappedOrNativeToken(token) ? FixedPoint.ONE : _smartVault.getPrice(_wrappedNativeToken(), token);
    }

    /**
     * @dev Tells whether a token is either the native or wrapped native token
     * @param token Address of the token being queried
     */
    function _isWrappedOrNativeToken(address token) internal view returns (bool) {
        return Denominations.isNativeToken(token) || token == _wrappedNativeToken();
    }

    /**
     * @dev Tells the address of the wrapped native token configured in the Smart Vault
     */
    function _wrappedNativeToken() internal view returns (address) {
        return _smartVault.wrappedNativeToken();
    }

    /**
     * @dev Validates the execution of an action indexed by a token
     */
    function _validateAction(address token) internal {
        _validateGasLimit();
        _validateTimeLock();
        _validateTokenAcceptance(token);
    }
}
