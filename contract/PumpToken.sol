// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PumpToken
 * @notice ERC-20 reward token for PumpX gamification system.
 *
 * Minting is restricted to the owner (game server / multisig).
 * Designed for off-chain gamification rewards — mint is called by
 * the backend after verifying XP / season rank / badge unlocks.
 *
 * Features:
 *   - Owner-only minting (for season rewards, badge unlocks, etc.)
 *   - Max supply cap (prevents inflation)
 *   - Per-address mint cooldown (anti-abuse)
 *   - Batch minting for season-end rewards
 *   - Pause capability for emergency
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract PumpToken is ERC20, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100M tokens
    uint256 public constant COOLDOWN = 1 hours;

    mapping(address => uint256) public lastMintTimestamp;

    event RewardMinted(address indexed to, uint256 amount, string reason);
    event BatchRewardMinted(uint256 recipientCount, uint256 totalAmount);

    constructor() ERC20("PumpX Token", "PUMP") Ownable(msg.sender) {}

    /**
     * @notice Mint reward tokens to a user.
     * @param to       Recipient address
     * @param amount   Amount of tokens (in wei)
     * @param reason   Human-readable reason (e.g. "season_1_top_10", "badge_prophet")
     */
    function mintReward(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyOwner whenNotPaused {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        require(
            block.timestamp >= lastMintTimestamp[to] + COOLDOWN,
            "Mint cooldown active"
        );

        lastMintTimestamp[to] = block.timestamp;
        _mint(to, amount);

        emit RewardMinted(to, amount, reason);
    }

    /**
     * @notice Batch mint for season-end rewards.
     * @param recipients Array of recipient addresses
     * @param amounts    Array of token amounts
     * @param reason     Shared reason for all mints
     */
    function batchMintReward(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata reason
    ) external onlyOwner whenNotPaused {
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length <= 50, "Max 50 per batch");

        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid address");
            require(amounts[i] > 0, "Amount must be > 0");
            total += amounts[i];
        }

        require(totalSupply() + total <= MAX_SUPPLY, "Exceeds max supply");

        for (uint256 i = 0; i < recipients.length; i++) {
            lastMintTimestamp[recipients[i]] = block.timestamp;
            _mint(recipients[i], amounts[i]);
            emit RewardMinted(recipients[i], amounts[i], reason);
        }

        emit BatchRewardMinted(recipients.length, total);
    }

    /**
     * @notice Pause all minting (emergency brake).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause minting.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Burn tokens from caller's balance.
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Remaining mintable supply.
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
}
