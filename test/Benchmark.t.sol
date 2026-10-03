// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import "../contracts/NaiveOrderBook.sol";
import "../contracts/PageSyncOrderBook.sol";
import "../contracts/interfaces/IOrderBook.sol";

/// @notice Gas benchmark — same workload on both implementations.
/// Run with: forge test --match-contract GasBenchmark --gas-report -vv
contract GasBenchmark is Test {
    uint256 constant PLACE_COUNT  = 100;
    uint256 constant UPDATE_COUNT = 100;
    uint256 constant CANCEL_COUNT = 50;
    uint256 constant EXEC_COUNT   = 50;

    NaiveOrderBook    internal naive;
    PageSyncOrderBook internal pagesync;

    address internal trader = address(0xBEEF);

    function setUp() public {
        naive    = new NaiveOrderBook();
        pagesync = new PageSyncOrderBook();
        vm.deal(trader, 100 ether);
    }

    // =========================================================================
    // Naive benchmarks
    // =========================================================================

    function test_naive_placeOrder() public {
        vm.startPrank(trader);
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            naive.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
        }
        vm.stopPrank();
    }

    function test_naive_updateOrder() public {
        vm.startPrank(trader);
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            naive.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
        }
        for (uint256 i = 1; i <= UPDATE_COUNT; i++) {
            naive.updateOrder(i, 1010 + i, 15 + i);
        }
        vm.stopPrank();
    }

    function test_naive_cancelOrder() public {
        vm.startPrank(trader);
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            naive.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
        }
        for (uint256 i = 1; i <= CANCEL_COUNT; i++) {
            naive.cancelOrder(i);
        }
        vm.stopPrank();
    }

    function test_naive_executeTrade() public {
        vm.startPrank(trader);
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            naive.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
        }
        uint256 startId = CANCEL_COUNT + 1;
        for (uint256 i = startId; i <= startId + EXEC_COUNT - 1; i++) {
            naive.executeTrade(i);
        }
        vm.stopPrank();
    }

    // =========================================================================
    // PageSync benchmarks
    // =========================================================================

    function test_pagesync_placeOrder() public {
        vm.startPrank(trader);
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            pagesync.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
        }
        vm.stopPrank();
    }

    function test_pagesync_updateOrder() public {
        vm.startPrank(trader);
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            pagesync.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
        }
        for (uint256 i = 1; i <= UPDATE_COUNT; i++) {
            pagesync.updateOrder(i, 1010 + i, 15 + i);
        }
        vm.stopPrank();
    }

    function test_pagesync_cancelOrder() public {
        vm.startPrank(trader);
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            pagesync.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
        }
        for (uint256 i = 1; i <= CANCEL_COUNT; i++) {
            pagesync.cancelOrder(i);
        }
        vm.stopPrank();
    }

    function test_pagesync_executeTrade() public {
        vm.startPrank(trader);
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            pagesync.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
        }
        uint256 startId = CANCEL_COUNT + 1;
        for (uint256 i = startId; i <= startId + EXEC_COUNT - 1; i++) {
            pagesync.executeTrade(i);
        }
        vm.stopPrank();
    }
}
