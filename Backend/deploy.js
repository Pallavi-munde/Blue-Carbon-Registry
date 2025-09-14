const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying CarbonCredit contract...");
  
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const carbonCredit = await CarbonCredit.deploy();
  
  await carbonCredit.deployed();
  console.log("CarbonCredit deployed to:", carbonCredit.address);
  
  console.log("Deploying CarbonMarketplace contract...");
  
  const CarbonMarketplace = await ethers.getContractFactory("CarbonMarketplace");
  const carbonMarketplace = await CarbonMarketplace.deploy(carbonCredit.address);
  
  await carbonMarketplace.deployed();
  console.log("CarbonMarketplace deployed to:", carbonMarketplace.address);
  
  // Save contract addresses to a file for frontend use
  const fs = require("fs");
  const contractsDir = __dirname + "/../frontend/src/contracts";
  
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    contractsDir + "/contract-addresses.json",
    JSON.stringify({
      CarbonCredit: carbonCredit.address,
      CarbonMarketplace: carbonMarketplace.address
    }, undefined, 2)
  );
  
  // Save contract ABI
  const CarbonCreditArtifact = artifacts.readArtifactSync("CarbonCredit");
  const CarbonMarketplaceArtifact = artifacts.readArtifactSync("CarbonMarketplace");
  
  fs.writeFileSync(
    contractsDir + "/CarbonCredit.json",
    JSON.stringify(CarbonCreditArtifact, null, 2)
  );
  
  fs.writeFileSync(
    contractsDir + "/CarbonMarketplace.json",
    JSON.stringify(CarbonMarketplaceArtifact, null, 2)
  );
  
  console.log("Contract artifacts saved to frontend!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });