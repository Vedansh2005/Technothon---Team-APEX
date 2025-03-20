// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DigitalLegacy {
    struct User {
        string encryptedData; // Encrypted asset information
        address[] beneficiaries; // List of beneficiaries
        bool isDeceased; // Death status
    }

    mapping(address => User) public users;

    // Register a new user
    function registerUser(string memory _encryptedData, address[] memory _beneficiaries) public {
        users[msg.sender] = User({
            encryptedData: _encryptedData,
            beneficiaries: _beneficiaries,
            isDeceased: false
        });
    }

    // Verify death (callable by oracle or trusted entity)
    function verifyDeath(address userAddress) public {
        users[userAddress].isDeceased = true;
    }

    // Transfer assets to beneficiaries
    function transferAssets(address userAddress) public {
        require(users[userAddress].isDeceased, "User is not deceased");
        for (uint i = 0; i < users[userAddress].beneficiaries.length; i++) {
            // Logic to transfer assets (e.g., send ETH or tokens)
            payable(users[userAddress].beneficiaries[i]).transfer(address(this).balance / users[userAddress].beneficiaries.length);
        }
    }

    // Get user details
    function getUser(address userAddress) public view returns (string memory, address[] memory, bool) {
        User memory user = users[userAddress];
        return (user.encryptedData, user.beneficiaries, user.isDeceased);
    }
}