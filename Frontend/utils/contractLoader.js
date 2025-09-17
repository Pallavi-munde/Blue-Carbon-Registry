import CarbonCreditABI from '../contracts/CarbonCredit.json';
import contractAddresses from '../contracts/contract-addresses.json';

export const loadContract = async (provider, signer) => {
  try {
    // Get current network
    const network = await provider.getNetwork();
    
    // Get the contract address for the current network
    let contractAddress;
    if (contractAddresses[network.chainId]) {
      contractAddress = contractAddresses[network.chainId].CarbonCredit;
    } else {
      // Fallback to default address
      contractAddress = contractAddresses.CarbonCredit;
    }
    
    // Create contract instance
    const contract = new ethers.Contract(
      contractAddress,
      CarbonCreditABI.abi,
      signer || provider
    );
    
    return contract;
  } catch (error) {
    console.error("Error loading contract:", error);
    throw error;
  }
};

export const getNetworkInfo = () => {
  return contractAddresses.Network;
};

export const checkCorrectNetwork = async (provider) => {
  try {
    const network = await provider.getNetwork();
    
    // Check if we have a contract deployed on this network
    if (contractAddresses[network.chainId]) {
      return true;
    }
    
    // Fallback to checking against the default network
    return network.chainId === contractAddresses.Network.chainId;
  } catch (error) {
    console.error("Error checking network:", error);
    return false;
  }
};