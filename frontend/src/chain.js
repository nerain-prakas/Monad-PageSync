import { useEffect, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  parseAbi,
} from 'viem';

// ========================================================
// MONAD TESTNET & CONTRACT CONFIGURATION
// ========================================================
export const MONAD_CHAIN_ID = 10143;
export const MONAD_RPC = 'https://testnet-rpc.monad.xyz';
export const MONAD = defineChain({
  id: MONAD_CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC] } },
});

export const PAGE_SYNC_ADDRESS = '0x5De52bC09A2A688f6c4615099465e9049CC83bC1';
export const ORDER_BOOK_ABI = parseAbi([
  'function placeOrder(uint256 orderId, uint256 price, uint256 quantity, uint8 side)',
  'function updateOrder(uint256 orderId, uint256 newPrice, uint256 newQuantity)',
  'function cancelOrder(uint256 orderId)',
  'function executeTrade(uint256 orderId)',
  'function getOrder(uint256 orderId) view returns (address trader, uint256 price, uint256 quantity, uint8 side, uint8 status)',
  'event OrderPlaced(uint256 indexed orderId, address indexed trader, uint256 price, uint256 quantity, uint8 side)',
]);
export const orderPlacedEvent = ORDER_BOOK_ABI.find((item) => item.type === 'event' && item.name === 'OrderPlaced');
export const publicClient = createPublicClient({ chain: MONAD, transport: http(MONAD_RPC) });

export const KURU_MARKET_ADDRESS = '0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9';
export const KURU_USDC_ADDRESS = '0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570';
export const KURU_MARGIN_ACCOUNT_ADDRESS = '0xd029C2D98ff85D8F64799017fE00a59B1159CE02';
export const KURU_NATIVE_MON_ADDRESS = '0x0000000000000000000000000000000000000000';
export const KURU_ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);
export const KURU_MARGIN_ABI = parseAbi([
  'function getBalance(address user, address asset) view returns (uint256)',
]);
export const KURU_ABI = parseAbi([
  'function bestBidAsk() view returns (uint256 bestBid, uint256 bestAsk)',
  'function getMarketParams() view returns (uint96 pricePrecision, uint96 sizePrecision, address baseAssetAddress, uint8 baseAssetDecimals, address quoteAssetAddress, uint8 quoteAssetDecimals, uint32 tickSize, uint96 minSize, uint96 maxSize, uint256 takerFeeBps, uint256 makerFeeBps)',
  'function addBuyOrder(uint32 price, uint96 size, bool postOnly)',
  'function addSellOrder(uint32 price, uint96 size, bool postOnly)',
  'function batchCancelOrders(uint40[] orderIds)',
  'event OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy)',
  'event Trade(uint40 orderId, address makerAddress, bool isBuy, uint256 price, uint96 updatedSize, address takerAddress, address txOrigin, uint96 filledSize)',
  'event OrdersCanceled(uint40[] orderId, address owner)',
]);
export const KURU_EMPTY_PRICE = (1n << 256n) - 1n;

// ========================================================
// WALLET HOOK
// ========================================================
export function useWallet() {
  const [account, setAccount] = useState();
  const [chainId, setChainId] = useState();
  const [walletClient, setWalletClient] = useState();
  const [walletError, setWalletError] = useState('');

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return undefined;
    const sync = async () => {
      const [accounts, currentChain] = await Promise.all([
        provider.request({ method: 'eth_accounts' }),
        provider.request({ method: 'eth_chainId' }),
      ]);
      setAccount(accounts[0]);
      setChainId(Number(currentChain));
      if (accounts[0]) {
        setWalletClient(createWalletClient({ account: accounts[0], chain: MONAD, transport: custom(provider) }));
      }
    };
    sync().catch(() => setWalletError('Unable to read wallet state.'));

    const onAccountsChanged = ([nextAccount]) => {
      setAccount(nextAccount);
      setWalletClient(
        nextAccount
          ? createWalletClient({ account: nextAccount, chain: MONAD, transport: custom(provider) })
          : undefined
      );
    };
    const onChainChanged = (nextChain) => setChainId(Number(nextChain));
    provider.on?.('accountsChanged', onAccountsChanged);
    provider.on?.('chainChanged', onChainChanged);

    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged);
      provider.removeListener?.('chainChanged', onChainChanged);
    };
  }, []);

  const connect = async () => {
    setWalletError('');
    if (!window.ethereum) {
      setWalletError('No injected wallet detected. Install MetaMask or Rabby.');
      return;
    }
    try {
      const [nextAccount, nextChain] = await Promise.all([
        window.ethereum.request({ method: 'eth_requestAccounts' }),
        window.ethereum.request({ method: 'eth_chainId' }),
      ]);
      const next = nextAccount[0];
      setAccount(next);
      setChainId(Number(nextChain));
      setWalletClient(createWalletClient({ account: next, chain: MONAD, transport: custom(window.ethereum) }));
    } catch (error) {
      setWalletError(error.shortMessage || error.message || 'Wallet connection was rejected.');
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x279f' }] });
      setChainId(MONAD_CHAIN_ID);
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x279f',
              chainName: MONAD.name,
              nativeCurrency: MONAD.nativeCurrency,
              rpcUrls: [MONAD_RPC],
              blockExplorerUrls: ['https://testnet.monadexplorer.com'],
            },
          ],
        });
        setChainId(MONAD_CHAIN_ID);
      } else {
        setWalletError(error.shortMessage || error.message || 'Unable to switch network.');
      }
    }
  };

  return { account, chainId, walletClient, walletError, connect, switchNetwork };
}

// ========================================================
// STATIC BENCHMARK EVIDENCE & KNOWN CONTRACTS
// ========================================================
export const CONTRACTS = {
  NaiveOrderBook: {
    address: '0x9eDDb8B7612954014Af0fFA58dc9d93dB2C75d68',
    slots: [
      { slot: 0, title: 'trader', type: 'address', bytes: 20, offset: 0, note: 'Order mapping word (12 bytes unused)' },
      { slot: 1, title: 'price', type: 'uint256', bytes: 32, offset: 0, note: 'Full 32-byte storage slot' },
      { slot: 2, title: 'quantity', type: 'uint256', bytes: 32, offset: 0, note: 'Full 32-byte storage slot' },
      { slot: 3, title: 'side + status', type: 'uint8 + uint8', bytes: 2, offset: 0, note: 'Packed fields; 30 bytes unused' },
    ],
    words: 4,
  },
  PageSyncOrderBook: {
    address: '0x5De52bC09A2A688f6c4615099465e9049CC83bC1',
    slots: [
      { slot: 0, title: 'data1 (trader + price)', type: 'packed trader + price', bytes: 32, offset: 0, note: 'Trader (160b), Price (64b), Reserved (32b)' },
      { slot: 1, title: 'data2 (quantity + flags)', type: 'packed quantity + flags', bytes: 32, offset: 0, note: 'Quantity (128b), Side (8b), Status (8b), Padding (112b)' },
    ],
    words: 2,
  },
};

export const BENCHMARK_RESULTS = [
  ['Order Placement', 99870, 81986, '-17.91%'],
  ['Second Placement', 116950, 81998, '-29.89%'],
  ['Update Order', 36030, 36394, '+1.01%'],
  ['Cancel Order', 51769, 34806, '-32.77%'],
  ['Execute Trade', 35273, 35294, '+0.06%'],
];

export const sampleStructs = {
  Order: `struct Order {
    address trader;
    uint256 price;
    uint256 quantity;
    uint8 side;
    uint8 status;
}`,
  TokenBalance: `struct AccountStake {
    address user;
    uint128 stakedAmount;
    uint64 lockTimestamp;
    bool isExempt;
    uint8 tier;
}`,
  DexPosition: `struct LiquidityPosition {
    address owner;
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidity;
    uint256 feeGrowthInside0LastX128;
    uint256 feeGrowthInside1LastX128;
}`,
};

export const shortAddress = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');
export const formatNum = (v) => Number(v).toLocaleString();
