const { ethers } = require("ethers");

const privateKey = "759c7fb4d2cda0e853cc8b07bc99a33cb52c23cedb850192aeb1dbc634c080d8";
const wallet = new ethers.Wallet(privateKey);

console.log("Your wallet address is:", wallet.address); 