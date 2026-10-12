// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

contract DeclaredPackingTest {
    struct PackingTest {
        uint128 amount;
        uint256 orderId;
        uint128 price;
        uint256 traderId;
    }

    PackingTest internal value;

    function writeAll(uint128 amount_, uint256 orderId_, uint128 price_, uint256 traderId_) external {
        value.amount = amount_;
        value.orderId = orderId_;
        value.price = price_;
        value.traderId = traderId_;
    }

    function readAmount() external view returns (uint128) {
        return value.amount;
    }

    function readAll() external view returns (uint128, uint256, uint128, uint256) {
        return (value.amount, value.orderId, value.price, value.traderId);
    }
}

contract OptimizedPackingTest {
    struct PackingTest {
        uint256 orderId;
        uint256 traderId;
        uint128 amount;
        uint128 price;
    }

    PackingTest internal value;

    function writeAll(uint128 amount_, uint256 orderId_, uint128 price_, uint256 traderId_) external {
        value.amount = amount_;
        value.orderId = orderId_;
        value.price = price_;
        value.traderId = traderId_;
    }

    function readAmount() external view returns (uint128) {
        return value.amount;
    }

    function readAll() external view returns (uint128, uint256, uint128, uint256) {
        return (value.amount, value.orderId, value.price, value.traderId);
    }
}
