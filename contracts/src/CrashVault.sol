// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title CrashVault
 * @notice Escrows $BLACKBALLS wagers for the Blackballs crash game and routes
 *         house revenue through a deflationary 30% burn / 70% treasury split.
 * @dev Deploy on Robinhood Chain (EVM-compatible Arbitrum L2).
 *      Backend signer authorizes payouts and loss processing off-chain after
 *      provably-fair round resolution.
 */
contract CrashVault is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @dev 30% of house revenue is burned (3000 basis points).
    uint256 public constant BURN_BPS = 3000;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @dev Standard dead address for ERC20s without a native burn().
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // -------------------------------------------------------------------------
    // Immutables & config
    // -------------------------------------------------------------------------

    IERC20 public immutable blackballsToken;

    /// @notice Receives 70% of house revenue (boss raids, platform profit).
    address public houseTreasury;

    /// @notice Authorized Node.js backend hot wallet.
    address public backendSigner;

    /**
     * @notice If true, call `burn(uint256)` on the token.
     *         If false, transfer burned portion to DEAD address.
     */
    bool public burnViaNativeBurn;

    // -------------------------------------------------------------------------
    // Accounting
    // -------------------------------------------------------------------------

    /// @notice Per-player escrowed session balance (margin available for wagers).
    mapping(address => uint256) public sessionBalances;

    /// @notice Sum of all session balances for off-chain reconciliation.
    uint256 public totalEscrowed;

    /// @notice Cumulative tokens sent to burn address / burn().
    uint256 public totalBurned;

    /// @notice Cumulative tokens sent to house treasury.
    uint256 public totalTreasuryRouted;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event WagerPlaced(address indexed player, uint256 amount, uint256 newSessionBalance);

    event PayoutIssued(address indexed player, uint256 amount, address indexed authorizedBy);

    event PlayerLossProcessed(
        address indexed player,
        uint256 amount,
        uint256 burned,
        uint256 toTreasury,
        string reason
    );

    event RakeCollected(uint256 amount, uint256 burned, uint256 toTreasury);

    event TokensBurned(uint256 amount, bool viaNativeBurn);

    event TreasuryFunded(address indexed treasury, uint256 amount);

    event BackendSignerUpdated(address indexed previousSigner, address indexed newSigner);

    event HouseTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    event BurnModeUpdated(bool burnViaNativeBurn);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error ZeroAmount();
    error UnauthorizedBackend();
    error InsufficientSessionBalance(address player, uint256 requested, uint256 available);
    error InsufficientVaultLiquidity(uint256 requested, uint256 available);

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyBackend() {
        if (msg.sender != backendSigner) revert UnauthorizedBackend();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        IERC20 token_,
        address houseTreasury_,
        address backendSigner_,
        bool burnViaNativeBurn_
    ) Ownable(msg.sender) {
        if (address(token_) == address(0)) revert ZeroAddress();
        if (houseTreasury_ == address(0)) revert ZeroAddress();
        if (backendSigner_ == address(0)) revert ZeroAddress();

        blackballsToken = token_;
        houseTreasury = houseTreasury_;
        backendSigner = backendSigner_;
        burnViaNativeBurn = burnViaNativeBurn_;
    }

    // -------------------------------------------------------------------------
    // Player-facing
    // -------------------------------------------------------------------------

    /**
     * @notice Deposit $BLACKBALLS into the vault to fund a crash session.
     * @dev Player must `approve` this contract before calling.
     * @param amount Token amount in smallest units (wei).
     */
    function depositWager(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        blackballsToken.safeTransferFrom(msg.sender, address(this), amount);

        sessionBalances[msg.sender] += amount;
        totalEscrowed += amount;

        emit WagerPlaced(msg.sender, amount, sessionBalances[msg.sender]);
    }

    /**
     * @notice Withdraw unused session balance back to the player wallet.
     * @param amount Amount to withdraw from escrow.
     */
    function withdrawSession(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 balance = sessionBalances[msg.sender];
        if (balance < amount) {
            revert InsufficientSessionBalance(msg.sender, amount, balance);
        }

        sessionBalances[msg.sender] = balance - amount;
        totalEscrowed -= amount;

        blackballsToken.safeTransfer(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Backend-authorized settlement
    // -------------------------------------------------------------------------

    /**
     * @notice Pay a player after a successful cash-out.
     * @dev Backend computes payout off-chain (margin + PnL + bonuses).
     *      Deducts up to `amount` from the player's session balance first;
     *      any excess profit is paid from house liquidity in the vault.
     * @param player Recipient wallet.
     * @param amount Gross payout in token wei.
     */
    function payoutWin(address player, uint256 amount) external onlyBackend nonReentrant {
        if (player == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 vaultBalance = blackballsToken.balanceOf(address(this));
        if (vaultBalance < amount) {
            revert InsufficientVaultLiquidity(amount, vaultBalance);
        }

        uint256 sessionBal = sessionBalances[player];
        uint256 deductedFromSession = amount > sessionBal ? sessionBal : amount;

        if (deductedFromSession > 0) {
            sessionBalances[player] = sessionBal - deductedFromSession;
            totalEscrowed -= deductedFromSession;
        }

        blackballsToken.safeTransfer(player, amount);

        emit PayoutIssued(player, amount, msg.sender);
    }

    /**
     * @notice Process a player loss (rug, liquidation, or full margin wipe).
     * @dev Confiscates `amount` from the player's session balance and routes
     *      it through the 30% burn / 70% treasury split.
     * @param player Losing player wallet.
     * @param amount Confiscated margin in token wei.
     * @param reason Indexable reason string (e.g. "RUG", "LIQUIDATED").
     */
    function processLoss(
        address player,
        uint256 amount,
        string calldata reason
    ) external onlyBackend nonReentrant {
        if (player == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 sessionBal = sessionBalances[player];
        if (sessionBal < amount) {
            revert InsufficientSessionBalance(player, amount, sessionBal);
        }

        sessionBalances[player] = sessionBal - amount;
        totalEscrowed -= amount;

        (uint256 burned, uint256 toTreasury) = _splitHouseRevenue(amount);

        emit PlayerLossProcessed(player, amount, burned, toTreasury, reason);
    }

    /**
     * @notice Collect a platform rake fee already held in the vault.
     * @dev Use when rake is skimmed during settlement rather than from session.
     * @param amount Rake amount to split burn / treasury.
     */
    function collectRake(uint256 amount) external onlyBackend nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 vaultBalance = blackballsToken.balanceOf(address(this));
        if (vaultBalance < amount) {
            revert InsufficientVaultLiquidity(amount, vaultBalance);
        }

        (uint256 burned, uint256 toTreasury) = _splitHouseRevenue(amount);

        emit RakeCollected(amount, burned, toTreasury);
    }

    // -------------------------------------------------------------------------
    // Internal — deflationary house burn
    // -------------------------------------------------------------------------

    /**
     * @notice Split house revenue: 30% burn, 70% treasury.
     * @param amount Gross house revenue still held in this contract.
     * @return burned Amount destroyed or sent to DEAD.
     * @return toTreasury Amount sent to houseTreasury.
     */
    function _splitHouseRevenue(uint256 amount)
        internal
        returns (uint256 burned, uint256 toTreasury)
    {
        burned = (amount * BURN_BPS) / BPS_DENOMINATOR;
        toTreasury = amount - burned;

        if (burned > 0) {
            burnHouseFees(burned);
        }

        if (toTreasury > 0) {
            blackballsToken.safeTransfer(houseTreasury, toTreasury);
            totalTreasuryRouted += toTreasury;
            emit TreasuryFunded(houseTreasury, toTreasury);
        }
    }

    /**
     * @notice Burn house fees — native `burn()` or DEAD transfer.
     * @param amount Tokens to remove from circulating supply.
     */
    function burnHouseFees(uint256 amount) internal {
        if (amount == 0) return;

        if (burnViaNativeBurn) {
            (bool ok, bytes memory data) = address(blackballsToken).call(
                abi.encodeWithSignature("burn(uint256)", amount)
            );
            require(ok && (data.length == 0 || abi.decode(data, (bool))), "Burn failed");
        } else {
            blackballsToken.safeTransfer(DEAD, amount);
        }

        totalBurned += amount;
        emit TokensBurned(amount, burnViaNativeBurn);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setBackendSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit BackendSignerUpdated(backendSigner, newSigner);
        backendSigner = newSigner;
    }

    function setHouseTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit HouseTreasuryUpdated(houseTreasury, newTreasury);
        houseTreasury = newTreasury;
    }

    function setBurnViaNativeBurn(bool enabled) external onlyOwner {
        burnViaNativeBurn = enabled;
        emit BurnModeUpdated(enabled);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function sessionBalanceOf(address player) external view returns (uint256) {
        return sessionBalances[player];
    }

    function vaultBalance() external view returns (uint256) {
        return blackballsToken.balanceOf(address(this));
    }
}
