#!/bin/bash
export PATH=/home/nalin/node-v22.23.3-linux-x64/bin:$PATH
cd /mnt/d/codes/Monad-PageSync/envio

# 1. Load root .env securely
# We source the file from the parent directory
if [ -f /mnt/d/codes/Monad-PageSync/.env ]; then
    # Export only the ENVIO_API_TOKEN to avoid polluting the environment
    export ENVIO_API_TOKEN=$(grep ENVIO_API_TOKEN /mnt/d/codes/Monad-PageSync/.env | tr -d '\r' | cut -d= -f2)
fi

# 2. Verify token availability (without printing)
if [ -n "$ENVIO_API_TOKEN" ]; then
    echo "Verification: ENVIO_API_TOKEN is set."
else
    echo "Error: ENVIO_API_TOKEN is not set."
    exit 1
fi

# 4. Run codegen using the specific path provided
echo "Running Envio codegen..."
node ./node_modules/envio/bin.mjs codegen
if [ $? -eq 0 ]; then
    echo "Codegen successful."
else
    echo "Codegen failed."
    exit 1
fi

# 5. Run envio dev
echo "Starting envio dev..."
node ./node_modules/envio/bin.mjs dev
