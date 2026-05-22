// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MilestoneMarket.sol";

contract MarketFactory {
    address[] public markets;

    event MarketCreated(
        address indexed market,
        address indexed token,
        uint256 threshold,
        uint256 deadline
    );

    function createMarket(
        address token,
        uint256 threshold,
        uint256 deadline,
        uint256 currentSupply
    ) external returns (address) {
        require(deadline > block.timestamp, "Invalid deadline");

        MilestoneMarket market = new MilestoneMarket(
            token,
            threshold,
            deadline,
            msg.sender,
            currentSupply
        );

        markets.push(address(market));

        emit MarketCreated(address(market), token, threshold, deadline);

        return address(market);
    }

    function getMarkets() external view returns (address[] memory) {
        return markets;
    }
}
