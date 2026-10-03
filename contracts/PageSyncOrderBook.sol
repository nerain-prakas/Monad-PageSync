// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IOrderBook.sol";

/// @title PageSyncOrderBook
/// @notice Page-aware order book designed around Monad's storage-page behavior.
///
/// # Storage Layout Design (FR-06)
///
/// ## Monad Storage Pages
/// Monad partitions contract storage into 128-slot pages.
/// When any slot on a page is first accessed, the page is "warmed" in the
/// execution engine's cache. Subsequent accesses to OTHER slots on the SAME
/// page incur a lower penalty than cold accesses.
///
/// ## Packing Strategy
/// All fields of an order are packed into 2 storage slots instead of 5,
/// so they always land on the same storage page.
///
/// PackedOrder layout:
///
///   data1  (slot +0, 32 bytes)
///     bits [255:96]  = trader address (160 bits)
///     bits [95:16]   = price          (80 bits, max ~1.2e24)
///     bits [15:0]    = reserved
///
///   data2  (slot +1, 32 bytes)
///     bits [255:128] = quantity (128 bits)
///     bits [127:120] = side     (8 bits)
///     bits [119:112] = status   (8 bits)
///     bits [111:0]   = padding
///
/// ## Benefit vs Naive
///   placeOrder  : 2 slots written   (vs 5 in Naive)
///   updateOrder : 2 slots touched   (vs 2 but potentially on different pages in Naive)
///   cancelOrder : 1 slot (data2)    (same as Naive)
///   executeTrade: 1 slot (data2)    (same as Naive)
///
/// Both data1 and data2 are consecutive in storage for the same orderId, so
/// they are guaranteed to be on the same 128-slot page when orderIds are used
/// in contiguous ranges.
contract PageSyncOrderBook is IOrderBook {
    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @dev Packed order: 2 storage slots instead of 5.
    struct PackedOrder {
        /// slot 0: trader (160 bits) | price (80 bits) | reserved (16 bits)
        uint256 data1;
        /// slot 1: quantity (128 bits) | side (8 bits) | status (8 bits) | padding (112 bits)
        uint256 data2;
    }

    mapping(uint256 => PackedOrder) private _orders;

    uint256 private _orderCount;

    // -------------------------------------------------------------------------
    // Bit masks & offsets
    // -------------------------------------------------------------------------

    uint256 private constant MASK_PRICE80  = (1 << 80)  - 1;
    uint256 private constant MASK_QTY128   = (1 << 128) - 1;
    uint256 private constant MASK_BYTE     = 0xFF;

    // data1 offsets
    uint256 private constant OFFSET_TRADER = 96;   // bits 255:96  (160 bits)
    uint256 private constant OFFSET_PRICE  = 16;   // bits 95:16   (80 bits)

    // data2 offsets
    uint256 private constant OFFSET_QTY    = 128;  // bits 255:128 (128 bits)
    uint256 private constant OFFSET_SIDE   = 120;  // bits 127:120 (8 bits)
    uint256 private constant OFFSET_STATUS = 112;  // bits 119:112 (8 bits)

    // -------------------------------------------------------------------------
    // Internal decoders
    // -------------------------------------------------------------------------

    function _traderOf(uint256 d1) private pure returns (address) {
        return address(uint160(d1 >> OFFSET_TRADER));
    }

    function _statusOf(uint256 d2) private pure returns (Status) {
        return Status(uint8((d2 >> OFFSET_STATUS) & MASK_BYTE));
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier orderExists(uint256 orderId) {
        require(_orders[orderId].data1 != 0, "Order does not exist");
        _;
    }

    modifier onlyTrader(uint256 orderId) {
        require(msg.sender == _traderOf(_orders[orderId].data1), "Not order owner");
        _;
    }

    modifier onlyActive(uint256 orderId) {
        require(_statusOf(_orders[orderId].data2) == Status.ACTIVE, "Order not active");
        _;
    }

    // -------------------------------------------------------------------------
    // FR-01 — Place Order
    // -------------------------------------------------------------------------

    function placeOrder(
        uint256 orderId,
        uint256 price,
        uint256 quantity,
        Side    side
    ) external override {
        require(price    > 0,          "Invalid price");
        require(quantity > 0,          "Invalid quantity");
        require(_orders[orderId].data1 == 0, "Order ID already used");
        require(price    < (1 << 80),  "Price overflow");
        require(quantity < (1 << 128), "Quantity overflow");

        // Pack data1: trader | price | reserved(0)
        uint256 d1 = (uint256(uint160(msg.sender)) << OFFSET_TRADER)
                   | (price << OFFSET_PRICE);

        // Pack data2: quantity | side | status(ACTIVE=0) | padding
        uint256 d2 = (quantity << OFFSET_QTY)
                   | (uint256(uint8(side))           << OFFSET_SIDE)
                   | (uint256(uint8(Status.ACTIVE))  << OFFSET_STATUS);

        _orders[orderId] = PackedOrder({ data1: d1, data2: d2 });

        unchecked { _orderCount++; }

        emit OrderPlaced(orderId, msg.sender, price, quantity, side);
    }

    // -------------------------------------------------------------------------
    // FR-02 — Update Order
    // -------------------------------------------------------------------------

    function updateOrder(
        uint256 orderId,
        uint256 newPrice,
        uint256 newQuantity
    ) external override orderExists(orderId) onlyTrader(orderId) onlyActive(orderId) {
        require(newPrice    > 0,          "Invalid price");
        require(newQuantity > 0,          "Invalid quantity");
        require(newPrice    < (1 << 80),  "Price overflow");
        require(newQuantity < (1 << 128), "Quantity overflow");

        PackedOrder storage o = _orders[orderId];

        // Update price in data1 (keep trader bits, clear old price, set new)
        uint256 d1 = o.data1;
        d1 = (d1 & ~(MASK_PRICE80 << OFFSET_PRICE)) | (newPrice << OFFSET_PRICE);
        o.data1 = d1;

        // Update quantity in data2 (keep side/status bits)
        uint256 d2 = o.data2;
        d2 = (d2 & ~(MASK_QTY128 << OFFSET_QTY)) | (newQuantity << OFFSET_QTY);
        o.data2 = d2;

        emit OrderUpdated(orderId, newPrice, newQuantity);
    }

    // -------------------------------------------------------------------------
    // FR-03 — Cancel Order
    // -------------------------------------------------------------------------

    function cancelOrder(uint256 orderId)
        external override
        orderExists(orderId)
        onlyTrader(orderId)
        onlyActive(orderId)
    {
        uint256 d2 = _orders[orderId].data2;
        d2 = (d2 & ~(MASK_BYTE << OFFSET_STATUS))
           | (uint256(uint8(Status.CANCELLED)) << OFFSET_STATUS);
        _orders[orderId].data2 = d2;

        emit OrderCancelled(orderId);
    }

    // -------------------------------------------------------------------------
    // FR-04 — Execute Trade
    // -------------------------------------------------------------------------

    function executeTrade(uint256 orderId)
        external override
        orderExists(orderId)
        onlyActive(orderId)
    {
        PackedOrder storage o = _orders[orderId];
        uint256 d2 = o.data2;

        uint256 price    = (o.data1 >> OFFSET_PRICE) & MASK_PRICE80;
        uint256 quantity = (d2      >> OFFSET_QTY)   & MASK_QTY128;

        d2 = (d2 & ~(MASK_BYTE << OFFSET_STATUS))
           | (uint256(uint8(Status.EXECUTED)) << OFFSET_STATUS);
        o.data2 = d2;

        emit TradeExecuted(orderId, price, quantity);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getOrderCount() external view override returns (uint256) {
        return _orderCount;
    }

    /// @notice Decode and return a human-readable order for off-chain tooling.
    function getOrder(uint256 orderId)
        external view
        returns (
            address trader,
            uint256 price,
            uint256 quantity,
            Side    side,
            Status  status
        )
    {
        PackedOrder storage o = _orders[orderId];
        require(o.data1 != 0, "Order does not exist");
        trader   = _traderOf(o.data1);
        price    = (o.data1 >> OFFSET_PRICE) & MASK_PRICE80;
        quantity = (o.data2 >> OFFSET_QTY)   & MASK_QTY128;
        side     = Side  (uint8((o.data2 >> OFFSET_SIDE)   & MASK_BYTE));
        status   = Status(uint8((o.data2 >> OFFSET_STATUS) & MASK_BYTE));
    }
}
