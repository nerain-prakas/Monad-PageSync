function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function scalarWidth(type) {
  const normalized = type.replace(/\s+payable$/, '');
  if (normalized === 'address') return 20;
  if (normalized === 'bool') return 1;
  const match = normalized.match(/^(u?int|bytes)([0-9]*)$/);
  if (!match) return null;

  const bitsOrBytes = match[2] ? Number(match[2]) : match[1] === 'bytes' ? 1 : 256;
  if (match[1] === 'bytes') return bitsOrBytes >= 1 && bitsOrBytes <= 32 ? bitsOrBytes : null;
  return bitsOrBytes >= 8 && bitsOrBytes <= 256 && bitsOrBytes % 8 === 0
    ? bitsOrBytes / 8
    : null;
}

function parseFieldType(type, name) {
  const arrayMatch = type.match(/^(.*?)\[\s*(\d*)\s*\]$/);
  if (arrayMatch) {
    const elementWidth = scalarWidth(arrayMatch[1].trim());
    if (!elementWidth) {
      throw new Error(`Unsupported array element type in "${name}". Use a supported elementary type.`);
    }
    const length = arrayMatch[2] === '' ? null : Number(arrayMatch[2]);
    if (length === 0 || (length !== null && (!Number.isSafeInteger(length) || length > 256))) {
      throw new Error(`Array "${name}" must have a fixed length from 1 to 256, or be dynamic.`);
    }
    return {
      type,
      name,
      kind: length === null ? 'dynamic' : 'fixed-array',
      elementWidth,
      length,
      bytes: length === null ? 32 : length * elementWidth,
    };
  }

  if (type === 'string' || type === 'bytes') {
    return { type, name, kind: 'dynamic', bytes: 32 };
  }

  if (isMappingType(type)) {
    validateMappingType(type, name);
    return { type, name, kind: 'mapping', bytes: 32 };
  }

  const bytes = scalarWidth(type);
  if (bytes !== null) return { type, name, kind: 'scalar', bytes };

  throw new Error(`Unsupported field type "${type}" for "${name}".`);
}

function isMappingType(type) {
  return /^mapping\s*\(/.test(type) && type.endsWith(')');
}

function validateMappingType(type, fieldName) {
  const start = type.indexOf('(');
  const body = type.slice(start + 1, -1);
  let depth = 0;
  let arrowIndex = -1;

  for (let index = 0; index < body.length - 1; index += 1) {
    if (body[index] === '(') depth += 1;
    if (body[index] === ')') depth -= 1;
    if (depth === 0 && body.slice(index, index + 2) === '=>') {
      arrowIndex = index;
      break;
    }
  }

  if (arrowIndex < 0) throw new Error(`Invalid mapping type for "${fieldName}".`);
  const keyType = body.slice(0, arrowIndex).trim();
  const valueType = body.slice(arrowIndex + 2).trim();
  if (!keyType || !valueType || !(scalarWidth(keyType) || keyType === 'string' || keyType === 'bytes')) {
    throw new Error(`Invalid mapping key type for "${fieldName}".`);
  }
  if (isMappingType(valueType)) {
    validateMappingType(valueType, fieldName);
    return;
  }

  parseFieldType(valueType, fieldName);
}

function parseStruct(source) {
  if (typeof source !== 'string' || !source.trim()) {
    throw new Error('Enter a Solidity struct declaration to analyze.');
  }

  const cleanSource = stripComments(source);
  const declaration = cleanSource.match(/\bstruct\s+([A-Za-z_$][\w$]*)\s*\{/);
  if (!declaration) {
    throw new Error('No Solidity struct found. Paste a declaration such as struct Example { uint128 amount; }.');
  }

  const openBrace = cleanSource.indexOf('{', declaration.index);
  let depth = 1;
  let closeBrace = openBrace + 1;
  for (; closeBrace < cleanSource.length && depth > 0; closeBrace += 1) {
    if (cleanSource[closeBrace] === '{') depth += 1;
    if (cleanSource[closeBrace] === '}') depth -= 1;
  }
  if (depth !== 0) throw new Error(`Struct "${declaration[1]}" is missing its closing brace.`);
  if (cleanSource.slice(0, declaration.index).trim() || cleanSource.slice(closeBrace).trim()) {
    throw new Error('Paste exactly one struct declaration. Contracts, imports, inheritance, and surrounding Solidity code are not supported.');
  }

  const body = cleanSource.slice(openBrace + 1, closeBrace - 1);
  const declarations = body.split(';');
  if (declarations.at(-1).trim()) {
    throw new Error('Every struct field declaration must end with a semicolon.');
  }

  const fields = [];
  const names = new Set();
  for (const rawDeclaration of declarations.slice(0, -1)) {
    const fieldDeclaration = rawDeclaration.trim();
    if (!fieldDeclaration) continue;
    const match = fieldDeclaration.match(/^(.+?)\s+([A-Za-z_$][\w$]*)$/);
    if (!match) throw new Error(`Invalid field declaration: "${fieldDeclaration}".`);

    const type = match[1].trim().replace(/\s+/g, ' ');
    const name = match[2];
    if (names.has(name)) throw new Error(`Duplicate field name "${name}".`);
    names.add(name);
    fields.push(parseFieldType(type, name));
  }

  if (!fields.length) throw new Error(`Struct "${declaration[1]}" has no fields.`);
  return { name: declaration[1], fields };
}

function layoutFields(fields) {
  const slots = [];
  const positions = new Map();
  let slot = 0;
  let used = 0;

  const openSlot = () => {
    if (!slots[slot]) slots[slot] = { index: slot, used: 0, fields: [] };
    return slots[slot];
  };
  const nextSlot = () => {
    slot += 1;
    used = 0;
  };

  for (const originalField of fields) {
    const field = { ...originalField };
    if (field.kind === 'scalar') {
      if (used > 0 && used + field.bytes > 32) nextSlot();
      field.slot = slot;
      field.offset = used;
      positions.set(field.name, { slot, offset: used });
      openSlot().fields.push({ name: field.name, type: field.type, bytes: field.bytes });
      used += field.bytes;
      openSlot().used = used;
      continue;
    }

    if (used > 0) nextSlot();
    field.slot = slot;
    field.offset = 0;
    positions.set(field.name, { slot, offset: 0 });

    if (field.kind === 'fixed-array') {
      for (let index = 0; index < field.length; index += 1) {
        if (used > 0 && used + field.elementWidth > 32) nextSlot();
        openSlot().fields.push({
          name: field.name,
          type: field.type,
          bytes: field.elementWidth,
          elementIndex: index,
        });
        used += field.elementWidth;
        openSlot().used = used;
      }
      field.storageSlots = slot - field.slot + 1;
    } else {
      openSlot().fields.push({ name: field.name, type: field.type, bytes: 32 });
      openSlot().used = 32;
      field.storageSlots = 1;
    }

    nextSlot();
  }

  const occupiedBytes = slots.reduce((sum, item) => sum + item.used, 0);
  const renderedFieldBytes = slots.flatMap((item) => item.fields)
    .reduce((sum, field) => sum + field.bytes, 0);
  if (slots.some((item) => item.used > 32 || item.used !== item.fields.reduce((sum, field) => sum + field.bytes, 0))) {
    throw new Error('Internal layout error: a storage slot exceeds 32 bytes or its rendered fields do not match its byte count.');
  }
  if (occupiedBytes !== renderedFieldBytes) {
    throw new Error('Internal layout error: rendered field bytes do not match the occupied storage bytes.');
  }

  return {
    fields: fields.map((field) => ({ ...field, ...positions.get(field.name) })),
    slots,
    storageSlots: slots.length,
    bytesUsed: occupiedBytes,
    capacity: slots.length * 32,
  };
}

function suggestFieldOrder(fields) {
  const suggested = [];
  let packableRun = [];
  const flush = () => {
    packableRun.sort((a, b) => b.bytes - a.bytes);
    suggested.push(...packableRun);
    packableRun = [];
  };

  for (const field of fields) {
    if (field.kind === 'scalar') {
      packableRun.push(field);
    } else {
      flush();
      suggested.push(field);
    }
  }
  flush();
  return suggested;
}

export function analyzeStruct(source) {
  const { name, fields } = parseStruct(source);
  const declaredLayout = layoutFields(fields);
  const candidateFields = suggestFieldOrder(fields);
  const candidateLayout = layoutFields(candidateFields);
  const optimizationApplied = candidateLayout.storageSlots < declaredLayout.storageSlots;
  const suggestedFields = optimizationApplied ? candidateFields : fields;
  const suggestedLayout = optimizationApplied ? candidateLayout : declaredLayout;
  return {
    name,
    fields,
    declaredLayout,
    suggestedFields,
    suggestedLayout,
    optimizationApplied,
    estimatedSlotsSaved: optimizationApplied
      ? declaredLayout.storageSlots - suggestedLayout.storageSlots
      : 0,
  };
}

export function formatStructDeclaration(name, fields) {
  return `struct ${name} {\n${fields.map(({ type, name: fieldName }) => `    ${type} ${fieldName};`).join('\n')}\n}`;
}

export function generateOptimizedStruct(analysis) {
  return formatStructDeclaration(analysis.name, analysis.suggestedFields);
}
