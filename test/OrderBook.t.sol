// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/NaiveOrderBook.sol";
import "../contracts/PageSyncOrderBook.sol";
import "../contracts/interfaces/IOrderBook.sol";

/// @notice Shared correctness tests executed against BOTH implementations.
///         The abstract base is inherited by NaiveOrderBookTest and
///         PageSyncOrderBookTest so the full suite runs on each contract.
abstract contract OrderBookTest is Test {
    IOrderBook internal book;

    address internal alice = address(0xA11CE);
    address internal bob   = address(0xB0B);

    // -------------------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------------------

    function _place(uint256 id, uint256 price, uint256 qty, IOrderBook.Side side) internal {
        book.placeOrder(id, price, qty, side);
    }

    // -------------------------------------------------------------------------
    // FR-01 — Place Order
    // -------------------------------------------------------------------------

    function test_placeOrder_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit IOrderBook.OrderPlaced(1, alice, 1000, 10, IOrderBook.Side.BUY);
        _place(1, 1000, 10, IOrderBook.Side.BUY);
    }

    function test_placeOrder_rejectsZeroPrice() public {
        vm.prank(alice);
        vm.expectRevert();
        _place(1, 0, 10, IOrderBook.Side.BUY);
    }

    function test_placeOrder_rejectsZeroQuantity() public {
        vm.prank(alice);
        vm.expectRevert();
        _place(1, 1000, 0, IOrderBook.Side.BUY);
    }

    function test_placeOrder_rejectsDuplicateId() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(alice);
        vm.expectRevert();
        _place(1, 2000, 20, IOrderBook.Side.SELL);
    }

    function test_placeOrder_incrementsCount() public {
        assertEq(book.getOrderCount(), 0);
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        assertEq(book.getOrderCount(), 1);
        vm.prank(alice); _place(2, 2000, 5,  IOrderBook.Side.SELL);
        assertEq(book.getOrderCount(), 2);
    }

    // -------------------------------------------------------------------------
    // FR-02 — Update Order
    // -------------------------------------------------------------------------

    function test_updateOrder_emitsEvent() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit IOrderBook.OrderUpdated(1, 1010, 15);
        book.updateOrder(1, 1010, 15);
    }

    function test_updateOrder_rejectsNonOwner() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(bob);
        vm.expectRevert();
        book.updateOrder(1, 2000, 5);
    }

    function test_updateOrder_rejectsZeroPrice() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(alice);
        vm.expectRevert();
        book.updateOrder(1, 0, 10);
    }

    function test_updateOrder_rejectsZeroQuantity() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(alice);
        vm.expectRevert();
        book.updateOrder(1, 1000, 0);
    }

    function test_updateOrder_rejectsCancelledOrder() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(alice); book.cancelOrder(1);
        vm.prank(alice);
        vm.expectRevert();
        book.updateOrder(1, 500, 5);
    }

    function test_updateOrder_rejectsExecutedOrder() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        book.executeTrade(1);
        vm.prank(alice);
        vm.expectRevert();
        book.updateOrder(1, 500, 5);
    }

    // -------------------------------------------------------------------------
    // FR-03 — Cancel Order
    // -------------------------------------------------------------------------

    function test_cancelOrder_emitsEvent() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit IOrderBook.OrderCancelled(1);
        book.cancelOrder(1);
    }

    function test_cancelOrder_rejectsNonOwner() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(bob);
        vm.expectRevert();
        book.cancelOrder(1);
    }

    function test_cancelOrder_rejectsAlreadyCancelled() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(alice); book.cancelOrder(1);
        vm.prank(alice);
        vm.expectRevert();
        book.cancelOrder(1);
    }

    function test_cancelOrder_rejectsExecuted() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        book.executeTrade(1);
        vm.prank(alice);
        vm.expectRevert();
        book.cancelOrder(1);
    }

    // -------------------------------------------------------------------------
    // FR-04 — Execute Trade
    // -------------------------------------------------------------------------

    function test_executeTrade_emitsEvent() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.expectEmit(true, false, false, true);
        emit IOrderBook.TradeExecuted(1, 1000, 10);
        book.executeTrade(1);
    }

    function test_executeTrade_rejectsCancelled() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        vm.prank(alice); book.cancelOrder(1);
        vm.expectRevert();
        book.executeTrade(1);
    }

    function test_executeTrade_rejectsAlreadyExecuted() public {
        vm.prank(alice); _place(1, 1000, 10, IOrderBook.Side.BUY);
        book.executeTrade(1);
        vm.expectRevert();
        book.executeTrade(1);
    }

    function test_executeTrade_rejectsNonExistentOrder() public {
        vm.expectRevert();
        book.executeTrade(999);
    }
}

// ---------------------------------------------------------------------------
// Concrete test classes — each runs the full suite above
// ---------------------------------------------------------------------------

contract NaiveOrderBookTest is OrderBookTest {
    function setUp() public {
        book = new NaiveOrderBook();
    }
}

contract PageSyncOrderBookTest is OrderBookTest {
    function setUp() public {
        book = new PageSyncOrderBook();
    }
}
