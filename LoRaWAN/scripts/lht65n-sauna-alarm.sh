#!/usr/bin/env bash
# Push LHT65N Sauna (t65n6269147) temp alarm downlinks — external probe, alarm below 5°C or above 80°C.
# Requires: ttn-lw-cli configured and logged in.
# Ref: docs/DEVICES-HARDWARE.md (LHT65N note)

set -e
APP_ID="my-app-tobi"
SAUNA_DEVICE="t65n6269147"

# fPort 2: WMOD 1 (external probe), 60 s sample, alarm <5°C or >80°C; then LED alarm on
EXTERNAL_ALARM="A5013C01F41F40"
LED_ALARM="3601"

echo "Pushing downlinks to $SAUNA_DEVICE (Sauna LHT65N)..."
ttn-lw-cli end-devices downlink push "$APP_ID" "$SAUNA_DEVICE" --f-port 2 --frm-payload "$EXTERNAL_ALARM"
ttn-lw-cli end-devices downlink push "$APP_ID" "$SAUNA_DEVICE" --f-port 2 --frm-payload "$LED_ALARM"
echo "Done."
