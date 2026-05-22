// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MilestoneMarketV2
 * @author PumpX / BEDSHEET Team
 * @notice Improved prediction market with access control, dispute mechanism,
 *         auto-timeout refunds, and gas-optimised claim logic.
 *
 * Security improvements over V1
 * ─────────────────────────────
 *  1. updateSupply() restricted to creator (oracle-role)
 *  2. Uses call{value} instead of transfer() → safe with smart-contract wallets
 *  3. Minimum bet enforced (0.0001 ETH)
 *  4. Dispute window after resolution (48 h)
 *  5. Auto-refund if no resolution within grace period after deadline
 *  6. Emergency pause by creator
 *  7. Packed storage for gas savings
 */
contract MilestoneMarketV2 is ReentrancyGuard {
    /* ── Constants ────────────────────────────────── */
    uint256 public constant MIN_BET = 0.0001 ether;
    uint256 public constant DISPUTE_WINDOW = 48 hours;
    uint256 public constant REFUND_GRACE = 30 days;

    /* ── Immutables ──────────────────────────────── */
    address public immutable token;
    uint256 public immutable threshold;
    uint256 public immutable deadline;
    address public immutable creator;
    uint256 public immutable initialSupply;

    /* ── State ────────────────────────────────────── */
    uint256 public latestSupply;
    uint256 public totalYes;
    uint256 public totalNo;
    uint256 public resolvedAt;        // timestamp when resolved

    bool public resolved;
    bool public reached;
    bool public paused;
    bool public disputed;

    mapping(address => uint256) public yesDeposits;
    mapping(address => uint256) public noDeposits;
    mapping(address => bool)    public claimed;

    /* ── Events ───────────────────────────────────── */
    event Deposited(address indexed user, bool isYes, uint256 amount);
    event Resolved(bool reached, uint256 finalSupply);
    event Claimed(address indexed user, uint256 amount);
    event Refunded(address indexed user, uint256 amount);
    event SupplyUpdated(uint256 newSupply, address indexed updater);
    event Disputed(address indexed disputer);
    event DisputeSettled(bool newOutcome);
    event Paused(bool state);

    /* ── Modifiers ────────────────────────────────── */
    modifier onlyCreator() {
        require(msg.sender == creator, "Not creator");
        _;
    }

    modifier notPaused() {
        require(!paused, "Market paused");
        _;
    }

    /* ── Constructor ──────────────────────────────── */
    constructor(
        address _token,
        uint256 _threshold,
        uint256 _deadline,
        address _creator,
        uint256 _currentSupply
    ) {
        require(_token != address(0), "Zero token address");
        require(_deadline > block.timestamp, "Deadline in past");
        require(_threshold > _currentSupply, "Threshold <= supply");
        require(_creator != address(0), "Zero creator");

        token         = _token;
        threshold     = _threshold;
        deadline      = _deadline;
        creator       = _creator;
        initialSupply = _currentSupply;
        latestSupply  = _currentSupply;
    }

    /* ── Oracle ───────────────────────────────────── */
    /// @notice Only the market creator (acting as oracle) can push supply updates
    function updateSupply(uint256 _newSupply) external onlyCreator {
        require(!resolved, "Already resolved");
        latestSupply = _newSupply;
        emit SupplyUpdated(_newSupply, msg.sender);
    }

    /* ── Betting ──────────────────────────────────── */
    function depositYes() external payable nonReentrant notPaused {
        _deposit(true);
    }

    function depositNo() external payable nonReentrant notPaused {
        _deposit(false);
    }

    function _deposit(bool isYes) internal {
        require(block.timestamp < deadline, "Market ended");
        require(!resolved, "Already resolved");
        require(msg.value >= MIN_BET, "Below minimum bet");

        if (isYes) {
            yesDeposits[msg.sender] += msg.value;
            totalYes += msg.value;
        } else {
            noDeposits[msg.sender] += msg.value;
            totalNo += msg.value;
        }

        emit Deposited(msg.sender, isYes, msg.value);
    }

    /* ── Resolution ───────────────────────────────── */
    function checkMilestone() public view returns (bool) {
        return latestSupply >= threshold;
    }

    function resolve() external notPaused {
        require(block.timestamp >= deadline, "Not ended");
        require(!resolved, "Already resolved");

        reached    = checkMilestone();
        resolved   = true;
        resolvedAt = block.timestamp;

        emit Resolved(reached, latestSupply);
    }

    /* ── Dispute Mechanism ────────────────────────── */
    /// @notice Any depositor can dispute within DISPUTE_WINDOW after resolution
    function dispute() external {
        require(resolved, "Not resolved");
        require(!disputed, "Already disputed");
        require(block.timestamp <= resolvedAt + DISPUTE_WINDOW, "Dispute window closed");
        // Must have a stake in the game
        require(
            yesDeposits[msg.sender] > 0 || noDeposits[msg.sender] > 0,
            "No stake"
        );

        disputed = true;
        emit Disputed(msg.sender);
    }

    /// @notice Creator can settle a dispute with corrected supply data
    function settleDispute(uint256 _correctedSupply) external onlyCreator {
        require(disputed, "No active dispute");

        latestSupply = _correctedSupply;
        reached      = _correctedSupply >= threshold;
        disputed     = false;

        emit DisputeSettled(reached);
    }

    /* ── Claim ────────────────────────────────────── */
    function claim() external nonReentrant {
        require(resolved, "Not resolved");
        require(!disputed, "Dispute in progress");
        require(block.timestamp > resolvedAt + DISPUTE_WINDOW, "Dispute window active");
        require(!claimed[msg.sender], "Already claimed");

        uint256 userDeposit;
        uint256 winningPool;
        uint256 losingPool;

        if (reached) {
            userDeposit = yesDeposits[msg.sender];
            winningPool = totalYes;
            losingPool  = totalNo;
        } else {
            userDeposit = noDeposits[msg.sender];
            winningPool = totalNo;
            losingPool  = totalYes;
        }

        require(userDeposit > 0, "No winnings");
        claimed[msg.sender] = true;

        uint256 payout;
        if (losingPool == 0) {
            // No opposing bets → refund
            payout = userDeposit;
        } else {
            payout = (userDeposit * (winningPool + losingPool)) / winningPool;
        }

        _safeTransfer(msg.sender, payout);
        emit Claimed(msg.sender, payout);
    }

    /* ── Auto-Timeout Refund ──────────────────────── */
    /// @notice If market is not resolved within REFUND_GRACE after deadline,
    ///         any depositor can claim a full refund of their deposits.
    function refund() external nonReentrant {
        require(!resolved, "Already resolved");
        require(block.timestamp >= deadline + REFUND_GRACE, "Grace period active");
        require(!claimed[msg.sender], "Already refunded");

        uint256 total = yesDeposits[msg.sender] + noDeposits[msg.sender];
        require(total > 0, "Nothing to refund");

        claimed[msg.sender] = true;
        yesDeposits[msg.sender] = 0;
        noDeposits[msg.sender]  = 0;

        _safeTransfer(msg.sender, total);
        emit Refunded(msg.sender, total);
    }

    /* ── Admin ────────────────────────────────────── */
    function setPaused(bool _paused) external onlyCreator {
        paused = _paused;
        emit Paused(_paused);
    }

    /* ── Views ────────────────────────────────────── */
    function totalPool() external view returns (uint256) {
        return totalYes + totalNo;
    }

    function userPosition(address _user) external view returns (uint256 yes, uint256 no) {
        return (yesDeposits[_user], noDeposits[_user]);
    }

    function isDisputable() external view returns (bool) {
        return resolved && !disputed && block.timestamp <= resolvedAt + DISPUTE_WINDOW;
    }

    function isRefundable() external view returns (bool) {
        return !resolved && block.timestamp >= deadline + REFUND_GRACE;
    }

    function marketInfo() external view returns (
        address _token,
        uint256 _threshold,
        uint256 _deadline,
        uint256 _initialSupply,
        uint256 _latestSupply,
        uint256 _totalYes,
        uint256 _totalNo,
        bool _resolved,
        bool _reached,
        bool _disputed,
        bool _paused
    ) {
        return (token, threshold, deadline, initialSupply, latestSupply, totalYes, totalNo, resolved, reached, disputed, paused);
    }

    /* ── Internal ─────────────────────────────────── */
    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH transfer failed");
    }
}
