// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16 <0.7.0;

interface IBinGov {
    function mintAirdrop(address to, uint256 dX) external returns (uint256);
}
