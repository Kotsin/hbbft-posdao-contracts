pragma solidity =0.8.17;

import "./base/BlockRewardHbbftCoins.sol";

contract BlockRewardHbbftV2 is BlockRewardHbbftCoins {
    address _systemAddress;
    bool public testValue;

    function test() public returns (bool) {
        testValue = true;
        return true;
    }
}
