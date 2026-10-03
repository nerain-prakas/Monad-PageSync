// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOrderBook - Common interface for both NaiveOrderBook and PageSyncOrderBook
interface IOrderBook {
    // -------------------------------------------------------------------------
    // Enumerations
    // -------------------------------------------------------------------------

    enum Side   { BUY, SELL }
    enum Status { ACTIVE, CANCELLED, EXECUTED }

    // -------------------------------------------------------------------------
    // Events  (FR-10)
    // -------------------------------------------------------------------------

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        uint256 price,
        uint256 quantity,
        Side    side
    );

    event OrderUpdated(
        uint256 indexed orderId,
        uint256 price,
        uint256 quantity
    );

    event OrderCancelled(
        uint256 indexed orderId
    );

    event TradeExecuted(
        uint256 indexed orderId,
        uint256 price,
        uint256 quantity
    );

    // -------------------------------------------------------------------------
    // Core operations  (FR-01 … FR-04)
    // -------------------------------------------------------------------------

    function placeOrder(
        uint256 orderId,
        uint256 price,
        uint256 quantity,
        Side    side
    ) external;

    function updateOrder(
        uint256 orderId,
        uint256 newPrice,
        uint256 newQuantity
    ) external;

    function cancelOrder(uint256 orderId) external;

    function executeTrade(uint256 orderId) external;

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getOrderCount() external view returns (uint256);
}
