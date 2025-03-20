require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!GOERLI_RPC_URL) {
  throw new Error("GOERLI_RPC_URL is not set in .env file");
}

if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY is not set in .env file");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.0",
  networks: {
    goerli: {
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY],
    },
  },
};
