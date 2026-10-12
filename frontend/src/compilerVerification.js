const SOLC_SETTINGS = {
  optimizer: { enabled: true, runs: 200 },
  evmVersion: 'shanghai',
  viaIR: false,
  outputSelection: { '*': { '*': ['storageLayout'] } },
};

export function createCompilerInput(name, originalDeclaration, optimizedDeclaration) {
  return {
    language: 'Solidity',
    sources: {
      'StructVerification.sol': {
        content: `pragma solidity 0.8.37;
contract OriginalLayout {
    ${originalDeclaration}
    ${name} internal value;
}
contract OptimizedLayout {
    ${optimizedDeclaration}
    ${name} internal value;
}`,
      },
    },
    settings: SOLC_SETTINGS,
  };
}

function normalizedType(type) {
  return type
    .replace(/\buint\b/g, 'uint256')
    .replace(/\bint\b/g, 'int256')
    .replace(/\s+payable\b/g, '')
    .replace(/\s+/g, '');
}

function readCompilerLayout(output, contractName, expectedFields, calculatedLayout) {
  const diagnostics = (output.errors ?? []).filter((diagnostic) => diagnostic.severity === 'error');
  if (diagnostics.length) {
    throw new Error(diagnostics.map((diagnostic) => diagnostic.formattedMessage).join('\n'));
  }

  const compilerContract = output.contracts?.['StructVerification.sol']?.[contractName];
  if (!compilerContract) throw new Error(`Compiler output did not include ${contractName}.`);
  const storageEntry = compilerContract.storageLayout.storage.find((entry) => entry.label === 'value');
  if (!storageEntry) throw new Error(`Compiler output did not include the ${contractName} struct storage.`);
  const structType = compilerContract.storageLayout.types[storageEntry.type];
  const members = structType.members.map((member) => ({
    name: member.label,
    type: compilerContract.storageLayout.types[member.type].label,
    slot: Number(member.slot),
    offset: member.offset,
  }));

  if (members.length !== expectedFields.length) {
    throw new Error(`${contractName} compiler output field count does not match the submitted struct.`);
  }
  const names = new Set();
  members.forEach((member, index) => {
    const expected = expectedFields[index];
    const calculated = calculatedLayout.fields[index];
    if (names.has(member.name)) throw new Error(`Compiler output contains duplicate field "${member.name}".`);
    names.add(member.name);
    if (member.name !== expected.name || normalizedType(member.type) !== normalizedType(expected.type)) {
      throw new Error(`Compiler field ${index + 1} does not match the submitted name and type.`);
    }
    if (member.slot !== calculated.slot || member.offset !== calculated.offset) {
      throw new Error(`Compiler slot/offset for "${member.name}" does not match the calculated layout.`);
    }
  });

  const storageSlots = Number((BigInt(structType.numberOfBytes) + 31n) / 32n);
  if (storageSlots !== calculatedLayout.storageSlots) {
    throw new Error(`Compiler reports ${storageSlots} slots for ${contractName}; the calculated layout reports ${calculatedLayout.storageSlots}.`);
  }
  return { storageSlots, members };
}

export function verifyCompilerOutput(output, version, analysis) {
  if (!version.startsWith('0.8.37+')) {
    throw new Error(`Expected Solidity compiler 0.8.37, received ${version}.`);
  }
  return {
    compilerVersion: version,
    original: readCompilerLayout(output, 'OriginalLayout', analysis.fields, analysis.declaredLayout),
    optimized: readCompilerLayout(output, 'OptimizedLayout', analysis.suggestedFields, analysis.suggestedLayout),
  };
}

export const compilerSettings = SOLC_SETTINGS;
