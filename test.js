const hre = require("hardhat");

async function main() {
    // Get the deployed contract address
    const DigitalLegacy = await hre.ethers.getContractFactory("DigitalLegacy");
    const digitalLegacy = await DigitalLegacy.deploy();
    await digitalLegacy.waitForDeployment();
    const contractAddress = await digitalLegacy.getAddress();
    console.log("Contract deployed to:", contractAddress);

    // Get the signer (account that deployed the contract)
    const [signer] = await hre.ethers.getSigners();
    console.log("Testing with account:", signer.address);

    // Test basic contract functionality
    try {
        // Test registering a user
        const beneficiaries = [signer.address]; // Using the same address as beneficiary for testing
        const encryptedData = "Test encrypted data";
        const registerTx = await digitalLegacy.registerUser(encryptedData, beneficiaries);
        await registerTx.wait();
        console.log("Successfully registered user!");

        // Test retrieving user details
        const [retrievedData, retrievedBeneficiaries, isDeceased] = await digitalLegacy.getUser(signer.address);
        console.log("\nContract is working correctly!");
        console.log("Encrypted Data:", retrievedData);
        console.log("Beneficiaries:", retrievedBeneficiaries);
        console.log("Is Deceased:", isDeceased);

        // Test verifying death
        const verifyTx = await digitalLegacy.verifyDeath(signer.address);
        await verifyTx.wait();
        console.log("\nSuccessfully verified death!");

        // Test transferring assets
        const transferTx = await digitalLegacy.transferAssets(signer.address);
        await transferTx.wait();
        console.log("Successfully transferred assets!");

    } catch (error) {
        console.error("Error testing contract:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 