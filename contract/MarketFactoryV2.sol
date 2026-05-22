// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MilestoneMarketV2.sol";

/**
 * @title MarketFactoryV2
 * @author PumpX / BEDSHEET Team
 * @notice Improved factory with creator registry, fee collection,
 *         market count limits, and enhanced events.
 */
contract MarketFactoryV2 {
    /* ── State ────────────────────────────────────── */
    address public owner;
    address[] public markets;

    uint256 public creationFee;          // optional fee in wei (0 = free)
    uint256 public constant MAX_MARKETS_PER_TX = 1;

    mapping(address => address[]) public creatorMarkets;   // creator → markets
    mapping(address => bool) public isMarket;               // quick lookup

    /* ── Events ───────────────────────────────────── */
    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed token,
        uint256 threshold,
        uint256 deadline,
        uint256 initialSupply
    );
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event CreationFeeUpdated(uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    /* ── Modifiers ────────────────────────────────── */
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /* ── Constructor ──────────────────────────────── */
    constructor() {
        owner = msg.sender;
    }

    /* ── Create Market ────────────────────────────── */
    function createMarket(
        address token,
        uint256 threshold,
        uint256 deadline,
        uint256 currentSupply
    ) external payable returns (address) {
        require(msg.value >= creationFee, "Insufficient fee");
        require(token != address(0), "Zero token");
        require(deadline > block.timestamp, "Invalid deadline");
        require(threshold > currentSupply, "Threshold <= supply");

        MilestoneMarketV2 market = new MilestoneMarketV2(
            token,
            threshold,
            deadline,
            msg.sender,
            currentSupply
        );

        address addr = address(market);
        markets.push(addr);
        creatorMarkets[msg.sender].push(addr);
        isMarket[addr] = true;

        emit MarketCreated(addr, msg.sender, token, threshold, deadline, currentSupply);

        return addr;
    }

    /* ── Views ────────────────────────────────────── */
    function getMarkets() external view returns (address[] memory) {
        return markets;
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getCreatorMarkets(address _creator) external view returns (address[] memory) {
        return creatorMarkets[_creator];
    }

    function getCreatorMarketCount(address _creator) external view returns (uint256) {
        return creatorMarkets[_creator].length;
    }

    /* ── Admin ────────────────────────────────────── */
    function setCreationFee(uint256 _fee) external onlyOwner {
        creationFee = _fee;
        emit CreationFeeUpdated(_fee);
    }

    function withdrawFees(address payable _to) external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No fees");
        (bool ok, ) = _to.call{value: bal}("");
        require(ok, "Transfer failed");
        emit FeesWithdrawn(_to, bal);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }
}
