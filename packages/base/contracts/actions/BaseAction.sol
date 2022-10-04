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

import '@mimic-fi/v2-wallet/contracts/IWallet.sol';
import '@mimic-fi/v2-helpers/contracts/auth/Authorizer.sol';
import '@mimic-fi/v2-registry/contracts/implementations/BaseAuthorizedImplementation.sol';

import './IAction.sol';

/**
 * @title BaseAction
 * @dev Simple action implementation with a Wallet reference and using the Authorizer mixin
 */
contract BaseAction is IAction, BaseAuthorizedImplementation {
    bytes32 public constant override NAMESPACE = keccak256('ACTION');

    // Mimic Wallet reference
    IWallet public override wallet;

    /**
     * @dev Emitted every time a new wallet is set
     */
    event WalletSet(address indexed wallet);

    /**
     * @dev Creates a new BaseAction
     * @param admin Address to be granted authorize and unauthorize permissions
     * @param registry Address of the Mimic Registry
     */
    constructor(address admin, address registry) BaseAuthorizedImplementation(admin, registry) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Sets the Mimic Wallet tied to the Action. Sender must be authorized. It can be set only once.
     * @param newWallet Address of the wallet to be set
     */
    function setWallet(address newWallet) external auth {
        require(address(wallet) == address(0), 'WALLET_ALREADY_SET');
        _validateDependency(address(wallet), newWallet);
        wallet = IWallet(newWallet);
        emit WalletSet(newWallet);
    }
}
