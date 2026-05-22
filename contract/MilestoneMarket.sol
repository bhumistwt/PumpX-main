pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MilestoneMarket is ReentrancyGuard {
    address public immutable token;
    uint256 public immutable threshold;
    uint256 public immutable deadline;
    address public immutable creator;

    uint256 public immutable initialSupply;
    uint256 public latestSupply;

    bool public resolved;
    bool public reached;

    // YES/NO pools
    mapping(address => uint256) public yesDeposits;
    mapping(address => uint256) public noDeposits;

    uint256 public totalYes;
    uint256 public totalNo;

    mapping(address => bool) public claimed;

    event Deposited(address indexed user, bool isYes, uint256 amount);
    event Resolved(bool reached);
    event Claimed(address indexed user, uint256 amount);
    event SupplyUpdated(uint256 newSupply);

    constructor(
        address _token,
        uint256 _threshold,
        uint256 _deadline,
        address _creator,
        uint256 _currentSupply
    ) {
        require(_deadline > block.timestamp, "Deadline in past");
        require(_threshold > _currentSupply, "Threshold must exceed current supply");

        token = _token;
        threshold = _threshold;
        deadline = _deadline;
        creator = _creator;

        initialSupply = _currentSupply;
        latestSupply = _currentSupply;
    }

    // 🔵 Update supply (frontend feeds mainnet data)
    function updateSupply(uint256 _newSupply) external {
        require(!resolved, "Already resolved");
        latestSupply = _newSupply;
        emit SupplyUpdated(_newSupply);
    }

    // 🟢 Bet YES
    function depositYes() external payable nonReentrant {
        require(block.timestamp < deadline, "Market ended");
        require(!resolved, "Already resolved");
        require(msg.value > 0, "Zero deposit");

        yesDeposits[msg.sender] += msg.value;
        totalYes += msg.value;

        emit Deposited(msg.sender, true, msg.value);
    }

    // 🔴 Bet NO
    function depositNo() external payable nonReentrant {
        require(block.timestamp < deadline, "Market ended");
        require(!resolved, "Already resolved");
        require(msg.value > 0, "Zero deposit");

        noDeposits[msg.sender] += msg.value;
        totalNo += msg.value;

        emit Deposited(msg.sender, false, msg.value);
    }

    // 🔍 Check milestone
    function checkMilestone() public view returns (bool) {
        return latestSupply >= threshold;
    }

    // 🟡 Resolve
    function resolve() external {
        require(block.timestamp >= deadline, "Not ended");
        require(!resolved, "Already resolved");

        reached = checkMilestone();
        resolved = true;

        emit Resolved(reached);
    }

    // 💰 Claim winnings
    function claim() external nonReentrant {
        require(resolved, "Not resolved");
        require(!claimed[msg.sender], "Already claimed");

        uint256 userDeposit;
        uint256 winningPool;
        uint256 losingPool;

        if (reached) {
            // YES wins
            userDeposit = yesDeposits[msg.sender];
            winningPool = totalYes;
            losingPool = totalNo;
        } else {
            // NO wins
            userDeposit = noDeposits[msg.sender];
            winningPool = totalNo;
            losingPool = totalYes;
        }

        require(userDeposit > 0, "No winnings");

        claimed[msg.sender] = true;

        uint256 totalPool = winningPool + losingPool;

        // If only one side exists → refund proportional
        if (losingPool == 0) {
            payable(msg.sender).transfer(userDeposit);
            emit Claimed(msg.sender, userDeposit);
            return;
        }

        uint256 payout = (userDeposit * totalPool) / winningPool;

        payable(msg.sender).transfer(payout);

        emit Claimed(msg.sender, payout);
    }
}
ld,
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
