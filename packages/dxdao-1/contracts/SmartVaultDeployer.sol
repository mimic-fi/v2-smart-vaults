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

import '@mimic-fi/v2-wallet/contracts/Wallet.sol';
import '@mimic-fi/v2-helpers/contracts/utils/Arrays.sol';
import '@mimic-fi/v2-registry/contracts/registry/IRegistry.sol';
import '@mimic-fi/v2-smart-vaults-base/contracts/BaseDeployer.sol';

import './actions/Wrapper.sol';

// solhint-disable avoid-low-level-calls

contract SmartVaultDeployer is BaseDeployer {
    struct Params {
        address owner;
        address[] managers;
        IRegistry registry;
        WalletParams walletParams;
        PriceOracleParams priceOracleParams;
        RelayedActionParams relayedActionParams;
    }

    function deploy(Params memory params) external {
        PriceOracle priceOracle = _createPriceOracle(params.registry, params.priceOracleParams);
        Wallet wallet = _createWallet(params.registry, params.walletParams, NO_STRATEGY, address(priceOracle));
        _setupAction(wallet, params);
        _revokeAdminPermissions(wallet, address(this));
    }

    function _setupAction(Wallet wallet, Params memory params) internal {
        // Create and setup action
        Wrapper wrapper = new Wrapper(address(this), wallet);
        address[] memory executors = Arrays.from(params.owner, params.managers, params.relayedActionParams.relayers);
        _setupActionExecutors(wrapper, executors, wrapper.call.selector);
        _setupRelayedAction(wrapper, params.owner, params.relayedActionParams);
        _setupWithdrawalAction(wrapper, params.owner, params.owner);

        // Transfer admin permissions from deployer to requested owner
        _grantAdminPermissions(wrapper, params.owner);
        _revokeAdminPermissions(wrapper, address(this));

        // Authorize action to wrap and withdraw from wallet
        wallet.authorize(address(wrapper), wallet.wrap.selector);
        wallet.authorize(address(wrapper), wallet.withdraw.selector);
    }
}
