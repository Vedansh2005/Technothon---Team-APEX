const hre = require("hardhat");

async function main() {
    const DigitalLegacy = await hre.ethers.getContractFactory("DigitalLegacy");
    const digitalLegacy = await DigitalLegacy.deploy();

    await digitalLegacy.deployed();

    console.log("DigitalLegacy deployed to:", digitalLegacy.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});