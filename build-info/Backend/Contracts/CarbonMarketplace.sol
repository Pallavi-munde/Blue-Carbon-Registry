// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./CarbonCredit.sol";

contract CarbonMarketplace is ReentrancyGuard, Ownable {
    CarbonCredit public carbonCredit;

    struct Listing {
        uint256 tokenId;
        address seller;
        uint256 price;
        bool isActive;
    }

    mapping(uint256 => Listing) public listings;
    uint256[] public activeListings;

    event CreditListed(uint256 indexed tokenId, address seller, uint256 price);
    event CreditSold(uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event ListingCancelled(uint256 indexed tokenId);

    constructor(address _carbonCreditAddress) {
        carbonCredit = CarbonCredit(_carbonCreditAddress);
    }

    function listCredit(uint256 tokenId, uint256 price) public {
        require(carbonCredit.ownerOf(tokenId) == msg.sender, "Not the token owner");
        require(price > 0, "Price must be greater than 0");
        require(!listings[tokenId].isActive, "Credit already listed");

        carbonCredit.transferFrom(msg.sender, address(this), tokenId);

        listings[tokenId] = Listing({
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            isActive: true
        });

        activeListings.push(tokenId);

        emit CreditListed(tokenId, msg.sender, price);
    }

    function buyCredit(uint256 tokenId) public payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Credit not for sale");
        require(msg.value >= listing.price, "Insufficient payment");

        listing.isActive = false;
        _removeListing(tokenId);

        carbonCredit.transferFrom(address(this), msg.sender, tokenId);

        payable(listing.seller).transfer(msg.value);

        emit CreditSold(tokenId, listing.seller, msg.sender, msg.value);
    }

    function cancelListing(uint256 tokenId) public {
        Listing storage listing = listings[tokenId];
        require(listing.seller == msg.sender, "Not the seller");
        require(listing.isActive, "Listing not active");

        listing.isActive = false;
        _removeListing(tokenId);

        carbonCredit.transferFrom(address(this), msg.sender, tokenId);

        emit ListingCancelled(tokenId);
    }

    function _removeListing(uint256 tokenId) internal {
        for (uint256 i = 0; i < activeListings.length; i++) {
            if (activeListings[i] == tokenId) {
                activeListings[i] = activeListings[activeListings.length - 1];
                activeListings.pop();
                break;
            }
        }
    }

    function getActiveListings() public view returns (uint256[] memory) {
        return activeListings;
    }

    function getListing(uint256 tokenId) public view returns (Listing memory) {
        return listings[tokenId];
    }
}