pragma solidity =0.8.17;

contract Upgrader {
    function execTransactionFromModule(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        // if (msg.sender != module) revert NotAuthorized(msg.sender);
        if (operation == 1) (success, ) = to.delegatecall(data);
        else (success, ) = to.call{value: value}(data);
        require(success, "unsuccessful");
    }
}
