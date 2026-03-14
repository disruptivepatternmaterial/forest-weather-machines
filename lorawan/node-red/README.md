# Node-RED assets for LoRaWAN pipeline

Copy these into Node-RED Function nodes or import the flow. Full description: [../docs/PIPELINE-AND-NODE-RED.md](../docs/PIPELINE-AND-NODE-RED.md).

| File | Purpose |
|------|--------|
| **ttn-uplink-to-flat.js** | TTN uplink JSON → common flat payload; sets `msg.topic` for MQTT. |
| **particle-webhook-to-flat.js** | Particle webhook JSON → same flat payload (Wx1/Wx2 path registry). |
| **flat-to-split-display-messages.js** | Flat payload → one msg with `payload` = array of 13 message objects (topic, payload, ts, parts). Use **Split** (on payload) then **split-display-promote-payload.js** to get 13 separate messages. |
| **split-display-promote-payload.js** | After Split: `msg.payload` (one object) → become full `msg` (topic, payload, ts, parts). |
| **station.js** | Build Windy.com observation URL from normalized payload or HA Wx1 state; 2 outputs (fresh / stale). |
| **lorawanproc.json** | Flow: MQTT in (TTN uplinks) → extract & store last 20 per sensor → debug; + every 15 min → latest &lt;2h. |

**RAK10701-Plus Field Tester (TTN):** Gateway extension + EMQX only. One-time activation downlink from TTN (FPort 10, hex `76312E312E30`); paste payload formatter from `lorawan/payload/RAK rak10701-plus.js` into TTN Console; HA sensors in `docker/ha/config/mqtt.yaml`. See [PIPELINE-AND-NODE-RED.md §7](../docs/PIPELINE-AND-NODE-RED.md) and [RAK10701-FIELD-TESTER.md](../docs/RAK10701-FIELD-TESTER.md).

Import flow: Node-RED → Import → select `lorawanproc.json`. Ensure a tab named `lorawan_tab_001` exists (or create it) and broker config matches your MQTT server.
