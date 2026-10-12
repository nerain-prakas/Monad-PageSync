import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import solc from 'solc';
import {
  analyzeStruct,
  formatStructDeclaration,
  generateOptimizedStruct,
} from './storageLayout.js';
import {
  compilerSettings,
  createCompilerInput,
  verifyCompilerOutput,
} from './compilerVerification.js';
import { runPackingTestGasBenchmark } from '../benchmarks/run-packing-test-gas.js';

test('estimates declared packing and a size-first field order', () => {
  const result = analyzeStruct(`struct Example {
    uint8 smallA;
    uint256 large;
    uint8 smallB;
  }`);

  assert.equal(result.name, 'Example');
  assert.equal(result.declaredLayout.storageSlots, 3);
  assert.equal(result.suggestedLayout.storageSlots, 2);
  assert.equal(result.estimatedSlotsSaved, 1);
  assert.equal(result.suggestedFields[0].name, 'large');
});

test('packs address with a 96-bit integer and ignores comments', () => {
  const result = analyzeStruct(`// Example model
    struct Packed {
      address payable account;
      /* exactly 12 bytes */
      uint96 amount;
      bool active;
    }`);

  assert.equal(result.fields[0].bytes, 20);
  assert.equal(result.fields[1].bytes, 12);
  assert.equal(result.declaredLayout.slots[0].used, 32);
  assert.equal(result.declaredLayout.storageSlots, 2);
});

test('groups same-width fields to reduce PackingTest from four slots to three', () => {
  const source = `struct PackingTest {
    uint128 amount;
    uint256 orderId;
    uint128 price;
    uint256 traderId;
  }`;
  const result = analyzeStruct(source);
  const declared = result.declaredLayout;
  const suggested = result.suggestedLayout;
  const originalFields = result.fields.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name));
  const reorderedFields = result.suggestedFields.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name));

  assert.equal(declared.storageSlots, 4);
  assert.equal(suggested.storageSlots, 3);
  assert.equal(result.estimatedSlotsSaved, 1);
  assert.deepEqual(result.suggestedFields.map((field) => field.name), [
    'orderId',
    'traderId',
    'amount',
    'price',
  ]);
  assert.deepEqual(reorderedFields, originalFields);
  assert.deepEqual(declared.slots.map((slot) => slot.fields.map((field) => field.name)), [
    ['amount'],
    ['orderId'],
    ['price'],
    ['traderId'],
  ]);
  assert.deepEqual(suggested.slots.map((slot) => slot.fields.map((field) => field.name)), [
    ['orderId'],
    ['traderId'],
    ['amount', 'price'],
  ]);

  for (const layout of [declared, suggested]) {
    const rendered = layout.slots.flatMap((slot) => slot.fields);
    assert.deepEqual(
      rendered.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name)),
      originalFields
    );
    assert.equal(new Set(rendered.map((field) => field.name)).size, result.fields.length);
    assert.ok(layout.slots.every((slot) =>
      slot.used <= 32 && slot.used === slot.fields.reduce((sum, field) => sum + field.bytes, 0)
    ));
    assert.equal(layout.bytesUsed, rendered.reduce((sum, field) => sum + field.bytes, 0));
    assert.equal(layout.bytesUsed, layout.slots.reduce((sum, slot) => sum + slot.used, 0));
    assert.equal(layout.capacity, layout.storageSlots * 32);
  }
});

test('generates optimized Solidity while preserving the struct name and field declarations', () => {
  const result = analyzeStruct(`struct PackingTest {
    uint128 amount;
    uint256 orderId;
    uint128 price;
    uint256 traderId;
  }`);

  assert.equal(formatStructDeclaration(result.name, result.fields), `struct PackingTest {
    uint128 amount;
    uint256 orderId;
    uint128 price;
    uint256 traderId;
}`);
  assert.equal(generateOptimizedStruct(result), `struct PackingTest {
    uint256 orderId;
    uint256 traderId;
    uint128 amount;
    uint128 price;
}`);
  assert.deepEqual(
    result.fields.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name)),
    result.suggestedFields.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name))
  );
});

test('matches declared and optimized PackingTest layouts against solc standard JSON output', () => {
  const result = analyzeStruct(`struct PackingTest {
    uint128 amount;
    uint256 orderId;
    uint128 price;
    uint256 traderId;
  }`);
  const source = `pragma solidity >=0.8.0;
    contract DeclaredLayout {
      struct PackingTest {
        uint128 amount;
        uint256 orderId;
        uint128 price;
        uint256 traderId;
      }
      PackingTest internal value;
    }
    contract SuggestedLayout {
      struct PackingTest {
        uint256 orderId;
        uint256 traderId;
        uint128 amount;
        uint128 price;
      }
      PackingTest internal value;
    }`;
  const input = {
    language: 'Solidity',
    sources: { 'PackingTest.sol': { content: source } },
    settings: {
      outputSelection: { '*': { '*': ['storageLayout'] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((diagnostic) => diagnostic.severity === 'error');
  assert.deepEqual(errors, [], errors.map((diagnostic) => diagnostic.formattedMessage).join('\n'));

  const compilerMembers = (contractName) => {
    const layout = output.contracts['PackingTest.sol'][contractName].storageLayout;
    const structEntry = Object.values(layout.types).find((type) => type.label.endsWith('.PackingTest'));
    assert.ok(structEntry, `solc output should include ${contractName}.PackingTest`);
    return structEntry.members.map((member) => ({
      name: member.label,
      type: layout.types[member.type].label,
      slot: Number(member.slot),
      offset: member.offset,
    }));
  };
  const normalizeCalculated = (layout) => layout.fields.map((field) => ({
    name: field.name,
    type: field.type,
    slot: field.slot,
    offset: field.offset,
  }));
  const originalCompilerLayout = compilerMembers('DeclaredLayout');
  const suggestedCompilerLayout = compilerMembers('SuggestedLayout');

  assert.deepEqual(normalizeCalculated(result.declaredLayout), originalCompilerLayout);
  assert.deepEqual(normalizeCalculated(result.suggestedLayout), suggestedCompilerLayout);
  assert.equal(Math.max(...originalCompilerLayout.map((field) => field.slot)) + 1, 4);
  assert.equal(Math.max(...suggestedCompilerLayout.map((field) => field.slot)) + 1, 3);
  assert.deepEqual(
    suggestedCompilerLayout.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name)),
    originalCompilerLayout.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name))
  );
});

test('verifies the generated user declarations against compiler slots and byte offsets', () => {
  const originalDeclaration = `struct PackingTest {
    uint128 amount;
    uint256 orderId;
    uint128 price;
    uint256 traderId;
  }`;
  const analysis = analyzeStruct(originalDeclaration);
  const input = createCompilerInput(
    analysis.name,
    originalDeclaration,
    generateOptimizedStruct(analysis)
  );
  assert.deepEqual(input.settings, compilerSettings);
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const verified = verifyCompilerOutput(output, solc.version(), analysis);

  assert.equal(verified.original.storageSlots, 4);
  assert.equal(verified.optimized.storageSlots, 3);
  assert.deepEqual(verified.original.members.map(({ name, slot, offset }) => [name, slot, offset]), [
    ['amount', 0, 0],
    ['orderId', 1, 0],
    ['price', 2, 0],
    ['traderId', 3, 0],
  ]);
  assert.deepEqual(verified.optimized.members.map(({ name, slot, offset }) => [name, slot, offset]), [
    ['orderId', 0, 0],
    ['traderId', 1, 0],
    ['amount', 2, 0],
    ['price', 2, 16],
  ]);
});

test('compiler-verifies unchanged layouts without claiming a slot reduction', () => {
  const originalDeclaration = `struct NoReduction {
    uint128 first;
    uint128 second;
  }`;
  const analysis = analyzeStruct(originalDeclaration);
  const optimizedDeclaration = generateOptimizedStruct(analysis);
  const output = JSON.parse(solc.compile(JSON.stringify(createCompilerInput(
    analysis.name,
    originalDeclaration,
    optimizedDeclaration
  ))));
  const verified = verifyCompilerOutput(output, solc.version(), analysis);

  assert.equal(analysis.optimizationApplied, false);
  assert.equal(analysis.estimatedSlotsSaved, 0);
  assert.deepEqual(
    analysis.suggestedFields.map(({ name, type }) => ({ name, type })),
    analysis.fields.map(({ name, type }) => ({ name, type }))
  );
  assert.equal(verified.original.storageSlots, 1);
  assert.equal(verified.optimized.storageSlots, 1);
});

test('compiler-verifies supported arrays and mapping boundaries against calculated positions', () => {
  const originalDeclaration = `struct Arrays {
    uint128 beforeArray;
    uint8[4] values;
    mapping(address => uint256) balances;
    string label;
    uint8 afterFields;
  }`;
  const analysis = analyzeStruct(originalDeclaration);
  const output = JSON.parse(solc.compile(JSON.stringify(createCompilerInput(
    analysis.name,
    originalDeclaration,
    generateOptimizedStruct(analysis)
  ))));
  const verified = verifyCompilerOutput(output, solc.version(), analysis);

  assert.equal(verified.original.storageSlots, 5);
  assert.equal(verified.optimized.storageSlots, 5);
  assert.deepEqual(analysis.suggestedFields.map((field) => field.name), analysis.fields.map((field) => field.name));
});

test('compiler diagnostics cannot be reported as verified', () => {
  const analysis = analyzeStruct('struct Simple { uint256 value; }');

  assert.throws(() => verifyCompilerOutput({
    errors: [{ severity: 'error', formattedMessage: 'ParserError: invalid Solidity source' }],
  }, solc.version(), analysis), /ParserError: invalid Solidity source/);
});

test('measures equivalent PackingTest contracts on repeated Shanghai EVM transactions', async () => {
  const source = await readFile(new URL('../benchmarks/PackingTestGas.sol', import.meta.url), 'utf8');
  const declaredContract = source.match(/contract DeclaredPackingTest\s*\{([\s\S]*?)\n\}/)?.[1];
  const optimizedContract = source.match(/contract OptimizedPackingTest\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(declaredContract && optimizedContract, 'both benchmark contracts must be present');
  const sharedImplementation = (body) => body.slice(body.indexOf('    PackingTest internal value;'));
  assert.equal(sharedImplementation(declaredContract), sharedImplementation(optimizedContract));

  const result = await runPackingTestGasBenchmark({ iterations: 3 });
  assert.equal(result.compiler.version, solc.version());
  assert.equal(result.compiler.evmVersion, 'shanghai');
  assert.equal(result.compiler.optimizer.enabled, true);
  assert.equal(result.execution.iterations, 3);
  assert.equal(result.layouts.declared.storageSlots, 4);
  assert.equal(result.layouts.optimized.storageSlots, 3);
  assert.deepEqual(
    result.layouts.declared.members.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name)),
    result.layouts.optimized.members.map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name))
  );

  for (const operation of ['deployment', 'writeAll', 'readAmount', 'readAll']) {
    const declared = result.results.declared[operation];
    const optimized = result.results.optimized[operation];
    assert.equal(declared.samples.length, 3);
    assert.equal(optimized.samples.length, 3);
    assert.ok(declared.samples.every((gas) => Number.isInteger(gas) && gas > 0));
    assert.ok(optimized.samples.every((gas) => Number.isInteger(gas) && gas > 0));
    assert.equal(
      result.results.comparison[operation].gasDifference,
      declared.median - optimized.median
    );
    assert.equal(
      result.results.comparison[operation].percentGasReduced,
      Number((((declared.median - optimized.median) / declared.median) * 100).toFixed(4))
    );
  }
});

test('keeps declared order when reordering does not reduce the slot count', () => {
  const result = analyzeStruct(`struct NoReduction {
    uint128 first;
    uint128 second;
  }`);

  assert.equal(result.declaredLayout.storageSlots, 1);
  assert.equal(result.suggestedLayout.storageSlots, 1);
  assert.equal(result.optimizationApplied, false);
  assert.equal(result.estimatedSlotsSaved, 0);
  assert.deepEqual(
    result.suggestedFields.map((field) => field.name),
    result.fields.map((field) => field.name)
  );
  assert.equal(generateOptimizedStruct(result), formatStructDeclaration(result.name, result.fields));
});

test('TestOrder declared slots have the exact expected field groups', () => {
  const result = analyzeStruct(`struct TestOrder {
    address trader;
    uint256 orderId;
    uint8 side;
    bool isActive;
    uint128 quantity;
    uint64 timestamp;
    uint32 fee;
    uint16 leverage;
    uint8 status;
  }`);
  const layout = result.declaredLayout;

  assert.equal(layout.storageSlots, 4);
  assert.deepEqual(layout.slots.map((slot) => slot.used), [20, 32, 32, 1]);
  assert.deepEqual(layout.slots.map((slot) => slot.fields.map((field) => field.name)), [
    ['trader'],
    ['orderId'],
    ['side', 'isActive', 'quantity', 'timestamp', 'fee', 'leverage'],
    ['status'],
  ]);
  assert.deepEqual(layout.fields.map((field) => [field.name, field.slot]), [
    ['trader', 0],
    ['orderId', 1],
    ['side', 2],
    ['isActive', 2],
    ['quantity', 2],
    ['timestamp', 2],
    ['fee', 2],
    ['leverage', 2],
    ['status', 3],
  ]);
  assert.equal(layout.bytesUsed, 85);
  assert.equal(layout.capacity, 128);
  assert.equal(layout.capacity - layout.bytesUsed, 43);

  const renderedFields = layout.slots.flatMap((slot) => slot.fields);
  assert.equal(renderedFields.length, result.fields.length);
  assert.deepEqual(
    renderedFields.map((field) => field.name),
    result.fields.map((field) => field.name)
  );
  assert.ok(layout.slots.every((slot) => slot.used <= 32));
  assert.equal(layout.bytesUsed, renderedFields.reduce((sum, field) => sum + field.bytes, 0));

  const suggestedFields = result.suggestedLayout.slots.flatMap((slot) => slot.fields);
  assert.deepEqual(
    suggestedFields.map((field) => field.name).sort(),
    result.fields.map((field) => field.name).sort()
  );
  assert.equal(new Set(suggestedFields.map((field) => field.name)).size, result.fields.length);
  assert.ok(result.suggestedLayout.slots.every((slot) => slot.used <= 32));
  assert.equal(
    result.suggestedLayout.bytesUsed,
    suggestedFields.reduce((sum, field) => sum + field.bytes, 0)
  );
});

test('packs exactly 32 bytes and spills the next field to a new slot', () => {
  const result = analyzeStruct(`struct Boundary {
    uint128 first;
    uint64 second;
    uint32 third;
    uint16 fourth;
    uint8 fillsSlotA;
    uint8 fillsSlotB;
    uint8 spills;
  }`);

  assert.deepEqual(result.declaredLayout.slots.map((slot) => slot.used), [32, 1]);
  assert.equal(result.declaredLayout.storageSlots, 2);
  assert.equal(result.declaredLayout.bytesUsed, 33);
  assert.equal(result.declaredLayout.capacity, 64);
  assert.equal(result.declaredLayout.capacity - result.declaredLayout.bytesUsed, 31);
});

test('visualizes every fixed-array element once and keeps metrics aligned', () => {
  const result = analyzeStruct(`struct ArrayBoundary {
    uint8 before;
    uint16[17] values;
    uint8 after;
  }`);
  const layout = result.declaredLayout;
  const arrayElements = layout.slots.flatMap((slot) => slot.fields)
    .filter((field) => field.name === 'values');

  assert.equal(arrayElements.length, 17);
  assert.deepEqual(arrayElements.map((field) => field.elementIndex), Array.from({ length: 17 }, (_, i) => i));
  assert.ok(layout.slots.every((slot) => slot.used <= 32));
  assert.equal(layout.bytesUsed, layout.slots.reduce((sum, slot) => sum + slot.used, 0));
  assert.equal(layout.bytesUsed, layout.slots.flatMap((slot) => slot.fields)
    .reduce((sum, field) => sum + field.bytes, 0));
});

test('lays fixed arrays in isolated slots and dynamic fields in head slots', () => {
  const result = analyzeStruct(`struct Arrays {
    uint128 beforeArray;
    uint8[4] values;
    mapping(address => uint256) balances;
    string label;
    uint8 afterFields;
  }`);

  assert.equal(result.fields[1].bytes, 4);
  assert.equal(result.fields[1].kind, 'fixed-array');
  assert.equal(result.declaredLayout.fields[1].slot, 1);
  assert.equal(result.declaredLayout.fields[2].slot, 2);
  assert.equal(result.declaredLayout.fields[3].slot, 3);
  assert.equal(result.declaredLayout.fields[4].slot, 4);
  assert.equal(result.declaredLayout.storageSlots, 5);
});

test('does not reorder scalar fields across mapping, array, or dynamic-field boundaries', () => {
  const result = analyzeStruct(`struct Boundaries {
    uint8 beforeMapping;
    uint256 laterInRun;
    mapping(address => uint256) balances;
    uint8 beforeArray;
    uint256 laterBeforeArray;
    uint8[2] values;
    uint8 beforeString;
    uint256 laterBeforeString;
    string label;
  }`);

  assert.deepEqual(result.suggestedFields.map((field) => field.name), [
    'beforeMapping',
    'laterInRun',
    'balances',
    'beforeArray',
    'laterBeforeArray',
    'values',
    'beforeString',
    'laterBeforeString',
    'label',
  ]);
});

test('rejects malformed and unsupported declarations with a useful error', () => {
  assert.throws(() => analyzeStruct(''), /Enter a Solidity struct/);
  assert.throws(() => analyzeStruct('struct Empty {}'), /has no fields/);
  assert.throws(() => analyzeStruct('struct Broken { uint256 value }'), /semicolon/);
  assert.throws(() => analyzeStruct('struct Bad { uint7 value; }'), /Unsupported field type/);
  assert.throws(() => analyzeStruct('struct Bad { Custom value; }'), /Unsupported field type/);
  assert.throws(() => analyzeStruct('struct Bad { mapping(foo => uint256) value; }'), /mapping key type/);
  assert.throws(() => analyzeStruct('struct Bad { uint8 value; uint8 value; }'), /Duplicate field name/);
  assert.throws(() => analyzeStruct('contract Wrapper { struct Bad { uint8 value; } }'), /Paste exactly one struct/);
});
