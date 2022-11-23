pragma solidity =0.8.17;

import "../mockContracts/ValidatorSetHbbftMock.sol";

/// @dev Stores the current validator set and contains the logic for choosing new validators
/// before each staking epoch. The logic uses a random seed generated and stored by the `RandomHbbft` contract.
contract ValidatorSetHbbftV2 is ValidatorSetHbbftMock {
    bool public testValue;

    function test() public returns (bool) {
        testValue = true;
        return true;
    }
}
