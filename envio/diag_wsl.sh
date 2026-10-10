#!/bin/bash
echo "--- OS Info ---"
uname -a
echo "--- Working Directory ---"
pwd
echo "--- Environment PATH ---"
export PATH=/home/nalin/node-v22.23.3-linux-x64/bin:$PATH
echo $PATH
echo "--- Node and NPM versions ---"
node -v
npm -v
echo "--- Node Platform and Arch ---"
node -e "console.log(process.platform + ' ' + process.arch)"
echo "--- Envio Version ---"
node -p "require('./node_modules/envio/package.json').version"
echo "--- Native Addon Check ---"
node -e "try { const addon = require('./node_modules/envio-linux-x64/envio.node'); console.log('Addon loaded successfully'); } catch (e) { console.error('Addon load failed: ' + e.message); }"
