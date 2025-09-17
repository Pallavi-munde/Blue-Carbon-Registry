import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { loadContract, checkCorrectNetwork, getNetworkInfo } from './utils/contractLoader';
import './App.css';

function App() {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [correctNetwork, setCorrectNetwork] = useState(false);

  // Initialize contract and check network
  useEffect(() => {
    if (window.ethereum) {
      const init = async () => {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
        
        // Check if connected to correct network
        const isCorrectNetwork = await checkCorrectNetwork(provider);
        setCorrectNetwork(isCorrectNetwork);
        
        if (isCorrectNetwork) {
          const signer = provider.getSigner();
          const carbonCredit = await loadContract(provider, signer);
          setContract(carbonCredit);
          
          // Check if connected account is owner
          const owner = await carbonCredit.owner();
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsOwner(accounts[0].toLowerCase() === owner.toLowerCase());
          }
          
          // Load credits
          await loadCredits(carbonCredit);
        }
      };
      
      init();
    }
  }, []);

  // Add network switching function
  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${getNetworkInfo().chainId.toString(16)}` }],
      });
      setCorrectNetwork(true);
      window.location.reload();
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${getNetworkInfo().chainId.toString(16)}`,
                chainName: getNetworkInfo().name,
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
        }
      }
      console.error('Error switching network:', switchError);
    }
  };

  // Display network warning if needed
  if (!correctNetwork) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold mb-4">Wrong Network</h2>
          <p className="mb-6">
            Please connect to the {getNetworkInfo().name} network to use this application.
          </p>
          <button 
            onClick={switchNetwork}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            Switch Network
          </button>
        </div>
      </div>
    );
  }

  // Rest of your component...
}