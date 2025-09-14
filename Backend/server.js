const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const { CarbonCredit, CarbonMarketplace } = require('./artifacts/contracts');
const contractAddresses = require('./frontend/src/contracts/contract-addresses.json');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Web3
const web3 = new Web3('http://localhost:8545'); // Connect to local blockchain

// Initialize contracts
const carbonCredit = new web3.eth.Contract(
  CarbonCredit.abi,
  contractAddresses.CarbonCredit
);

const carbonMarketplace = new web3.eth.Contract(
  CarbonMarketplace.abi,
  contractAddresses.CarbonMarketplace
);

// API Routes
app.get('/api/credits', async (req, res) => {
  try {
    const totalSupply = await carbonCredit.methods.totalSupply().call();
    const credits = [];
    
    for (let i = 1; i <= totalSupply; i++) {
      const creditData = await carbonCredit.methods.getCreditData(i).call();
      credits.push({
        id: i,
        ...creditData
      });
    }
    
    res.json(credits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/credits/:id', async (req, res) => {
  try {
    const creditId = req.params.id;
    const creditData = await carbonCredit.methods.getCreditData(creditId).call();
    
    res.json({
      id: creditId,
      ...creditData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/marketplace', async (req, res) => {
  try {
    const activeListings = await carbonMarketplace.methods.getActiveListings().call();
    const listings = [];
    
    for (let i = 0; i < activeListings.length; i++) {
      const listing = await carbonMarketplace.methods.getListing(activeListings[i]).call();
      if (listing.isActive) {
        listings.push(listing);
      }
    }
    
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mint', async (req, res) => {
  try {
    const { to, projectId, location, carbonAmount, verificationData, species, methodology } = req.body;
    
    // In a real application, you would have authentication and authorization here
    const accounts = await web3.eth.getAccounts();
    
    const result = await carbonCredit.methods.mintCredit(
      to,
      projectId,
      location,
      carbonAmount,
      verificationData,
      species,
      methodology
    ).send({ from: accounts[0] });
    
    res.json({ transactionHash: result.transactionHash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});