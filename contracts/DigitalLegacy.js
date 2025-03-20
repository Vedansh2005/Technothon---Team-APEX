const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DigitalLegacy", function () {
    let DigitalLegacy, digitalLegacy, owner, addr1, addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        DigitalLegacy = await ethers.getContractFactory("DigitalLegacy");
        digitalLegacy = await DigitalLegacy.deploy();
    });

    it("Should register a user", async function () {
        await digitalLegacy.registerUser("encryptedData", [addr1.address]);
        const user = await digitalLegacy.getUser(owner.address);
        expect(user.encryptedData).to.equal("encryptedData");
        expect(user.beneficiaries[0]).to.equal(addr1.address);
    });

    it("Should verify death and transfer assets", async function () {
        await digitalLegacy.registerUser("encryptedData", [addr1.address, addr2.address]);
        await digitalLegacy.verifyDeath(owner.address);

        // Send ETH to the contract
        await owner.sendTransaction({
            to: digitalLegacy.address,
            value: ethers.utils.parseEther("1.0")
        });

        await digitalLegacy.transferAssets(owner.address);

        const balance1 = await ethers.provider.getBalance(addr1.address);
        const balance2 = await ethers.provider.getBalance(addr2.address);
        expect(balance1).to.equal(ethers.utils.parseEther("0.5"));
        expect(balance2).to.equal(ethers.utils.parseEther("0.5"));
    });
});