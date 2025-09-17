require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    goerli: {
      url: "https://mainnet.infura.io/v3/24e6d66e19364806902d3d9ce6ac023f",
      accounts: [process.env.PRIVATE_KEY].filter(Boolean)
    }
  },
  // Add other networks as needed (testnets, mainnet)
  paths: {
    sources: "./contracts",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

