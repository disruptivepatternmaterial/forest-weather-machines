#!/usr/bin/env bash
# Set Dragino S31B-LS (lr-temp-humid-001, lr-temp-humid-002, la666054877 N Twin Extra) to max transmit power (TXP=0).
# General Dragino downlink 0x22, 4th byte = TXP. 22000100 = TXP 0 (max).
# Requires: ttn-lw-cli configured and logged in.
# Ref: docs/S31B-LS-TTN-Guide.md §4 (RF transmit power)

set -e
APP_ID="my-app-tobi"
TXP_MAX="22000100"
DEVICES=("lr-temp-humid-001" "lr-temp-humid-002" "la666054877")

for dev in "${DEVICES[@]}"; do
  echo "Pushing TXP=0 (max power) to $dev..."
  ttn-lw-cli end-devices downlink push "$APP_ID" "$dev" --f-port 2 --frm-payload "$TXP_MAX"
done
echo "Done."
