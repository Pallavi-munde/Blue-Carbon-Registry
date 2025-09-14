import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import CarbonCredit from './contracts/CarbonCredit.json';
import CarbonMarketplace from './contracts/CarbonMarketplace.json';
import contractAddresses from './contracts/contract-addresses.json';
import './App.css';

function App() {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [carbonCredit, setCarbonCredit] = useState(null);
  const [carbonMarketplace, setCarbonMarketplace] = useState(null);
  const [credits, setCredits] = useState([]);
  const [listings, setListings] = useState([]);

  useEffect(() => {
    const init = async () => {
      // Check if Web3 is injected by the browser (MetaMask)
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);
        
        try {
          // Request account access
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setAccounts(accounts);
          
          // Get the contract instance
          const carbonCreditInstance = new web3Instance.eth.Contract(
            CarbonCredit.abi,
            contractAddresses.CarbonCredit
          );
          setCarbonCredit(carbonCreditInstance);
          
          const carbonMarketplaceInstance = new web3Instance.eth.Contract(
            CarbonMarketplace.abi,
            contractAddresses.CarbonMarketplace
          );
          setCarbonMarketplace(carbonMarketplaceInstance);
          
          // Load credits and listings
          await loadCredits(carbonCreditInstance);
          await loadListings(carbonMarketplaceInstance, carbonCreditInstance);
        } catch (error) {
          console.error('Error initializing app:', error);
        }
      } else {
        console.log('Please install MetaMask!');
      }
    };
    
    init();
  }, []);

  const loadCredits = async (carbonCreditInstance) => {
    try {
      const totalSupply = await carbonCreditInstance.methods.totalSupply().call();
      const creditsData = [];
      
      for (let i = 1; i <= totalSupply; i++) {
        const creditData = await carbonCreditInstance.methods.getCreditData(i).call();
        creditsData.push({
          id: i,
          ...creditData
        });
      }
      
      setCredits(creditsData);
    } catch (error) {
      console.error('Error loading credits:', error);
    }
  };

  const loadListings = async (carbonMarketplaceInstance, carbonCreditInstance) => {
    try {
      const activeListings = await carbonMarketplaceInstance.methods.getActiveListings().call();
      const listingsData = [];
      
      for (let i = 0; i < activeListings.length; i++) {
        const listing = await carbonMarketplaceInstance.methods.getListing(activeListings[i]).call();
        if (listing.isActive) {
          const creditData = await carbonCreditInstance.methods.getCreditData(listing.tokenId).call();
          listingsData.push({
            ...listing,
            creditData
          });
        }
      }
      
      setListings(listingsData);
    } catch (error) {
      console.error('Error loading listings:', error);
    }
  };

  const handleMintCredit = async () => {
    // In a real app, you would have a form to collect this data
    const projectData = {
      to: accounts[0],
      projectId: "MANGROVE_001",
      location: "Sundarbans, Bangladesh",
      carbonAmount: Web3.utils.toWei('1000', 'ether'), // 1000 kg CO2
      verificationData: "IPFS_HASH_OF_VERIFICATION_DATA",
      species: "Rhizophora mucronata",
      methodology: "VM0033"
    };
    
    try {
      await carbonCredit.methods.mintCredit(
        projectData.to,
        projectData.projectId,
        projectData.location,
        projectData.carbonAmount,
        projectData.verificationData,
        projectData.species,
        projectData.methodology
      ).send({ from: accounts[0] });
      
      // Reload credits
      await loadCredits(carbonCredit);
    } catch (error) {
      console.error('Error minting credit:', error);
    }
  };

  const handleListCredit = async (tokenId, price) => {
    try {
      await carbonMarketplace.methods.listCredit(
        tokenId,
        Web3.utils.toWei(price.toString(), 'ether')
      ).send({ from: accounts[0] });
      
      // Reload listings
      await loadListings(carbonMarketplace, carbonCredit);
    } catch (error) {
      console.error('Error listing credit:', error);
    }
  };

  const handleBuyCredit = async (tokenId, price) => {
    try {
      await carbonMarketplace.methods.buyCredit(tokenId).send({
        from: accounts[0],
        value: Web3.utils.toWei(price.toString(), 'ether')
      });
      
      // Reload listings and credits
      await loadListings(carbonMarketplace, carbonCredit);
      await loadCredits(carbonCredit);
    } catch (error) {
      console.error('Error buying credit:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Blue Carbon Registry & MRV System</h1>
        <p>Connected account: {accounts[0]}</p>
      </header>
      
      <main>
        <section>
          <h2>My Carbon Credits</h2>
          <button onClick={handleMintCredit}>Mint Test Credit</button>
          <div className="credits-grid">
            {credits.map(credit => (
              <div key={credit.id} className="credit-card">
                <h3>Project: {credit.projectId}</h3>
                <p>Location: {credit.location}</p>
                <p>Carbon: {Web3.utils.fromWei(credit.carbonAmount, 'ether')} kg CO2</p>
                <p>Species: {credit.species}</p>
                <p>Verified: {credit.isVerified ? 'Yes' : 'No'}</p>
                <button onClick={() => handleListCredit(credit.id, 1)}>
                  List for 1 ETH
                </button>
              </div>
            ))}
          </div>
        </section>
        
        <section>
          <h2>Marketplace</h2>
          <div className="listings-grid">
            {listings.map(listing => (
              <div key={listing.tokenId} className="listing-card">
                <h3>Token ID: {listing.tokenId}</h3>
                <p>Seller: {listing.seller}</p>
                <p>Price: {Web3.utils.fromWei(listing.price, 'ether')} ETH</p>
                <p>Project: {listing.creditData.projectId}</p>
                <p>Carbon: {Web3.utils.fromWei(listing.creditData.carbonAmount, 'ether')} kg CO2</p>
                <button onClick={() => handleBuyCredit(listing.tokenId, Web3.utils.fromWei(listing.price, 'ether'))}>
                  Buy Credit
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;