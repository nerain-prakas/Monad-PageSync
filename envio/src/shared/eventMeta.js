/**
 * Shared extraction of event identity metadata.
 *
 * `event.transaction.hash` is only populated when the event's
 * `field_selection.transaction_fields` in config.yaml includes `hash`;
 * otherwise `event.transaction` is empty. Fail loudly rather than write
 * a row with an `undefined-<logIndex>` id or a NULL transactionHash.
 */

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

const describe = (event) =>
  `${event?.contractName}.${event?.eventName} chain=${event?.chainId} ` +
  `block=${event?.block?.number} logIndex=${event?.logIndex}`;

/** Returns the real transaction hash or throws a descriptive error. */
const requireTransactionHash = (event) => {
  const hash = event?.transaction?.hash;
  if (typeof hash !== "string" || !TX_HASH_RE.test(hash)) {
    throw new Error(
      `Missing or invalid transaction hash (${String(hash)}) for ${describe(event)}. ` +
        `Ensure field_selection.transaction_fields includes "hash" for this event in config.yaml.`
    );
  }
  return hash;
};

/** Deterministic unique id: `<txHash>-<logIndex>` (unchanged format, so existing rows stay idempotent). */
const getEventMeta = (event) => {
  const transactionHash = requireTransactionHash(event);
  if (!Number.isInteger(event.logIndex) || event.logIndex < 0) {
    throw new Error(`Missing or invalid logIndex (${String(event.logIndex)}) for ${describe(event)}.`);
  }
  return { id: `${transactionHash}-${event.logIndex}`, transactionHash };
};

module.exports = { requireTransactionHash, getEventMeta };
