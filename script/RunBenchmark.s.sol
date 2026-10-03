// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../contracts/NaiveOrderBook.sol";
import "../contracts/PageSyncOrderBook.sol";
import "../contracts/interfaces/IOrderBook.sol";

/// @notice Runs an identical workload against both deployed contracts,
///         collects gas measurements, and writes results/benchmark.json.
///
/// Usage (after deploying):
///   export NAIVE_ADDRESS=0x...
///   export PAGESYNC_ADDRESS=0x...
///   forge script script/RunBenchmark.s.sol \
///       --rpc-url $MONAD_RPC_URL \
///       --private-key $PRIVATE_KEY \
///       --broadcast
contract RunBenchmark is Script {
    uint256 constant PLACE_COUNT  = 100;
    uint256 constant UPDATE_COUNT = 100;
    uint256 constant CANCEL_COUNT = 50;
    uint256 constant EXEC_COUNT   = 50;

    struct OpGas {
        uint256 totalGas;
        uint256 count;
        uint256 minGas;
        uint256 maxGas;
    }

    struct ContractResult {
        OpGas place;
        OpGas update;
        OpGas cancel;
        OpGas execute;
    }

    function run() external {
        address naiveAddr    = vm.envAddress("NAIVE_ADDRESS");
        address pagesyncAddr = vm.envAddress("PAGESYNC_ADDRESS");

        NaiveOrderBook    naive    = NaiveOrderBook(naiveAddr);
        PageSyncOrderBook pagesync = PageSyncOrderBook(pagesyncAddr);

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address trader = vm.addr(pk);

        ContractResult memory naiveResult;
        ContractResult memory psResult;

        vm.startBroadcast(pk);

        // --- Naive workload ---
        naiveResult.place  = _runPlace(naive,  trader);
        naiveResult.update = _runUpdate(naive, trader);
        naiveResult.cancel = _runCancel(naive, trader);
        naiveResult.execute= _runExecute(naive,trader);

        // --- PageSync workload ---
        psResult.place   = _runPlace(pagesync,  trader);
        psResult.update  = _runUpdate(pagesync, trader);
        psResult.cancel  = _runCancel(pagesync, trader);
        psResult.execute = _runExecute(pagesync,trader);

        vm.stopBroadcast();

        // Build JSON and write to file
        string memory json = _buildJson(naiveResult, psResult);
        vm.writeFile("benchmark/results/benchmark.json", json);
        console2.log("Benchmark results written to benchmark/results/benchmark.json");
        console2.log(json);
    }

    // =========================================================================
    // Workload runners
    // =========================================================================

    function _runPlace(IOrderBook book, address /*trader*/) internal returns (OpGas memory r) {
        r.minGas = type(uint256).max;
        r.count  = PLACE_COUNT;
        for (uint256 i = 1; i <= PLACE_COUNT; i++) {
            uint256 before = gasleft();
            book.placeOrder(i, 1000 + i, 10 + i, IOrderBook.Side.BUY);
            uint256 used = before - gasleft();
            r.totalGas += used;
            if (used < r.minGas) r.minGas = used;
            if (used > r.maxGas) r.maxGas = used;
        }
    }

    function _runUpdate(IOrderBook book, address /*trader*/) internal returns (OpGas memory r) {
        r.minGas = type(uint256).max;
        r.count  = UPDATE_COUNT;
        for (uint256 i = 1; i <= UPDATE_COUNT; i++) {
            uint256 before = gasleft();
            book.updateOrder(i, 1010 + i, 15 + i);
            uint256 used = before - gasleft();
            r.totalGas += used;
            if (used < r.minGas) r.minGas = used;
            if (used > r.maxGas) r.maxGas = used;
        }
    }

    function _runCancel(IOrderBook book, address /*trader*/) internal returns (OpGas memory r) {
        r.minGas = type(uint256).max;
        r.count  = CANCEL_COUNT;
        for (uint256 i = 1; i <= CANCEL_COUNT; i++) {
            uint256 before = gasleft();
            book.cancelOrder(i);
            uint256 used = before - gasleft();
            r.totalGas += used;
            if (used < r.minGas) r.minGas = used;
            if (used > r.maxGas) r.maxGas = used;
        }
    }

    function _runExecute(IOrderBook book, address /*trader*/) internal returns (OpGas memory r) {
        r.minGas = type(uint256).max;
        r.count  = EXEC_COUNT;
        uint256 startId = CANCEL_COUNT + 1;
        for (uint256 i = startId; i <= startId + EXEC_COUNT - 1; i++) {
            uint256 before = gasleft();
            book.executeTrade(i);
            uint256 used = before - gasleft();
            r.totalGas += used;
            if (used < r.minGas) r.minGas = used;
            if (used > r.maxGas) r.maxGas = used;
        }
    }

    // =========================================================================
    // JSON builder
    // =========================================================================

    function _buildJson(
        ContractResult memory n,
        ContractResult memory p
    ) internal pure returns (string memory) {
        uint256 nTotal = n.place.totalGas + n.update.totalGas + n.cancel.totalGas + n.execute.totalGas;
        uint256 pTotal = p.place.totalGas + p.update.totalGas + p.cancel.totalGas + p.execute.totalGas;

        return string.concat(
            '{',
              '"naive":', _contractJson(n, nTotal), ',',
              '"pagesync":', _contractJson(p, pTotal), ',',
              '"comparison":{',
                '"totalGasDiff":', vm.toString(nTotal > pTotal ? nTotal - pTotal : 0), ',',
                '"naiveTotal":', vm.toString(nTotal), ',',
                '"pagesyncTotal":', vm.toString(pTotal),
              '}',
            '}'
        );
    }

    function _opJson(OpGas memory o) internal pure returns (string memory) {
        uint256 avg = o.count > 0 ? o.totalGas / o.count : 0;
        return string.concat(
            '{',
              '"total":', vm.toString(o.totalGas), ',',
              '"count":', vm.toString(o.count),    ',',
              '"avg":'  , vm.toString(avg),         ',',
              '"min":'  , vm.toString(o.minGas == type(uint256).max ? 0 : o.minGas), ',',
              '"max":'  , vm.toString(o.maxGas),
            '}'
        );
    }

    function _contractJson(ContractResult memory r, uint256 total) internal pure returns (string memory) {
        return string.concat(
            '{',
              '"place":'  , _opJson(r.place),   ',',
              '"update":', _opJson(r.update),  ',',
              '"cancel":', _opJson(r.cancel),  ',',
              '"execute":', _opJson(r.execute), ',',
              '"total":', vm.toString(total),
            '}'
        );
    }
}
