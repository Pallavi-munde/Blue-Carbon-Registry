const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log("Network:", network.name, "(", network.chainId, ")");

  // Deploy CarbonCredit contract
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const carbonCredit = await CarbonCredit.deploy();

  await carbonCredit.deployed();

  console.log("CarbonCredit contract deployed to:", carbonCredit.address);

  // Create contracts directory in frontend if it doesn't exist
  const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // Save contract address to a file for frontend use
  const contractAddressFile = path.join(contractsDir, "contract-addresses.json");
  
  let addressData = {};
  
  // If file exists, load it to preserve other network addresses
  if (fs.existsSync(contractAddressFile)) {
    addressData = JSON.parse(fs.readFileSync(contractAddressFile, "utf8"));
  }
  
  // Add or update the current network's contract address
  addressData[network.chainId] = {
    CarbonCredit: carbonCredit.address,
    Network: {
      name: network.name,
      chainId: network.chainId,
      ensAddress: null
    },
    LatestBlock: await ethers.provider.getBlockNumber()
  };
  
  // Also add a default entry for easy access
  addressData.CarbonCredit = carbonCredit.address;
  addressData.Network = {
    name: network.name,
    chainId: network.chainId,
    ensAddress: null
  };
  
  fs.writeFileSync(
    contractAddressFile,
    JSON.stringify(addressData, null, 2)
  );

  // Save contract ABI to a file for frontend use
  const CarbonCreditArtifact = artifacts.readArtifactSync("CarbonCredit");

  fs.writeFileSync(
    path.join(contractsDir, "CarbonCredit.json"),
    JSON.stringify(CarbonCreditArtifact, null, 2)
  );

  console.log("Contract artifacts saved to frontend directory");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });