#!/bin/sh
GOERLI_URL="$1"
MAINNET_URL="$2"
POLYGON_URL="$3"

set -o errexit

mkdir -p $HOME/.hardhat

echo "
{
  \"networks\": {
    \"goerli\": { \"url\": \"${GOERLI_URL}\" },
    \"mainnet\": { \"url\": \"${MAINNET_URL}\" },
    \"polygon\": { \"url\": \"${POLYGON_URL}\" }
  }
}
" > $HOME/.hardhat/networks.mimic.json
