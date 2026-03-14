# Device & hardware reference (my-app-tobi)

Maps TTN device IDs to hardware so we know which payloads, downlinks, and scripts apply.  
Update this when you add or retire devices.


| Device ID            | Hardware           | Location | T/H alarms | Datalog | S31 config | Notes                                                       |
| -------------------- | ------------------ | -------- | ---------- | ------- | ---------- | ----------------------------------------------------------- |
| lr-temp-humid-001    | Dragino S31B-LS    | Woods    | X          | X       | X          | Temp/humidity, SHT31. Use S31 downlinks (alarms, interval).  |
| lr-temp-humid-002    | Dragino S31B-LS    | Woods    | X          | X       | X          | Temp/humidity, SHT31. Use S31 downlinks (alarms, interval).  |
| earthquake-rak-10703 | RAK10703           | Beta     |            |         |            | Earthquake / seismic. See `docs/RAK10703-TTN-SETUP.md`.     |
| rak10701-plus        | RAK10701 Plus      | Float    |            |         |            | Field tester. See `docs/RAK10701-FIELD-TESTER.md`.          |
| la666054870          | Dragino S31B-LS    | Woods    | X          | X       | X          | Temp/humidity, SHT31. Use S31 downlinks (alarms, interval).  |
| la666054877          | Dragino S31B-LS    | Woods    | X          | X       | X          | Temp/humidity, SHT31. Use S31 downlinks (alarms, interval).  |
| t65n6269142          | Dragino LHT65N     | Home     |            |         |            | 3D Printer Cabinet. Track temp/humid when using printer; no script changes. |
| t65n6269147          | Dragino LHT65N     | Home     |            |         |            | Sauna. Threshold alerts desired. LHT65N supports **temp** alarm only (WMOD A503…); use TTN/HA for humidity. See LHT65N note below. |
| lr-distance-sensor   | Dragino DDS75-LB   | Woods    |            |         |            | Distance sensor. Decoder: `payload/Dragino DDS75-LB.js`.    |
| muon-air-sensor-001  | Muon / air quality | Beta     |            |         |            | Custom or Particle-related.                                 |
| muon-air-sensor-002  | Muon / air quality | Beta     |            |         |            | Custom or Particle-related.                                 |
| df-robot-001         | DFRobot            | Beta     |            |         |            | e.g. SEN0466 or similar. Repo: dfrobot_sen0466.            |
| 6773a47722230004     | Milesight VS370    | Home     |            |         |            | Decoder: `payload/VS370-915M.js`.                           |
| 9181010k6060118006   | RAK2560 + RK900-09 | Beta     |            |         |            | WisNode Sensor Hub + Miniature Ultrasonic Weather Station.  |

**S31 config:** X = script has been run for this device (PNACKMD=1, 1 h interval, T/H alarms 30–80%, -1–25°C, alarm interval 30 min). See `scripts/s31-set-alarms.sh`.

**Datalog:** Device stores readings when network is down; you can poll later via downlink (S31: fPort 2 `31` + time range → reply on fPort 3). Requires PNACKMD=1 on device.

**LHT65N (e.g. Sauna t65n6269147):** Device supports **temperature** threshold alarm only (no humidity in firmware). **Sauna has external temp probe** — use WMOD 1 (external DS18B20/TMP117), not internal. (1) Send on fPort 2: **`A5013C01F41F40`** = external probe, sample 60 s, alarm below 5°C or above 80°C (temps as °C×100: 01F4=5°, 1F40=80°). (2) Optionally `3601` for LED on alarm. For humidity thresholds use TTN/HA. Ref: [Dragino LHT65N manual](https://wiki.dragino.com/xwiki/bin/view/Main/User%20Manual%20for%20LoRaWAN%20End%20Nodes/LHT65N%20LoRaWAN%20Temperature%20%26%20Humidity%20Sensor%20Manual/) §2.7.

---

## Payload decoders (payload/)


| File                      | Use for                                    |
| ------------------------- | ------------------------------------------ |
| Dragino S31B-LS.js        | S31B-LS, S31-LB, S31B-LB (fPort 2 uplink). |
| Dragino S31-LB.js         | S31-LB variant.                            |
| Dragino LHT65N.js         | LHT65N temp/humidity.                      |
| Dragino DDS75-LB.js       | DDS75-LB.                                  |
| RAK10703-earthquake.js    | RAK10703.                                  |
| rak-wx-station-default.js | RAK weather station.                       |
| RAK rak10701-plus.js      | RAK10701 Plus.                             |


---

## Scripts that target specific hardware


| Script                    | Devices                                                        | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| scripts/s31-set-alarms.sh | lr-temp-humid-001, lr-temp-humid-002, la666054870, la666054877 | Push S31 humidity (30–80%) and temp (-1–25°C) alarm downlinks. |
| scripts/lht65n-sauna-alarm.sh | t65n6269147                                                | Push LHT65N Sauna external-probe alarm (<5°C or >80°C) + LED.  |
| scripts/s31-set-txp-max.sh    | lr-temp-humid-001, lr-temp-humid-002, la666054877 (N Twin Extra) | Set transmit power to max (TXP=0).                        |


