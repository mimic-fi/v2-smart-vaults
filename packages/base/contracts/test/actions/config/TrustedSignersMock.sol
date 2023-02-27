// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import '../../../actions/config/TrustedSigners.sol';

contract TrustedSignersMock {
    using TrustedSigners for TrustedSigners.Config;

    TrustedSigners.Config internal trustedSigners;

    function validate(bytes32 message, bytes memory signature) external view {
        trustedSigners.validate(message, signature);
    }

    function isValid(bytes32 message, bytes memory signature) external view returns (bool) {
        return trustedSigners.isValid(message, signature);
    }

    function isRequired() external view returns (bool) {
        return trustedSigners.isRequired();
    }

    function isSigner(address signer) external view returns (bool) {
        return trustedSigners.isSigner(signer);
    }

    function getSigners() external view returns (address[] memory) {
        return trustedSigners.getSigners();
    }

    function set(bool required, address[] memory signers) external {
        trustedSigners.set(required, signers);
    }

    function setRequired(bool required) external {
        trustedSigners.setRequired(required);
    }

    function setSigners(address[] memory signers) external {
        trustedSigners.setSigners(signers);
    }

    function addSigners(address[] memory signers) external {
        trustedSigners.addSigners(signers);
    }

    function addSigner(address signer) external {
        trustedSigners.addSigner(signer);
    }

    function cleanSigners() external {
        trustedSigners.cleanSigners();
    }

    function removeSigner(address signer) external {
        trustedSigners.removeSigner(signer);
    }
}
