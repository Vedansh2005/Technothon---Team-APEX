const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DigitalLegacy", function () {
    let digitalLegacy;
    let owner;
    let addr1;
    let addr2;
    let addr3;
    let oracle;
    let admin;

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, oracle, admin] = await ethers.getSigners();
        digitalLegacy = await ethers.deployContract("DigitalLegacy");
        await digitalLegacy.waitForDeployment();
    });

    describe("Initial State", function () {
        it("Should set initial admin correctly", async function () {
            expect(await digitalLegacy.checkAdmin(owner.address)).to.be.true;
        });

        it("Should start with correct initial values", async function () {
            expect(await digitalLegacy.getTotalUsers()).to.equal(0);
            expect(await digitalLegacy.getTotalAssets()).to.equal(0);
            expect(await digitalLegacy.getContractStatus()).to.be.false;
        });
    });

    describe("User Registration", function () {
        it("Should register a user with valid data", async function () {
            const beneficiaries = [addr1.address, addr2.address];
            const requiredSignatures = 2;
            await digitalLegacy.connect(addr1).registerUser(
                "encrypted_data",
                beneficiaries,
                requiredSignatures
            );

            const user = await digitalLegacy.getUser(addr1.address);
            expect(user.isRegistered).to.be.true;
            expect(user.beneficiaries).to.deep.equal(beneficiaries);
            expect(user.requiredSignatures).to.equal(requiredSignatures);
        });

        it("Should fail with too few beneficiaries", async function () {
            await expect(
                digitalLegacy.connect(addr1).registerUser(
                    "encrypted_data",
                    [],
                    2
                )
            ).to.be.revertedWith("Too few beneficiaries");
        });

        it("Should fail with too many beneficiaries", async function () {
            const beneficiaries = Array(11).fill(addr1.address);
            await expect(
                digitalLegacy.connect(addr1).registerUser(
                    "encrypted_data",
                    beneficiaries,
                    2
                )
            ).to.be.revertedWith("Too many beneficiaries");
        });

        it("Should fail with empty encrypted data", async function () {
            await expect(
                digitalLegacy.connect(addr1).registerUser(
                    "",
                    [addr1.address],
                    2
                )
            ).to.be.revertedWith("Encrypted data cannot be empty");
        });

        it("Should fail with invalid signature count", async function () {
            await expect(
                digitalLegacy.connect(addr1).registerUser(
                    "encrypted_data",
                    [addr1.address],
                    1
                )
            ).to.be.revertedWith("Invalid signature count");
        });

        it("Should fail when contract is paused", async function () {
            await digitalLegacy.connect(owner).pauseContract();
            await expect(
                digitalLegacy.connect(addr1).registerUser(
                    "encrypted_data",
                    [addr1.address],
                    2
                )
            ).to.be.revertedWith("Contract is paused");
        });
    });

    describe("User Updates", function () {
        beforeEach(async function () {
            await digitalLegacy.connect(addr1).registerUser(
                "encrypted_data",
                [addr1.address, addr2.address],
                2
            );
        });

        it("Should update user information after cooldown period", async function () {
            // Fast forward time past cooldown period
            await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]); // 8 days
            await ethers.provider.send("evm_mine");

            await digitalLegacy.connect(addr1).updateUserInfo(
                "new_encrypted_data",
                [addr1.address, addr2.address],
                2
            );

            const [data, beneficiaries, isDeceased, lastUpdated, isRegistered, registrationDate, deathDate, requiredSignatures, assetCategories] = await digitalLegacy.getUser(addr1.address);
            expect(data).to.equal("new_encrypted_data");
        });

        it("Should fail to update before cooldown period", async function () {
            await expect(
                digitalLegacy.connect(addr1).updateUserInfo(
                    "new_encrypted_data",
                    [addr1.address, addr2.address],
                    2
                )
            ).to.be.revertedWith("Cooldown period not over");
        });

        it("Should fail to update when user is deceased", async function () {
            await digitalLegacy.connect(owner).addOracle(oracle.address);
            await digitalLegacy.connect(oracle).verifyDeath(addr1.address);
            
            await expect(
                digitalLegacy.connect(addr1).updateUserInfo(
                    "new_encrypted_data",
                    [addr1.address, addr2.address],
                    2
                )
            ).to.be.revertedWith("User is deceased");
        });
    });

    describe("Asset Categories", function () {
        beforeEach(async function () {
            await digitalLegacy.connect(owner).createCategory("Test Category");
        });

        it("Should create categories correctly", async function () {
            const [name, exists, totalAssets, beneficiaries, percentages] = await digitalLegacy.getCategory(0);
            expect(name).to.equal("Test Category");
            expect(exists).to.be.true;
            expect(totalAssets).to.equal(0);
            expect(beneficiaries).to.deep.equal([]);
            expect(percentages).to.deep.equal([]);
        });

        it("Should add assets to categories", async function () {
            const amount = ethers.parseEther("1.0");
            await digitalLegacy.connect(addr1).addAssetToCategory(0, amount, { value: amount });
            
            const [name, exists, totalAssets, beneficiaries, percentages] = await digitalLegacy.getCategory(0);
            expect(totalAssets).to.equal(amount);
            expect(await digitalLegacy.getCategoryBalance(addr1.address, 0)).to.equal(amount);
        });

        it("Should set category beneficiaries", async function () {
            await digitalLegacy.connect(addr1).registerUser(
                "encrypted_data",
                [addr1.address, addr2.address],
                2
            );

            const beneficiaries = [addr1.address, addr2.address];
            const percentages = [60, 40];
            
            await digitalLegacy.connect(addr1).setCategoryBeneficiaries(0, beneficiaries, percentages);
            
            const [name, exists, totalAssets, categoryBeneficiaries, categoryPercentages] = await digitalLegacy.getCategory(0);
            expect(categoryBeneficiaries).to.deep.equal(beneficiaries);
            expect(categoryPercentages).to.deep.equal(percentages);
        });

        it("Should fail to set invalid percentages", async function () {
            await digitalLegacy.connect(addr1).registerUser(
                "encrypted_data",
                [addr1.address, addr2.address],
                2
            );

            const beneficiaries = [addr1.address, addr2.address];
            const percentages = [60, 50]; // Sums to 110
            
            await expect(
                digitalLegacy.connect(addr1).setCategoryBeneficiaries(0, beneficiaries, percentages)
            ).to.be.revertedWith("Percentages must sum to 100");
        });
    });

    describe("Multi-Signature Requirements", function () {
        beforeEach(async function () {
            await digitalLegacy.connect(addr1).registerUser(
                "encrypted_data",
                [addr1.address, addr2.address],
                2
            );
            await digitalLegacy.connect(owner).addOracle(oracle.address);
            await digitalLegacy.connect(oracle).verifyDeath(addr1.address);
            
            // Create category and add assets
            await digitalLegacy.connect(owner).createCategory("Test Category");
            const amount = ethers.parseEther("1.0");
            await digitalLegacy.connect(addr1).addAssetToCategory(0, amount, { value: amount });
        });

        it("Should require signatures before transfer", async function () {
            await expect(
                digitalLegacy.connect(oracle).transferAssets(addr1.address)
            ).to.be.revertedWith("Not enough signatures");
        });

        it("Should allow transfer after enough signatures", async function () {
            await digitalLegacy.connect(addr1).signForUser(addr1.address);
            await digitalLegacy.connect(addr2).signForUser(addr1.address);
            
            await expect(
                digitalLegacy.connect(oracle).transferAssets(addr1.address)
            ).to.not.be.reverted;
        });

        it("Should prevent duplicate signatures", async function () {
            await digitalLegacy.connect(addr1).signForUser(addr1.address);
            await expect(
                digitalLegacy.connect(addr1).signForUser(addr1.address)
            ).to.be.revertedWith("Already signed");
        });
    });

    describe("Admin Functions", function () {
        beforeEach(async function () {
            await digitalLegacy.connect(owner).createCategory("Test Category");
        });

        it("Should add and remove admin", async function () {
            await digitalLegacy.connect(owner).addAdmin(admin.address);
            expect(await digitalLegacy.checkAdmin(admin.address)).to.be.true;
            
            await digitalLegacy.connect(owner).removeAdmin(admin.address);
            expect(await digitalLegacy.checkAdmin(admin.address)).to.be.false;
        });

        it("Should fail to remove self", async function () {
            await expect(
                digitalLegacy.connect(owner).removeAdmin(owner.address)
            ).to.be.revertedWith("Cannot remove self");
        });

        it("Should pause and unpause contract", async function () {
            await digitalLegacy.connect(owner).pauseContract();
            expect(await digitalLegacy.getContractStatus()).to.be.true;
            
            await digitalLegacy.connect(owner).unpauseContract();
            expect(await digitalLegacy.getContractStatus()).to.be.false;
        });

        it("Should handle emergency withdrawal", async function () {
            const amount = ethers.parseEther("1.0");
            await digitalLegacy.connect(addr1).addAssetToCategory(0, amount, { value: amount });
            
            const initialBalance = await ethers.provider.getBalance(owner.address);
            await digitalLegacy.connect(owner).emergencyWithdraw();
            const finalBalance = await ethers.provider.getBalance(owner.address);
            
            expect(finalBalance).to.be.gt(initialBalance);
        });
    });

    describe("Oracle Management", function () {
        it("Should add and remove oracle", async function () {
            await digitalLegacy.connect(owner).addOracle(oracle.address);
            expect(await digitalLegacy.checkOracle(oracle.address)).to.be.true;
            
            await digitalLegacy.connect(owner).removeOracle(oracle.address);
            expect(await digitalLegacy.checkOracle(oracle.address)).to.be.false;
        });

        it("Should fail to add existing oracle", async function () {
            await digitalLegacy.connect(owner).addOracle(oracle.address);
            await expect(
                digitalLegacy.connect(owner).addOracle(oracle.address)
            ).to.be.revertedWith("Already an oracle");
        });

        it("Should fail to remove non-oracle", async function () {
            await expect(
                digitalLegacy.connect(owner).removeOracle(addr1.address)
            ).to.be.revertedWith("Not an oracle");
        });
    });
}); 