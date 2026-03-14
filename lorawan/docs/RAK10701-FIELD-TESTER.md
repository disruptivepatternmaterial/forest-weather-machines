# RAK10701-Plus Field Tester with TTN

Gateway extension + EMQX + TTN. No Node-RED. Per [RAK10701-Plus Network Setup](https://docs.rakwireless.com/product-categories/wisgate/rak10701-plus/network-setup/), the **Field Test Data Processor Extension** on the RAK gateway connects to your **local MQTT broker (EMQX)** to receive uplinks and publish downlinks.

**Quick refresh:** (1) TTN: activation downlink once (FPort 10, hex `76312E312E30`); paste `lorawan/payload/RAK rak10701-plus.js` into Payload formatters → Uplink. (2) Gateway: Extensions → Field Test Data Processor → MQTT broker mqtt.tableman.com, uplink/downlink topics as below. (3) EMQX: `docker/emqx/conf/conf.d/99-custom.hocon` has ttn_uplink_rak10701, rak10701_down, ttn_downlink_replace. (4) HA: `docker/ha/config/mqtt.yaml` subscribes to `v3/.../rak10701-plus/up`.

## Flow

1. **Field Tester** sends uplinks → **RAK7268V2** (Packet Forwarder / Basic Station) → **TTN**.
2. **EMQX** subscribes to TTN MQTT; rule **ttn_uplink_rak10701** republishes rak10701-plus uplinks to `v3/my-app-tobi@ttn/devices/rak10701-plus/up` on mqtt.tableman.com.
3. **Extension** (on gateway) subscribes to that topic on mqtt.tableman.com, computes metrics, publishes downlink to `v3/my-app-tobi@ttn/devices/rak10701-plus/down`.
4. **EMQX** rules republish that to `.../down/replace` and the TTN connector forwards to TTN → device receives downlink and shows stats.

## One-time activation (device must use f_port 1)

The device only sends the 10-byte GPS payload on **f_port 1** after it has received an activation downlink. In **TTN Console** → Application **my-app-tobi** → **rak10701-plus** → **Downlink** tab, send **once**:

- **FPort:** 10  
- **Payload type:** Hex  
- **Payload (hex):** `76312E312E30` (ASCII `"v1.1.0"`)

After the device receives it, it will send 10-byte GPS on f_port 1 and the extension can process uplinks and send stats downlinks.

## Payload formatter (TTN)

Paste the contents of **`lorawan/payload/RAK rak10701-plus.js`** into **TTN Console** → Application **my-app-tobi** → **Payload formatters** → **Uplink** → Save. Decodes 10-byte GPS on f_port 1 or 5; quality gate: only expose position when hdop < 2 and sats ≥ 5.

## Gateway extension config (Extensions → Field Test Data Processor → Configuration)

| Field | Value |
|-------|--------|
| LoRa Network Server | The Things Network |
| MQTT Broker Address | `mqtt.tableman.com` |
| Port | `1883` |
| Enable User Authentication | Off |
| Enable TLS | Off |
| Uplink Topic | `v3/my-app-tobi@ttn/devices/rak10701-plus/up` |
| Downlink Topic | `v3/my-app-tobi@ttn/devices/rak10701-plus/down` |

**Important:** Downlink topic must be exactly `.../down` (not `.../do` or cut off). Click **Save changes**.

## EMQX rules (already in `docker/emqx/conf/conf.d/99-custom.hocon`)

- **ttn_uplink_rak10701:** Uplinks for rak10701-plus from TTN bridge → republish to `v3/my-app-tobi@ttn/devices/rak10701-plus/up` so the Field Test extension (subscribed to that topic) receives them. Without this, the extension gets no uplinks and never publishes downlinks.
- **rak10701_down:** Messages on `v3/my-app-tobi@ttn/devices/rak10701-plus/down` → republish to `v3/my-app-tobi@ttn/devices/rak10701-plus/down/replace`.
- **ttn_downlink_replace:** Messages on `v3/.../devices/+/down/replace` → forward to TTN via connector.

**TTN down/replace payload format:** TTN only accepts this JSON on `.../down/replace`:
```json
{"downlinks":[{"f_port":1,"frm_payload":"<base64>","priority":"NORMAL"}]}
```
The extension must publish exactly that (or publish to `.../down/replace` with that body). If the extension publishes only raw base64 or another structure, the downlink will not be scheduled.

Restart EMQX after config changes.

## Home Assistant

Sensors are in **`docker/ha/config/mqtt.yaml`**: state_topic `v3/my-app-tobi@ttn/devices/rak10701-plus/up`. Templates use `uplink_message.decoded_payload` (f_port 1) with fallback to root-level `value_json.locations["frm-payload"]`. Entities: Location (lat/lon in attributes), Altitude, GPS accuracy, HDOP, Satellites, RSSI, SNR, Gateway, Last Update.

## f_port

The extension only processes uplinks on **f_port 1** (or 11). Send the activation downlink (FPort 10, `76312E312E30`) once so the device uses port 1; uplinks on other ports are ignored.

## Min/Max distance on device

Basic Station does not send gateway location to TTN. Set the gateway's antenna location in **TTN Console** → **Gateways** → your RAK7268V2 → **Location** → Save. Otherwise min/max distance may stay blank.

## Troubleshooting

- Gateway must reach mqtt.tableman.com:1883 (DNS, firewall).
- In TTN Console, confirm device is registered and uplinks appear; check **Downlink** tab for queued/sent/failed downlinks.
- Ensure RAK10701 is in field test mode sending on f_port 1.

**Nothing showing on device (RSSI/SNR/stats):**

1. **See if the extension is publishing:** Subscribe on mqtt.tableman.com to `v3/my-app-tobi@ttn/devices/rak10701-plus/down`. Trigger an uplink from the device. If no message appears on that topic, the extension is not publishing (not receiving uplinks, or not parsing the TTN JSON, or wrong gateway config).
2. **Check TTN downlink queue:** TTN Console → Application → rak10701-plus → **Downlink**. After an uplink, is a downlink queued, sent, or failed? If "failed", the payload format is wrong (TTN expects `{"downlinks":[{"f_port":1,"frm_payload":"<base64>","priority":"NORMAL"}]}`).
3. **Uplink format:** The extension must understand the TTN v3 uplink JSON (e.g. `uplink_message.decoded_payload`, `uplink_message.rx_metadata[].rssi`, `uplink_message.rx_metadata[].snr`, `uplink_message.f_cnt`). If the RAK extension was built for ChirpStack only, it may not parse TTN's structure and may never publish a downlink. In that case you need a small adapter (script or other processor) that subscribes to `.../up`, computes stats, and publishes the TTN-format downlink to `.../down/replace`.
