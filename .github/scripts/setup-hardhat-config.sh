#!/bin/sh
GOERLI_URL="$1"
MUMBAI_URL="$2"
MAINNET_URL="$3"
POLYGON_URL="$4"

set -o errexit

mkdir -p $HOME/.hardhat

echo "
{
  \"networks\": {
    \"goerli\": { \"url\": \"${GOERLI_URL}\" },
    \"mumbai\": { \"url\": \"${MUMBAI_URL}\" },
    \"mainnet\": { \"url\": \"${MAINNET_URL}\" },
    \"polygon\": { \"url\": \"${POLYGON_URL}\" }
  }
}
" > $HOME/.hardhat/networks.mimic.json
