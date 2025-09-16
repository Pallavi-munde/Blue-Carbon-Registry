// filepath: script/deploy.js
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const contract = await CarbonCredit.deploy();
  await contract.deployed();

  console.log("CarbonCredit deployed to:", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});