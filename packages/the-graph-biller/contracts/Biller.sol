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

import '@mimic-fi/v2-swap-connector/contracts/ISwapConnector.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/actions/swap/BaseSwapper.sol';

import './IBilling.sol';

contract Biller is BaseSwapper {
    // Base gas amount charged to cover gas payment
    uint256 public constant override BASE_GAS = 20e3;

    // Address of the billing contract
    address public billing;

    // Address that will pay the subscription
    address public subscriber;

    /**
     * @dev Emitted every time the billing contract is set
     */
    event BillingSet(address indexed billing);

    /**
     * @dev Emitted every time the subscriber address is set
     */
    event SubscriberSet(address indexed subscriber);

    /**
     * @dev Biller action config
     * @param billing Address of the billing contract
     * @param subscriber Address of the subscriber account
     * @param swapperConfig Swapper action configuration parameters
     */
    struct BillerConfig {
        address billing;
        address subscriber;
        SwapperConfig swapperConfig;
    }

    /**
     * @dev Creates a new Biller action
     * @param config Biller config
     */
    constructor(BillerConfig memory config) BaseSwapper(config.swapperConfig) {
        _setBilling(config.billing);
        _setSubscriber(config.subscriber);
    }

    /**
     * @dev Sets the billing contract. Sender must be authorized.
     * @param newBilling Address of the new billing contract to be set
     */
    function setBilling(address newBilling) external auth {
        _setBilling(newBilling);
    }

    /**
     * @dev Sets the subscriber account. Sender must be authorized.
     * @param newSubscriber Address of the new subscriber account to be set
     */
    function setSubscriber(address newSubscriber) external auth {
        _setSubscriber(newSubscriber);
    }

    /**
     * @dev Execution function
     */
    function call(address tokenIn, uint256 amountIn, uint256 slippage) external actionCall(tokenIn, amountIn) {
        smartVault.collect(tokenIn, subscriber, amountIn, new bytes(0));

        // Swap token in for subscription token if necessary
        address tokenOut = _getApplicableTokenOut(tokenIn);
        uint256 amountOut = tokenIn == tokenOut
            ? amountIn
            : smartVault.swap(
                uint8(ISwapConnector.Source.UniswapV2),
                tokenIn,
                tokenOut,
                amountIn,
                ISmartVault.SwapLimit.Slippage,
                slippage,
                new bytes(0)
            );

        // Approve tokens to the billing contract
        bytes memory approveCalldata = abi.encodeWithSelector(IERC20.approve.selector, billing, amountOut);
        smartVault.call(tokenOut, approveCalldata, 0, new bytes(0));

        // Pay subscription to billing contract
        bytes memory billingCalldata = abi.encodeWithSelector(IBilling.addTo.selector, subscriber, amountOut);
        smartVault.call(billing, billingCalldata, 0, new bytes(0));
    }

    /**
     * @dev Sets the billing contract. Sender must be authorized.
     * @param newBilling Address of the new billing contract to be set
     */
    function _setBilling(address newBilling) internal {
        require(newBilling != address(0), 'BILLER_BILLING_ZERO');
        billing = newBilling;
        emit BillingSet(newBilling);
    }

    /**
     * @dev Sets the subscriber account
     * @param newSubscriber Address of the new subscriber account to be set
     */
    function _setSubscriber(address newSubscriber) internal {
        require(subscriber != address(0), 'BILLER_SUBSCRIBER_ZERO');
        subscriber = newSubscriber;
        emit SubscriberSet(newSubscriber);
    }
}
