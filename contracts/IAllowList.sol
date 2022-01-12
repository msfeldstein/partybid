// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

/**
 * @title IAllowList
 * @author Anna Carroll
 */
interface IAllowList {
    function allowed(address _addr) external view returns (bool _bool);
}
