#!/usr/bin/env bash
# Push Dragino S31B-LS config and alarm downlinks to temp/humidity sensors in my-app-tobi.
# Sets: PNACKMD=1 (datalog), transmit interval 1 h, humidity 30–80%, temp -1–25°C, alarm interval 30 min.
# Requires: ttn-lw-cli configured and logged in.
# Ref: docs/S31B-LS-TTN-Guide.md, Dragino End Device AT Commands and Downlink Command (0x34, 0x01).

set -e
APP_ID="my-app-tobi"
# Only S31B-LS (or S31-LB) devices; other devices in the app are different hardware.
S31_DEVICES=("lr-temp-humid-001" "lr-temp-humid-002" "la666054870" "la666054877")

# Downlink payloads (fPort 2, hex).
PNACKMD_ENABLE="3401"       # 0x34 01: PNACKMD=1 — store no-ACK packets, resend when network back (datalog)
TRANSMIT_INTERVAL="01000E10" # 0x01 + 3B: TDC = 3600 s = 1 hour (0x0E10)
HUMIDITY_ALARM="0C021E50"   # 0C 02: humidity; 1E=30% low, 50=80% high
TEMPERATURE_ALARM="0C01FF19" # 0C 01: temp; FF=-1°C low, 19=25°C high
ALARM_INTERVAL="0D001E"     # 0D 00 1E: min interval between alarm uplinks = 30 min

for dev in "${S31_DEVICES[@]}"; do
  echo "Pushing downlinks to $dev..."
  ttn-lw-cli end-devices downlink push "$APP_ID" "$dev" --f-port 2 --frm-payload "$PNACKMD_ENABLE"
  ttn-lw-cli end-devices downlink push "$APP_ID" "$dev" --f-port 2 --frm-payload "$TRANSMIT_INTERVAL"
  ttn-lw-cli end-devices downlink push "$APP_ID" "$dev" --f-port 2 --frm-payload "$HUMIDITY_ALARM"
  ttn-lw-cli end-devices downlink push "$APP_ID" "$dev" --f-port 2 --frm-payload "$TEMPERATURE_ALARM"
  ttn-lw-cli end-devices downlink push "$APP_ID" "$dev" --f-port 2 --frm-payload "$ALARM_INTERVAL"
done
echo "Done."
