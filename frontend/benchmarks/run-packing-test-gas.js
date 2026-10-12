import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Common, Hardfork, Mainnet } from '@ethereumjs/common';
import { createLegacyTx } from '@ethereumjs/tx';
import { bytesToHex, createAccount, createAddressFromPrivateKey, hexToBytes } from '@ethereumjs/util';
import { createVM, runTx } from '@ethereumjs/vm';
import { decodeFunctionResult, encodeFunctionData } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import solc from 'solc';

const benchmarkDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(benchmarkDirectory, 'PackingTestGas.sol');
const resultPath = path.join(benchmarkDirectory, 'packing-test-gas-results.json');
const sourceName = 'PackingTestGas.sol';
const senderKey = hexToBytes(generatePrivateKey());
const transactionGasLimit = 15_000_000n;
const transactionGasPrice = 1_000_000_000n;
const values = [123456789n, 42n, 987654321n, 84n];
const contracts = ['DeclaredPackingTest', 'OptimizedPackingTest'];

function compile(source) {
  const input = {
    language: 'Solidity',
    sources: { [sourceName]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'shanghai',
      viaIR: false,
      metadata: { bytecodeHash: 'none' },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'storageLayout'],
        },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((diagnostic) => diagnostic.severity === 'error');
  assert.deepEqual(errors, [], errors.map((diagnostic) => diagnostic.formattedMessage).join('\n'));
  return { input, output: output.contracts[sourceName] };
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    samples,
    minimum: sorted[0],
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    maximum: sorted.at(-1),
  };
}

function percentDifference(declared, optimized) {
  return Number((((declared - optimized) / declared) * 100).toFixed(4));
}

async function execute(vm, common, sender, nonce, to, data) {
  const tx = createLegacyTx({
    nonce: BigInt(nonce),
    gasLimit: transactionGasLimit,
    gasPrice: transactionGasPrice,
    to,
    data: hexToBytes(data),
    value: 0n,
  }, { common }).sign(senderKey);
  const result = await runTx(vm, { tx });
  assert.equal(result.receipt.status, 1, 'benchmark transaction must succeed');
  return result;
}

async function deployAndMeasure(vm, common, sender, bytecode) {
  const deployment = await execute(vm, common, sender, 0, undefined, `0x${bytecode}`);
  assert.ok(deployment.createdAddress, 'deployment must return a contract address');
  return {
    address: bytesToHex(deployment.createdAddress.bytes),
    gasUsed: Number(deployment.totalGasSpent),
  };
}

async function measureContract(contract, iterations) {
  const samples = { deployment: [], writeAll: [], readAmount: [], readAll: [] };
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const common = new Common({ chain: Mainnet, hardfork: Hardfork.Shanghai });
    const vm = await createVM({ common });
    const sender = createAddressFromPrivateKey(senderKey);
    await vm.stateManager.putAccount(sender, createAccount({ nonce: 0n, balance: 10n ** 22n }));

    const deployed = await deployAndMeasure(vm, common, sender, contract.evm.bytecode.object);
    samples.deployment.push(deployed.gasUsed);

    const writeData = encodeFunctionData({
      abi: contract.abi,
      functionName: 'writeAll',
      args: values,
    });
    const write = await execute(vm, common, sender, 1, deployed.address, writeData);
    samples.writeAll.push(Number(write.totalGasSpent));

    const readAmountData = encodeFunctionData({ abi: contract.abi, functionName: 'readAmount' });
    const readAmount = await execute(vm, common, sender, 2, deployed.address, readAmountData);
    samples.readAmount.push(Number(readAmount.totalGasSpent));
    assert.equal(
      decodeFunctionResult({
        abi: contract.abi,
        functionName: 'readAmount',
        data: bytesToHex(readAmount.execResult.returnValue),
      }),
      values[0],
      'single-field read must return the value written'
    );

    const readAllData = encodeFunctionData({ abi: contract.abi, functionName: 'readAll' });
    const readAll = await execute(vm, common, sender, 3, deployed.address, readAllData);
    samples.readAll.push(Number(readAll.totalGasSpent));
    assert.deepEqual(
      decodeFunctionResult({
        abi: contract.abi,
        functionName: 'readAll',
        data: bytesToHex(readAll.execResult.returnValue),
      }),
      values,
      'full-struct read must return every value in the original API order'
    );
  }
  return Object.fromEntries(Object.entries(samples).map(([operation, valuesForOperation]) => [
    operation,
    summarize(valuesForOperation),
  ]));
}

function describeStorageLayout(contract) {
  const value = contract.storageLayout.storage.find((entry) => entry.label === 'value');
  assert.ok(value, 'compiler storage layout must include the PackingTest value');
  const struct = contract.storageLayout.types[value.type];
  const members = struct.members.map((member) => ({
    name: member.label,
    type: contract.storageLayout.types[member.type].label,
    slot: Number(member.slot),
    offsetBytes: member.offset,
  }));
  return {
    storageSlots: Math.max(...members.map((member) => member.slot)) + 1,
    members,
  };
}

export async function runPackingTestGasBenchmark({ iterations = 5 } = {}) {
  assert.ok(Number.isInteger(iterations) && iterations >= 3, 'Use at least three independent measurement runs.');
  assert.match(solc.version(), /^0\.8\.37\+/, 'Benchmark results require the pinned solc 0.8.37 release.');

  const source = await readFile(sourcePath, 'utf8');
  const { input, output } = compile(source);
  const compiled = Object.fromEntries(contracts.map((name) => {
    const contract = output[name];
    assert.ok(contract?.evm.bytecode.object, `solc must compile ${name}`);
    return [name, contract];
  }));

  const measured = {};
  for (const name of contracts) {
    measured[name] = await measureContract(compiled[name], iterations);
  }

  const declared = measured.DeclaredPackingTest;
  const optimized = measured.OptimizedPackingTest;
  const operations = ['deployment', 'writeAll', 'readAmount', 'readAll'];
  const comparison = Object.fromEntries(operations.map((operation) => [
    operation,
    {
      declaredMedianGas: declared[operation].median,
      optimizedMedianGas: optimized[operation].median,
      gasDifference: declared[operation].median - optimized[operation].median,
      percentGasReduced: percentDifference(declared[operation].median, optimized[operation].median),
    },
  ]));
  const inputSettings = input.settings;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    compiler: {
      version: solc.version(),
      optimizer: inputSettings.optimizer,
      evmVersion: inputSettings.evmVersion,
      viaIR: inputSettings.viaIR,
      metadata: inputSettings.metadata,
    },
    execution: {
      engine: '@ethereumjs/vm',
      engineVersion: JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'))
        .packages['node_modules/@ethereumjs/vm'].version,
      hardfork: Hardfork.Shanghai,
      iterations,
      measurement: 'Signed local EVM transactions; receipt-equivalent total gas spent, including intrinsic and calldata gas.',
      transactionGasLimit: Number(transactionGasLimit),
      transactionGasPriceWei: Number(transactionGasPrice),
      writeValues: values.map(String),
      readOperations: ['readAmount()', 'readAll()'],
    },
    layouts: {
      declared: describeStorageLayout(compiled.DeclaredPackingTest),
      optimized: describeStorageLayout(compiled.OptimizedPackingTest),
    },
    results: {
      declared: declared,
      optimized: optimized,
      comparison,
    },
    limitations: [
      'Measurements use EthereumJS VM at Shanghai rules; they are reproducible local EVM measurements, not Monad Testnet receipts.',
      'Gas depends on compiler settings, EVM hardfork, transaction data, and initial storage state; results apply only to these harness operations and values.',
      'Deployment measurement includes creation transaction intrinsic/calldata gas and contract initcode execution.',
      'Read operations are sent as signed transactions so gas appears in receipts; their return values are also decoded and checked.',
      'No gas-saving claim is made for operations where the measured median does not decrease.',
    ],
  };
}

export async function runAndSavePackingTestGasBenchmark(options) {
  const result = await runPackingTestGasBenchmark(options);
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const iterations = process.argv[2] === undefined ? 5 : Number(process.argv[2]);
  const result = await runAndSavePackingTestGasBenchmark({ iterations });
  console.log(JSON.stringify(result, null, 2));
}
