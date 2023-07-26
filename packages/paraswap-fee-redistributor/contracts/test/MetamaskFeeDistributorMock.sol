// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';

import '@mimic-fi/v2-helpers/contracts/utils/Denominations.sol';

import '../interfaces/IMetamaskFeeDistributor.sol';

contract MetamaskFeeDistributorMock is IMetamaskFeeDistributor {
    // List of assigned balances from token => owner => balance
    mapping (address => mapping (address => uint256)) internal _balances;

    function available(address token, address owner) public view override returns (uint256) {
        return _balances[token][owner];
    }

    function assign(address token, uint256 amount, address owner) external payable {
        if (token == address(0)) {
            require(msg.value == amount, 'METAMASK_DISTRIBUTOR_BAD_VALUE');
        } else {
            require(msg.value == 0, 'METAMASK_DISTRIBUTOR_BAD_VALUE');
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }

        _balances[token][owner] += amount;
    }

    function withdraw(address[] memory tokens) external override {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = available(tokens[i], msg.sender);
            _balances[tokens[i]][msg.sender] -= amount;
            if (tokens[i] == address(0)) Address.sendValue(payable(msg.sender), amount);
            else IERC20(tokens[i]).transfer(msg.sender, amount);
        }
    }
}
