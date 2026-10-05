// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/NaiveOrderBook.sol";
import "../contracts/PageSyncOrderBook.sol";
import "../contracts/interfaces/IOrderBook.sol";

abstract contract StorageCorrectnessTest is Test {
    IOrderBook internal book;

    address internal trader = address(0xBEEF);

    function _readOrder(uint256 orderId)
        internal
        view
        virtual
        returns (
            address owner,
            uint256 price,
            uint256 quantity,
            IOrderBook.Side side,
            IOrderBook.Status status
        );

    function _place(uint256 orderId, uint256 price, uint256 quantity, IOrderBook.Side side) internal {
        vm.prank(trader);
        book.placeOrder(orderId, price, quantity, side);
    }

    function test_storageState_survivesFullLifecycle() public {
        _place(1, 1_000, 10, IOrderBook.Side.BUY);

        (address owner, uint256 price, uint256 quantity, IOrderBook.Side side, IOrderBook.Status status) =
            _readOrder(1);
        assertEq(owner, trader);
        assertEq(price, 1_000);
        assertEq(quantity, 10);
        assertEq(uint8(side), uint8(IOrderBook.Side.BUY));
        assertEq(uint8(status), uint8(IOrderBook.Status.ACTIVE));

        vm.prank(trader);
        book.updateOrder(1, 1_010, 15);
        (, price, quantity, side, status) = _readOrder(1);
        assertEq(price, 1_010);
        assertEq(quantity, 15);
        assertEq(uint8(side), uint8(IOrderBook.Side.BUY));
        assertEq(uint8(status), uint8(IOrderBook.Status.ACTIVE));

        vm.prank(trader);
        book.cancelOrder(1);
        (, price, quantity, side, status) = _readOrder(1);
        assertEq(price, 1_010);
        assertEq(quantity, 15);
        assertEq(uint8(side), uint8(IOrderBook.Side.BUY));
        assertEq(uint8(status), uint8(IOrderBook.Status.CANCELLED));

        _place(2, 2_000, 20, IOrderBook.Side.SELL);
        vm.prank(trader);
        book.executeTrade(2);
        (owner, price, quantity, side, status) = _readOrder(2);
        assertEq(owner, trader);
        assertEq(price, 2_000);
        assertEq(quantity, 20);
        assertEq(uint8(side), uint8(IOrderBook.Side.SELL));
        assertEq(uint8(status), uint8(IOrderBook.Status.EXECUTED));
    }
}

contract NaiveStorageCorrectnessTest is StorageCorrectnessTest {
    function setUp() public {
        book = IOrderBook(address(new NaiveOrderBook()));
    }

    function _readOrder(uint256 orderId)
        internal
        view
        override
        returns (
            address owner,
            uint256 price,
            uint256 quantity,
            IOrderBook.Side side,
            IOrderBook.Status status
        )
    {
        (owner, price, quantity, side, status) = NaiveOrderBook(address(book)).orders(orderId);
    }
}

contract PageSyncStorageCorrectnessTest is StorageCorrectnessTest {
    function setUp() public {
        book = IOrderBook(address(new PageSyncOrderBook()));
    }

    function _readOrder(uint256 orderId)
        internal
        view
        override
        returns (
            address owner,
            uint256 price,
            uint256 quantity,
            IOrderBook.Side side,
            IOrderBook.Status status
        )
    {
        (owner, price, quantity, side, status) = PageSyncOrderBook(address(book)).getOrder(orderId);
    }
}

contract StorageGasBenchmark is Test {
    address internal trader = address(0xBEEF);
    NaiveOrderBook internal naive;
    PageSyncOrderBook internal pagesync;

    function setUp() public {
        naive = new NaiveOrderBook();
        pagesync = new PageSyncOrderBook();
    }

    function _seed() internal {
        vm.startPrank(trader);
        naive.placeOrder(1, 1_000, 10, IOrderBook.Side.BUY);
        naive.placeOrder(2, 2_000, 20, IOrderBook.Side.SELL);
        pagesync.placeOrder(1, 1_000, 10, IOrderBook.Side.BUY);
        pagesync.placeOrder(2, 2_000, 20, IOrderBook.Side.SELL);
        vm.stopPrank();
    }

    function testGas_naive_firstPlacement() public {
        vm.prank(trader);
        naive.placeOrder(3, 3_000, 30, IOrderBook.Side.BUY);
    }

    function testGas_pagesync_firstPlacement() public {
        vm.prank(trader);
        pagesync.placeOrder(3, 3_000, 30, IOrderBook.Side.BUY);
    }

    function testGas_naive_secondPlacement() public {
        vm.prank(trader);
        naive.placeOrder(3, 3_000, 30, IOrderBook.Side.BUY);
        vm.prank(trader);
        naive.placeOrder(4, 4_000, 40, IOrderBook.Side.SELL);
    }

    function testGas_pagesync_secondPlacement() public {
        vm.prank(trader);
        pagesync.placeOrder(3, 3_000, 30, IOrderBook.Side.BUY);
        vm.prank(trader);
        pagesync.placeOrder(4, 4_000, 40, IOrderBook.Side.SELL);
    }

    function testGas_naive_update() public {
        _seed();
        vm.prank(trader);
        naive.updateOrder(1, 1_010, 15);
    }

    function testGas_pagesync_update() public {
        _seed();
        vm.prank(trader);
        pagesync.updateOrder(1, 1_010, 15);
    }

    function testGas_naive_cancel() public {
        _seed();
        vm.prank(trader);
        naive.cancelOrder(1);
    }

    function testGas_pagesync_cancel() public {
        _seed();
        vm.prank(trader);
        pagesync.cancelOrder(1);
    }

    function testGas_naive_execute() public {
        _seed();
        vm.prank(trader);
        naive.executeTrade(2);
    }

    function testGas_pagesync_execute() public {
        _seed();
        vm.prank(trader);
        pagesync.executeTrade(2);
    }

    function testGas_naive_repeatedSameOrderInTransaction() public {
        _seed();
        vm.startPrank(trader);
        naive.updateOrder(1, 1_010, 15);
        naive.updateOrder(1, 1_020, 20);
        vm.stopPrank();
    }

    function testGas_pagesync_repeatedSameOrderInTransaction() public {
        _seed();
        vm.startPrank(trader);
        pagesync.updateOrder(1, 1_010, 15);
        pagesync.updateOrder(1, 1_020, 20);
        vm.stopPrank();
    }

    function testGas_naive_differentOrdersInTransaction() public {
        _seed();
        vm.startPrank(trader);
        naive.updateOrder(1, 1_010, 15);
        naive.updateOrder(2, 2_010, 25);
        vm.stopPrank();
    }

    function testGas_pagesync_differentOrdersInTransaction() public {
        _seed();
        vm.startPrank(trader);
        pagesync.updateOrder(1, 1_010, 15);
        pagesync.updateOrder(2, 2_010, 25);
        vm.stopPrank();
    }
}
