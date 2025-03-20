// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DigitalLegacy {
    struct UserInfo {
        string encryptedData;
        address[] beneficiaries;
        bool isDeceased;
        uint256 lastUpdated;
        bool isRegistered;
        uint256 registrationDate;
        uint256 deathDate;
        uint256 requiredSignatures;
        uint256[] assetCategories;
    }

    struct AssetCategory {
        string name;
        bool exists;
        uint256 totalAssets;
        address[] beneficiaries;
        uint256[] percentages;
    }

    mapping(address => UserInfo) public users;
    mapping(address => mapping(uint256 => uint256)) public userCategoryBalances;
    mapping(address => mapping(address => bool)) public hasSigned;
    mapping(address => bool) public oracles;
    mapping(address => bool) public admins;
    mapping(uint256 => AssetCategory) public categories;
    
    uint256 public totalUsers;
    uint256 public totalAssets;
    uint256 public totalCategories;
    bool public isPaused;
    
    uint256 private constant MIN_BENEFICIARIES = 1;
    uint256 private constant MAX_BENEFICIARIES = 10;
    uint256 private constant COOLDOWN_PERIOD = 7 days;
    uint256 private constant MAX_UPDATE_FREQUENCY = 30 days;
    uint256 private constant MIN_SIGNATURES = 2;
    uint256 private constant MAX_SIGNATURES = 5;
    
    event UserRegistered(address indexed user, uint256 timestamp);
    event UserUpdated(address indexed user, uint256 timestamp);
    event DeathVerified(address indexed user, address indexed oracle, uint256 timestamp);
    event AssetsTransferred(address indexed user, address[] beneficiaries, uint256 amount);
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event ContractPaused();
    event ContractUnpaused();
    event CategoryCreated(uint256 indexed categoryId, string name);
    event CategoryUpdated(uint256 indexed categoryId, string name);
    event AssetAddedToCategory(uint256 indexed categoryId, uint256 amount);
    event BeneficiarySigned(address indexed user, address indexed beneficiary);
    event EmergencyWithdraw(address indexed admin, uint256 amount);
    
    modifier onlyAdmin() {
        require(admins[msg.sender], "Caller is not an admin");
        _;
    }
    
    modifier onlyOracle() {
        require(oracles[msg.sender], "Caller is not an oracle");
        _;
    }
    
    modifier onlyRegistered() {
        require(users[msg.sender].isRegistered, "User not registered");
        _;
    }
    
    modifier notPaused() {
        require(!isPaused, "Contract is paused");
        _;
    }
    
    modifier notDeceased() {
        require(!users[msg.sender].isDeceased, "User is deceased");
        _;
    }
    
    modifier validCategory(uint256 categoryId) {
        require(categories[categoryId].exists, "Category does not exist");
        _;
    }
    
    modifier hasEnoughSignatures(address user) {
        uint256 count;
        for(uint i; i < users[user].beneficiaries.length;) {
            if(hasSigned[users[user].beneficiaries[i]][user]) count++;
            unchecked { ++i; }
        }
        require(count >= users[user].requiredSignatures, "Not enough signatures");
        _;
    }

    constructor() {
        admins[msg.sender] = true;
    }

    function registerUser(
        string calldata _encryptedData,
        address[] calldata _beneficiaries,
        uint256 _requiredSignatures
    ) external notPaused notDeceased {
        require(bytes(_encryptedData).length > 0, "Encrypted data cannot be empty");
        require(_beneficiaries.length >= MIN_BENEFICIARIES, "Too few beneficiaries");
        require(_beneficiaries.length <= MAX_BENEFICIARIES, "Too many beneficiaries");
        require(_requiredSignatures >= MIN_SIGNATURES && _requiredSignatures <= MAX_SIGNATURES, "Invalid signature count");
        require(_requiredSignatures <= _beneficiaries.length, "Too many required signatures");
        
        users[msg.sender] = UserInfo({
            encryptedData: _encryptedData,
            beneficiaries: _beneficiaries,
            isDeceased: false,
            lastUpdated: block.timestamp,
            isRegistered: true,
            registrationDate: block.timestamp,
            deathDate: 0,
            requiredSignatures: _requiredSignatures,
            assetCategories: new uint256[](0)
        });
        
        unchecked { ++totalUsers; }
        emit UserRegistered(msg.sender, block.timestamp);
    }

    function updateUserInfo(
        string calldata _encryptedData,
        address[] calldata _beneficiaries,
        uint256 _requiredSignatures
    ) external notPaused notDeceased onlyRegistered {
        require(block.timestamp >= users[msg.sender].lastUpdated + COOLDOWN_PERIOD, "Cooldown period not over");
        require(block.timestamp <= users[msg.sender].lastUpdated + MAX_UPDATE_FREQUENCY, "Update frequency exceeded");
        require(_beneficiaries.length >= MIN_BENEFICIARIES, "Too few beneficiaries");
        require(_beneficiaries.length <= MAX_BENEFICIARIES, "Too many beneficiaries");
        require(_requiredSignatures >= MIN_SIGNATURES && _requiredSignatures <= MAX_SIGNATURES, "Invalid signature count");
        require(_requiredSignatures <= _beneficiaries.length, "Too many required signatures");
        
        users[msg.sender].encryptedData = _encryptedData;
        users[msg.sender].beneficiaries = _beneficiaries;
        users[msg.sender].requiredSignatures = _requiredSignatures;
        users[msg.sender].lastUpdated = block.timestamp;
        
        emit UserUpdated(msg.sender, block.timestamp);
    }

    function verifyDeath(address user) external onlyOracle notPaused {
        require(users[user].isRegistered, "User not registered");
        require(!users[user].isDeceased, "User already deceased");
        
        users[user].isDeceased = true;
        users[user].deathDate = block.timestamp;
        
        emit DeathVerified(user, msg.sender, block.timestamp);
    }

    function transferAssets(address user) external onlyOracle notPaused hasEnoughSignatures(user) {
        require(users[user].isRegistered, "User not registered");
        require(users[user].isDeceased, "User is not deceased");
        
        uint256 totalUserAssets = 0;
        for(uint i; i < users[user].assetCategories.length;) {
            uint256 categoryId = users[user].assetCategories[i];
            totalUserAssets += userCategoryBalances[user][categoryId];
            unchecked { ++i; }
        }
        
        require(totalUserAssets > 0, "No assets to transfer");
        
        uint256 share = totalUserAssets / users[user].beneficiaries.length;
        uint256 remainder = totalUserAssets % users[user].beneficiaries.length;
        
        for(uint i; i < users[user].beneficiaries.length;) {
            uint256 transferAmount = share;
            if(i == users[user].beneficiaries.length - 1) {
                transferAmount += remainder;
            }
            
            (bool success, ) = users[user].beneficiaries[i].call{value: transferAmount}("");
            require(success, "Transfer failed");
            unchecked { ++i; }
        }
        
        // Reset user's category balances
        for(uint i; i < users[user].assetCategories.length;) {
            uint256 categoryId = users[user].assetCategories[i];
            categories[categoryId].totalAssets -= userCategoryBalances[user][categoryId];
            userCategoryBalances[user][categoryId] = 0;
            unchecked { ++i; }
        }
        
        users[user].assetCategories = new uint256[](0);
        totalAssets -= totalUserAssets;
        
        emit AssetsTransferred(user, users[user].beneficiaries, totalUserAssets);
    }

    function addOracle(address oracle) external onlyAdmin notPaused {
        require(!oracles[oracle], "Already an oracle");
        oracles[oracle] = true;
        emit OracleAdded(oracle);
    }

    function removeOracle(address oracle) external onlyAdmin notPaused {
        require(oracles[oracle], "Not an oracle");
        oracles[oracle] = false;
        emit OracleRemoved(oracle);
    }

    function addAdmin(address admin) external onlyAdmin notPaused {
        require(!admins[admin], "Already an admin");
        admins[admin] = true;
        emit AdminAdded(admin);
    }

    function removeAdmin(address admin) external onlyAdmin notPaused {
        require(admin != msg.sender, "Cannot remove self");
        require(admins[admin], "Not an admin");
        admins[admin] = false;
        emit AdminRemoved(admin);
    }

    function pauseContract() external onlyAdmin {
        require(!isPaused, "Contract already paused");
        isPaused = true;
        emit ContractPaused();
    }

    function unpauseContract() external onlyAdmin {
        require(isPaused, "Contract not paused");
        isPaused = false;
        emit ContractUnpaused();
    }

    function createCategory(string calldata name) external onlyAdmin notPaused {
        uint256 categoryId = totalCategories;
        unchecked { ++totalCategories; }
        categories[categoryId] = AssetCategory({
            name: name,
            exists: true,
            totalAssets: 0,
            beneficiaries: new address[](0),
            percentages: new uint256[](0)
        });
        emit CategoryCreated(categoryId, name);
    }

    function updateCategory(uint256 categoryId, string calldata name) external onlyAdmin notPaused validCategory(categoryId) {
        categories[categoryId].name = name;
        emit CategoryUpdated(categoryId, name);
    }

    function addAssetToCategory(uint256 categoryId, uint256 amount) external payable notPaused validCategory(categoryId) {
        require(msg.value > 0, "Amount must be greater than 0");
        categories[categoryId].totalAssets += amount;
        userCategoryBalances[msg.sender][categoryId] += amount;
        totalAssets += amount;
        if(!contains(users[msg.sender].assetCategories, categoryId)) {
            users[msg.sender].assetCategories.push(categoryId);
        }
        emit AssetAddedToCategory(categoryId, amount);
    }

    function setCategoryBeneficiaries(
        uint256 categoryId,
        address[] calldata _beneficiaries,
        uint256[] calldata _percentages
    ) external onlyRegistered validCategory(categoryId) {
        require(_beneficiaries.length == _percentages.length, "Array lengths must match");
        require(_beneficiaries.length <= MAX_BENEFICIARIES, "Too many beneficiaries");
        
        uint256 totalPercentage;
        for(uint i; i < _percentages.length;) {
            totalPercentage += _percentages[i];
            unchecked { ++i; }
        }
        require(totalPercentage == 100, "Percentages must sum to 100");
        
        categories[categoryId].beneficiaries = _beneficiaries;
        categories[categoryId].percentages = _percentages;
    }

    function signForUser(address user) external notPaused {
        require(users[user].isRegistered, "User not registered");
        require(users[user].isDeceased, "User is not deceased");
        require(contains(users[user].beneficiaries, msg.sender), "Not a beneficiary");
        require(!hasSigned[msg.sender][user], "Already signed");
        
        hasSigned[msg.sender][user] = true;
        emit BeneficiarySigned(user, msg.sender);
    }

    function emergencyWithdraw() external onlyAdmin notPaused {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw");
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
        
        totalAssets = 0;
        emit EmergencyWithdraw(msg.sender, amount);
    }

    function getCategory(uint256 categoryId) external view validCategory(categoryId) returns (
        string memory name,
        bool exists,
        uint256 categoryTotalAssets,
        address[] memory beneficiaries,
        uint256[] memory percentages
    ) {
        AssetCategory storage c = categories[categoryId];
        return (
            c.name,
            c.exists,
            c.totalAssets,
            c.beneficiaries,
            c.percentages
        );
    }

    function getUser(address user) external view returns (
        string memory data,
        address[] memory beneficiaries,
        bool isDeceased,
        uint256 lastUpdated,
        bool isRegistered,
        uint256 registrationDate,
        uint256 deathDate,
        uint256 requiredSignatures,
        uint256[] memory assetCategories
    ) {
        UserInfo storage u = users[user];
        return (
            u.encryptedData,
            u.beneficiaries,
            u.isDeceased,
            u.lastUpdated,
            u.isRegistered,
            u.registrationDate,
            u.deathDate,
            u.requiredSignatures,
            u.assetCategories
        );
    }

    function getCategoryBalance(address user, uint256 categoryId) external view validCategory(categoryId) returns (uint256) {
        return userCategoryBalances[user][categoryId];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getContractStatus() external view returns (bool) {
        return isPaused;
    }

    function getTotalUsers() external view returns (uint256) {
        return totalUsers;
    }

    function getTotalAssets() external view returns (uint256) {
        return totalAssets;
    }

    function checkAdmin(address admin) external view returns (bool) {
        return admins[admin];
    }

    function checkOracle(address oracle) external view returns (bool) {
        return oracles[oracle];
    }

    function contains(address[] memory array, address value) internal pure returns (bool) {
        for(uint i; i < array.length;) {
            if(array[i] == value) return true;
            unchecked { ++i; }
        }
        return false;
    }

    function contains(uint256[] memory array, uint256 value) internal pure returns (bool) {
        for(uint i; i < array.length;) {
            if(array[i] == value) return true;
            unchecked { ++i; }
        }
        return false;
    }

    receive() external payable {
        totalAssets += msg.value;
    }
}