// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IOrderBook.sol";

/// @title NaiveOrderBook
/// @notice Baseline order book using a conventional Solidity mapping.
///
/// Storage layout (FR-05):
///   Each Order struct member occupies its own EVM storage slot:
///   - Slot +0 : orders[id].trader    (address, 20 bytes — padded to 32)
///   - Slot +1 : orders[id].price     (uint256, 32 bytes)
///   - Slot +2 : orders[id].quantity  (uint256, 32 bytes)
///   - Slot +3 : orders[id].side      (uint8   — padded to 32)
///   - Slot +4 : orders[id].status    (uint8   — padded to 32)
///
/// Because all five fields are in separate slots they may land on different
/// storage pages, making every multi-field operation touch more pages than
/// a packed alternative would.
///
/// This contract is the BASELINE against which PageSyncOrderBook is compared.
contract NaiveOrderBook is IOrderBook {
    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    struct Order {
        address trader;    // slot +0
        uint256 price;     // slot +1
        uint256 quantity;  // slot +2
        Side    side;      // slot +3 (uint8)
        Status  status;    // slot +4 (uint8)
    }

    /// @dev Conventional mapping — no special layout consideration.
    mapping(uint256 => Order) public orders;

    uint256 private _orderCount;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier orderExists(uint256 orderId) {
        require(orders[orderId].trader != address(0), "Order does not exist");
        _;
    }

    modifier onlyTrader(uint256 orderId) {
        require(msg.sender == orders[orderId].trader, "Not order owner");
        _;
    }

    modifier onlyActive(uint256 orderId) {
        require(orders[orderId].status == Status.ACTIVE, "Order not active");
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
        require(price    > 0, "Invalid price");
        require(quantity > 0, "Invalid quantity");
        require(orders[orderId].trader == address(0), "Order ID already used");

        orders[orderId] = Order({
            trader:   msg.sender,
            price:    price,
            quantity: quantity,
            side:     side,
            status:   Status.ACTIVE
        });

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
        require(newPrice    > 0, "Invalid price");
        require(newQuantity > 0, "Invalid quantity");

        orders[orderId].price    = newPrice;
        orders[orderId].quantity = newQuantity;

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
        orders[orderId].status = Status.CANCELLED;
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
        Order storage o = orders[orderId];
        o.status = Status.EXECUTED;
        emit TradeExecuted(orderId, o.price, o.quantity);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    function getOrderCount() external view override returns (uint256) {
        return _orderCount;
    }
}
