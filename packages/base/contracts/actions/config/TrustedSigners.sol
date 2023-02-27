// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';

/**
 * @dev Library to operate trusted signers configs.
 * It allows defining a list of signers that must verify an arbitrary message to fulfill the requirements.
 */
library TrustedSigners {
    using EnumerableSet for EnumerableSet.AddressSet;

    /**
     * @dev Trusted signers config
     * @param required Whether a trusted signer signature is required or not
     * @param signers List of allowed signers
     */
    struct Config {
        bool required;
        EnumerableSet.AddressSet signers;
    }

    /**
     * @dev Reverts if the given trusted signers config is complied
     * @param self Trusted signers config to be evaluated
     * @param message Message signed to be checked
     * @param sig Signature to be checked
     */
    function validate(Config storage self, bytes32 message, bytes memory sig) internal view {
        require(isValid(self, message, sig), 'TRUSTED_SIGNER_FORBIDDEN');
    }

    /**
     * @dev Tells if a signatures config is complied or not
     * @param self Trusted signers config to be checked
     * @param message Message signed to be checked
     * @param sig Signature to be checked
     */
    function isValid(Config storage self, bytes32 message, bytes memory sig) internal view returns (bool) {
        return !isRequired(self) || isValidSigner(self, message, sig);
    }

    /**
     * @dev Tells if signatures are required or not
     * @param self Trusted signers config to be checked
     */
    function isRequired(Config storage self) internal view returns (bool) {
        return self.required;
    }

    /**
     * @dev Tells if signatures are required or not
     * @param self Trusted signers config to be checked
     * @param message Message signed to be checked
     * @param sig Signature to be checked
     */
    function isValidSigner(Config storage self, bytes32 message, bytes memory sig) internal view returns (bool) {
        return isSigner(self, ECDSA.recover(ECDSA.toEthSignedMessageHash(message), sig));
    }

    /**
     * @dev Tells if an oracle signature config includes a signer or not
     * @param self Trusted signers config to be checked
     * @param signer Address of the signer being queried
     */
    function isSigner(Config storage self, address signer) internal view returns (bool) {
        return self.signers.contains(signer);
    }

    /**
     * @dev Tells the list of signers allowed for an oracle signature config
     * @param self Trusted signers config querying the signers of
     */
    function getSigners(Config storage self) internal view returns (address[] memory) {
        return self.signers.values();
    }

    /**
     * @dev Configure an oracle signatures config
     * @param self Trusted signers config to be updated
     * @param required Whether oracle signatures will be required or not
     * @param signers List of addresses to be set as the allowed signers
     */
    function set(Config storage self, bool required, address[] memory signers) internal {
        setRequired(self, required);
        setSigners(self, signers);
    }

    /**
     * @dev Makes signature oracle required or not
     * @param self Trusted signers config to be updated
     * @param required Whether oracle signatures will be required or not
     */
    function setRequired(Config storage self, bool required) internal {
        self.required = required;
    }

    /**
     * @dev Sets the list of allowed signers of an oracle signatures config
     * @param self Trusted signers config to be updated
     * @param signers List of addresses to be set as the allowed signers
     */
    function setSigners(Config storage self, address[] memory signers) internal {
        cleanSigners(self);
        addSigners(self, signers);
    }

    /**
     * @dev Cleans the list of allowed signers of an oracle signatures config
     * @param self Trusted signers config to be updated
     */
    function cleanSigners(Config storage self) internal {
        address[] memory signers = getSigners(self);
        for (uint256 i = 0; i < signers.length; i++) removeSigner(self, signers[i]);
    }

    /**
     * @dev Removes a signer from an oracle signatures config
     * @param self Trusted signers config to be updated
     * @param signer Address of the signer to be removed
     * @return True if the signer was removed from the list, that is if it was present
     */
    function removeSigner(Config storage self, address signer) internal returns (bool) {
        return self.signers.remove(signer);
    }

    /**
     * @dev Adds a list of signers to an oracle signatures config
     * @param self Trusted signers config to be updated
     * @param signers List of addresses to be added to the list of allowed signers
     */
    function addSigners(Config storage self, address[] memory signers) internal {
        for (uint256 i = 0; i < signers.length; i++) addSigner(self, signers[i]);
    }

    /**
     * @dev Adds a signer to an oracle signatures config
     * @param self Trusted signers config to be updated
     * @param signer Address of the signer to be added to the list of allowed signers, it cannot be zero
     * @return True if the signer was added to the list, that is if it was not present
     */
    function addSigner(Config storage self, address signer) internal returns (bool) {
        require(signer != address(0), 'ORACLE_SIGNATURES_SIGNER_ZERO');
        return self.signers.add(signer);
    }
}
