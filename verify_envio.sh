#!/bin/bash
export PATH=/home/nalin/node-v22.23.3-linux-x64/bin:$PATH
echo "OS: $(uname -s)"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Current directory: $(pwd)"
cd /mnt/d/codes/Monad-PageSync/envio
if [ -d "node_modules/envio" ]; then
    echo "node_modules/envio exists"
else
    echo "node_modules/envio does not exist"
fi
if [ -n "$ENVIO_API_TOKEN" ]; then
    echo "ENVIO_API_TOKEN is set"
else
    echo "ENVIO_API_TOKEN is not set"
fi
