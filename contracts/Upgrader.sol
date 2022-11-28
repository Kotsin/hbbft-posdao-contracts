pragma solidity =0.8.17;
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Upgrader is AccessControl {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    function execTransaction(
        address payable to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external onlyRole(UPGRADER_ROLE) returns (bool success) {
        if (operation == 1) (success, ) = to.delegatecall(data);
        else (success, ) = to.call{value: value}(data);
        require(success, "unsuccessful");
    }
}
