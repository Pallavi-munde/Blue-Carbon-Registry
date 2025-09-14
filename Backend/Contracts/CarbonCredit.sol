// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract CarbonCredit is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    struct CreditData {
        string projectId;
        string location;
        uint256 carbonAmount; // in kg CO2 equivalent
        uint256 dateCreated;
        string verificationData;
        string species;
        string methodology;
        address verifier;
        bool isVerified;
    }

    mapping(uint256 => CreditData) public creditData;
    mapping(string => bool) public projectExists;

    event CreditMinted(
        uint256 indexed tokenId,
        string projectId,
        uint256 carbonAmount,
        address indexed owner
    );
    event CreditVerified(uint256 indexed tokenId, address verifier);
    event CreditTransferred(uint256 indexed tokenId, address from, address to);

    constructor() ERC721("BlueCarbonCredit", "BCC") {}

    function mintCredit(
        address to,
        string memory projectId,
        string memory location,
        uint256 carbonAmount,
        string memory verificationData,
        string memory species,
        string memory methodology
    ) public onlyOwner returns (uint256) {
        require(!projectExists[projectId], "Project already exists");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);

        creditData[tokenId] = CreditData({
            projectId: projectId,
            location: location,
            carbonAmount: carbonAmount,
            dateCreated: block.timestamp,
            verificationData: verificationData,
            species: species,
            methodology: methodology,
            verifier: address(0),
            isVerified: false
        });

        projectExists[projectId] = true;

        emit CreditMinted(tokenId, projectId, carbonAmount, to);
        return tokenId;
    }

    function verifyCredit(uint256 tokenId, string memory verificationData) public onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        require(!creditData[tokenId].isVerified, "Credit already verified");

        creditData[tokenId].isVerified = true;
        creditData[tokenId].verifier = msg.sender;
        creditData[tokenId].verificationData = verificationData;

        emit CreditVerified(tokenId, msg.sender);
    }

    function getCreditData(uint256 tokenId) public view returns (CreditData memory) {
        require(_exists(tokenId), "Token does not exist");
        return creditData[tokenId];
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        emit CreditTransferred(tokenId, from, to);
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
}