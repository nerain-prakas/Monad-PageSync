// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/NaiveOrderBook.sol";
import "../contracts/PageSyncOrderBook.sol";

/// @notice Deploys both order-book contracts to the configured network.
/// Usage:
///   forge script script/Deploy.s.sol \
///       --rpc-url $MONAD_RPC_URL \
///       --private-key $PRIVATE_KEY \
///       --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        NaiveOrderBook    naive    = new NaiveOrderBook();
        PageSyncOrderBook pagesync = new PageSyncOrderBook();

        vm.stopBroadcast();

        // Print addresses for reference
        console2.log("NaiveOrderBook   :", address(naive));
        console2.log("PageSyncOrderBook:", address(pagesync));

        // Write addresses to file for the backend to consume
        string memory json = string.concat(
            '{"naiveOrderBook":"', vm.toString(address(naive)),
            '","pageSyncOrderBook":"', vm.toString(address(pagesync)), '"}'
        );
        vm.writeFile("deployments/addresses.json", json);
        console2.log("Addresses written to deployments/addresses.json");
    }
}
