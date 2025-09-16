const express = require('express');
const cors = require('cors');
const Web3 = require('web3');
const multer = require('multer');
const { create } = require('ipfs-http-client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import contract ABIs
const CarbonCredit = require('./artifacts/contracts/CarbonCredit.sol/CarbonCredit.json');
const CarbonMarketplace = require('./artifacts/contracts/CarbonMarketplace.sol/CarbonMarketplace.json');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize Web3
const web3 = new Web3(process.env.BLOCKCHAIN_URL || 'http://localhost:8545');

// Initialize IPFS client
let ipfs;
try {
  ipfs = create({
    host: process.env.IPFS_HOST || 'ipfs.infura.io',
    port: process.env.IPFS_PORT || 5001,
    protocol: process.env.IPFS_PROTOCOL || 'https',
    headers: {
      authorization: process.env.IPFS_AUTH || ''
    }
  });
  console.log('IPFS client initialized');
} catch (error) {
  console.error('IPFS initialization error:', error);
  ipfs = null;
}

// Load contract addresses
let contractAddresses;
try {
  contractAddresses = require('./contract-addresses.json');
} catch (error) {
  console.error('Could not load contract addresses. Please deploy contracts first.');
  process.exit(1);
}

// Initialize contracts
const carbonCredit = new web3.eth.Contract(
  CarbonCredit.abi,
  contractAddresses.CarbonCredit
);

const carbonMarketplace = new web3.eth.Contract(
  CarbonMarketplace.abi,
  contractAddresses.CarbonMarketplace
);

// Utility function to get accounts
const getAccounts = async () => {
  return await web3.eth.getAccounts();
};

// Utility function to upload file to IPFS
const uploadToIPFS = async (filePath) => {
  if (!ipfs) {
    throw new Error('IPFS client not initialized');
  }

  try {
    const file = fs.readFileSync(filePath);
    const result = await ipfs.add(file);
    
    // Remove the local file after uploading to IPFS
    fs.unlinkSync(filePath);
    
    return result.path;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
};

// Utility function to handle contract transactions
const sendTransaction = async (method, fromAddress, value = '0') => {
  const gasEstimate = await method.estimateGas({ from: fromAddress, value });
  const gasPrice = await web3.eth.getGasPrice();
  
  return await method.send({
    from: fromAddress,
    gas: Math.round(gasEstimate * 1.2), // Add 20% buffer
    gasPrice,
    value
  });
};

// API Routes

// Get all carbon credits
app.get('/api/credits', async (req, res) => {
  try {
    const totalSupply = await carbonCredit.methods.totalSupply().call();
    const credits = [];
    
    for (let i = 1; i <= totalSupply; i++) {
      try {
        const creditData = await carbonCredit.methods.getCreditData(i).call();
        const owner = await carbonCredit.methods.ownerOf(i).call();
        
        credits.push({
          id: i,
          owner,
          ...creditData
        });
      } catch (error) {
        // Token might not exist, skip it
        console.warn(`Token ${i} might not exist:`, error.message);
      }
    }
    
    res.json({ success: true, data: credits });
  } catch (error) {
    console.error('Error fetching credits:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch carbon credits' 
    });
  }
});

// Get specific carbon credit
app.get('/api/credits/:id', async (req, res) => {
  try {
    const creditId = req.params.id;
    const creditData = await carbonCredit.methods.getCreditData(creditId).call();
    const owner = await carbonCredit.methods.ownerOf(creditId).call();
    
    res.json({
      success: true,
      data: {
        id: creditId,
        owner,
        ...creditData
      }
    });
  } catch (error) {
    console.error('Error fetching credit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch carbon credit' 
    });
  }
});

// Get marketplace listings
app.get('/api/marketplace', async (req, res) => {
  try {
    const activeListings = await carbonMarketplace.methods.getActiveListings().call();
    const listings = [];
    
    for (let i = 0; i < activeListings.length; i++) {
      const listing = await carbonMarketplace.methods.getListing(activeListings[i]).call();
      if (listing.isActive) {
        const creditData = await carbonCredit.methods.getCreditData(listing.tokenId).call();
        listings.push({
          ...listing,
          creditData
        });
      }
    }
    
    res.json({ success: true, data: listings });
  } catch (error) {
    console.error('Error fetching marketplace listings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch marketplace listings' 
    });
  }
});

// Mint a new carbon credit
app.post('/api/mint', upload.array('files', 5), async (req, res) => {
  try {
    const { 
      projectId, 
      location, 
      carbonAmount, 
      species, 
      methodology,
      description 
    } = req.body;
    
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No accounts available' 
      });
    }
    
    // Upload files to IPFS if any
    let verificationData = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ipfsHash = await uploadToIPFS(file.path);
        verificationData.push({
          originalName: file.originalname,
          ipfsHash,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Add additional verification data from request body
    if (req.body.verificationData) {
      try {
        const additionalData = JSON.parse(req.body.verificationData);
        verificationData = verificationData.concat(additionalData);
      } catch (e) {
        console.error('Error parsing verification data:', e);
      }
    }
    
    const verificationDataJSON = JSON.stringify(verificationData);
    
    const result = await sendTransaction(
      carbonCredit.methods.mintCredit(
        accounts[0], // Using the first available account
        projectId,
        location,
        web3.utils.toWei(carbonAmount, 'ether'),
        verificationDataJSON,
        species,
        methodology
      ),
      accounts[0]
    );
    
    res.json({ 
      success: true, 
      transactionHash: result.transactionHash,
      message: 'Carbon credit minted successfully'
    });
  } catch (error) {
    console.error('Error minting carbon credit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mint carbon credit' 
    });
  }
});

// Verify a carbon credit
app.post('/api/verify/:id', upload.array('files', 5), async (req, res) => {
  try {
    const creditId = req.params.id;
    const { verificationNotes } = req.body;
    
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No accounts available' 
      });
    }
    
    // Upload verification files to IPFS if any
    let verificationData = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ipfsHash = await uploadToIPFS(file.path);
        verificationData.push({
          originalName: file.originalname,
          ipfsHash,
          timestamp: new Date().toISOString(),
          type: 'verification'
        });
      }
    }
    
    // Add verification notes
    if (verificationNotes) {
      verificationData.push({
        type: 'notes',
        notes: verificationNotes,
        timestamp: new Date().toISOString(),
        verifier: accounts[0]
      });
    }
    
    const verificationDataJSON = JSON.stringify(verificationData);
    
    const result = await sendTransaction(
      carbonCredit.methods.verifyCredit(creditId, verificationDataJSON),
      accounts[0]
    );
    
    res.json({ 
      success: true, 
      transactionHash: result.transactionHash,
      message: 'Carbon credit verified successfully'
    });
  } catch (error) {
    console.error('Error verifying carbon credit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify carbon credit' 
    });
  }
});

// List a carbon credit on marketplace
app.post('/api/marketplace/list', async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No accounts available' 
      });
    }
    
    // First approve the marketplace to transfer the token
    await sendTransaction(
      carbonCredit.methods.approve(carbonMarketplace.options.address, tokenId),
      accounts[0]
    );
    
    // Then list the token
    const result = await sendTransaction(
      carbonMarketplace.methods.listCredit(
        tokenId,
        web3.utils.toWei(price, 'ether')
      ),
      accounts[0]
    );
    
    res.json({ 
      success: true, 
      transactionHash: result.transactionHash,
      message: 'Carbon credit listed successfully'
    });
  } catch (error) {
    console.error('Error listing carbon credit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to list carbon credit' 
    });
  }
});

// Buy a carbon credit from marketplace
app.post('/api/marketplace/buy', async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No accounts available' 
      });
    }
    
    const result = await sendTransaction(
      carbonMarketplace.methods.buyCredit(tokenId),
      accounts[0],
      web3.utils.toWei(price, 'ether')
    );
    
    res.json({ 
      success: true, 
      transactionHash: result.transactionHash,
      message: 'Carbon credit purchased successfully'
    });
  } catch (error) {
    console.error('Error buying carbon credit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to buy carbon credit' 
    });
  }
});

// Cancel a marketplace listing
app.post('/api/marketplace/cancel', async (req, res) => {
  try {
    const { tokenId } = req.body;
    
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No accounts available' 
      });
    }
    
    const result = await sendTransaction(
      carbonMarketplace.methods.cancelListing(tokenId),
      accounts[0]
    );
    
    res.json({ 
      success: true, 
      transactionHash: result.transactionHash,
      message: 'Listing cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling listing:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel listing' 
    });
  }
});

// Get account balance
app.get('/api/account/balance', async (req, res) => {
  try {
    const accounts = await getAccounts();
    if (accounts.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No accounts available' 
      });
    }
    
    const balance = await web3.eth.getBalance(accounts[0]);
    res.json({ 
      success: true, 
      data: {
        address: accounts[0],
        balance: web3.utils.fromWei(balance, 'ether')
      }
    });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch account balance' 
    });
  }
});

// Get IPFS gateway URL for a hash
app.get('/api/ipfs/:hash', (req, res) => {
  const hash = req.params.hash;
  const gateway = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
  res.json({ 
    success: true, 
    data: { url: gateway + hash } 
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check blockchain connection
    const blockNumber = await web3.eth.getBlockNumber();
    
    // Check contract connection
    const totalSupply = await carbonCredit.methods.totalSupply().call();
    
    res.json({ 
      success: true, 
      data: {
        blockchain: {
          connected: true,
          blockNumber: blockNumber
        },
        contracts: {
          carbonCredit: contractAddresses.CarbonCredit,
          carbonMarketplace: contractAddresses.CarbonMarketplace,
          totalCredits: totalSupply
        },
        ipfs: ipfs ? true : false
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Service unhealthy: ' + error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Blue Carbon Registry API server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
});

module.exports = app;