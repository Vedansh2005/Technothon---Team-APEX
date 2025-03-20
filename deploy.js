const hre = require("hardhat");

async function main() {
    const DigitalLegacy = await hre.ethers.getContractFactory("DigitalLegacy");
    const digitalLegacy = await DigitalLegacy.deploy();

    await digitalLegacy.waitForDeployment();

    console.log("DigitalLegacy deployed to:", await digitalLegacy.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 