import soljsonUrl from 'solc/soljson.js?url';
import { createCompilerInput, verifyCompilerOutput } from './compilerVerification.js';

const COMPILER_TIMEOUT_MS = 120_000;

function compileInWorker(input) {
  return new Promise((resolve, reject) => {
    const compilerScriptUrl = new URL(soljsonUrl, window.location.href).href;
    const workerSource = `
      self.addEventListener('message', ({ data }) => {
        try {
          const compile = Module.cwrap('solidity_compile', 'string', ['string', 'number', 'number']);
          self.postMessage({ type: 'result', output: compile(JSON.stringify(data), 0, 0) });
        } catch (error) {
          self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      });
      self.Module = {
        onRuntimeInitialized() {
          const version = Module.cwrap('solidity_version', 'string', [])();
          self.postMessage({ type: 'ready', version });
        },
        onAbort(reason) {
          self.postMessage({ type: 'error', message: \`Solidity compiler failed to initialize: \${reason}\` });
        },
      };
      importScripts(${JSON.stringify(compilerScriptUrl)});
    `;
    const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    let worker;
    try {
      worker = new Worker(workerUrl);
    } catch (error) {
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Could not start the Solidity compiler worker: ${error.message}`));
      return;
    }
    let settled = false;
    let ready = false;
    let compilerVersion = '';
    const timeout = window.setTimeout(() => finish(new Error('Solidity compiler timed out. Try a smaller struct and retry.')), COMPILER_TIMEOUT_MS);

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      if (error) reject(error);
      else resolve(value);
    };

    worker.onerror = (event) => finish(new Error(event.message || 'The Solidity compiler worker failed.'));
    worker.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        ready = true;
        compilerVersion = data.version;
        worker.postMessage(input);
      } else if (data.type === 'result') {
        if (!ready) {
          finish(new Error('The Solidity compiler returned output before initialization completed.'));
          return;
        }
        try {
          finish(null, { version: compilerVersion, output: JSON.parse(data.output) });
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      } else if (data.type === 'error') {
        finish(new Error(data.message));
      }
    };
  });
}

export async function verifyStructLayouts(analysis, originalDeclaration, optimizedDeclaration) {
  const { version, output } = await compileInWorker(createCompilerInput(
    analysis.name,
    originalDeclaration,
    optimizedDeclaration
  ));
  return verifyCompilerOutput(output, version, analysis);
}
