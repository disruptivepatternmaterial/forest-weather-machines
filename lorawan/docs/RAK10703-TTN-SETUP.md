# RAK10703 WisBlock Earthquake Sensor — TTN setup

Serial: **115200 8N1**. Send each command with **\r\n** (Enter). After **ATZ** the port disconnects; reconnect to the same port.

**Do not run ATR.** ATR restores factory defaults (different EUIs); then you must set the device back to the values below to use your app.

**Check band first.** The device **band (region)** and **channel mask** must match TTN’s frequency plan and your gateway. For US915 with TTN “United States 902–928 MHz, FSB 2”, use **AT+BAND=5** and **AT+MASK=2** (subband 2). After any reset or power-up, verify with **AT+BAND=?** and **AT+MASK=?** — if either is wrong, join will never succeed. Fix band and mask before anything else.

---

## 0. Plan to fix “device never joins”

If the device stays at **NJS=2** (joining) or **NJS=0** (not joined) and never reaches **NJS=1**:

0. **Band and mask:** Confirm **AT+BAND=?** returns **5** (US915) and **AT+MASK=?** returns **2** (FSB 2). If not, set **AT+BAND=5**, **AT+MASK=2**, and **ATZ**. TTN must use the matching US915 plan (FSB 2). Band or mask mismatch is a common cause of “never joins”.
1. **TTN:** Confirm end device **earthquake-rak-10703** exists in your application with JoinEUI `AC1F09FFF9154631`, DevEUI `AC1F09FFFE215317`, AppKey `AC1F09FFFE215317AC1F09FFF9154631`, frequency plan **US915**. If in doubt: **Reset session and MAC state** for that device.
2. **Gateway:** Same cluster (e.g. **nam1**), **US915**, status **Connected**. Put the RAK10703 **next to the gateway** (1–2 m) for the join attempt.
3. **Device:** Run the full sequence in **Section 2** (including **AT+JOIN=1:1:8:5** and **AT+TXP=10**), then **ATZ**. Reconnect and wait 2–3 minutes. Do **not** send `AT+JOIN` again if you see ERROR:2 (auto join is already on).
4. **TTN Live data:** Open your application → **earthquake-rak-10703** → **Live data**. Check whether any **Join request** (and then **Join accept**) appears.
   - **No Join request** → Gateway is not receiving the device: confirm gateway US915 and connected; keep device next to gateway.
   - **Join request but no Join accept** → Device is not receiving the downlink: keep device next to gateway and retry; ensure gateway can send downlinks.

**No Join request, but other devices on the same gateway work:** The gateway is fine; the RAK10703 is not being heard. Check:
- **Antenna:** Ensure the RAK10703 antenna is firmly connected (screw-on). No metal enclosure or foil blocking it.
- **Placement:** Same table as gateway, antenna upright, not pressed against the gateway antenna.
- **Try another gateway:** If you have a second gateway, put the RAK10703 next to it and watch Live data again. If Join request appears there, the first gateway may have a channel/antenna issue for this device; if still no Join request, the RAK10703 antenna or RF path is the suspect.

**Device shows "null" and +CME ERROR:1:** Something is sending invalid or empty AT commands (e.g. a script or app). For the join attempt, use only a serial terminal and type the Section 2 commands manually; do not run scripts that might send empty lines or non-AT strings.

**OTAA still never joins after many attempts:** The device is likely not receiving the Join Accept downlink (gateway TX, distance, or RX timing). Use **Section 2a (ABP workaround)** to get the device online without join; same payload formatter, data in TTN. You can keep the OTAA device for later (e.g. different gateway or firmware).

---

## 1. TTN Console — add end device

1. Open [TTN Console](https://console.thethings.network/), cluster **nam1**. Open your application.
2. **Add end device** → **Manually**.
3. Enter exactly:
  - **Activation:** Over the air activation (OTAA).
  - **End device ID:** `earthquake-rak-10703`
  - **JoinEUI:** `AC1F09FFF9154631`
  - **DevEUI:** `AC1F09FFFE215317`
  - **AppKey:** `AC1F09FFFE215317AC1F09FFF9154631`
  - **Frequency plan:** United States 902-928 MHz, FSB 2 (US915).
  - **LoRaWAN version:** LoRaWAN Specification 1.0.3 (RAK4631 is 1.0.2; use 1.0.x, not 1.1).
  - **Regional Parameters:** RP001 1.0.3 revision A.
4. **Register end device.**

---

## 2a. If OTAA never joins: ABP workaround

If the device never reaches **NJS=1** (Join Accept not received or not decoded), you can use **ABP** so it can send uplinks without joining. No downlink is required for activation.

**In TTN Console**

1. **Add end device** → **Manually**.
2. **Activation:** **Activation by personalization (ABP)**.
3. **End device ID:** e.g. `earthquake-rak-10703-abp` (use a different ID so you keep the OTAA device for later).
4. **Frequency plan:** US915 (United States 902–928 MHz, FSB 2).
5. **LoRaWAN version:** 1.0.3; **Regional Parameters:** 1.0.3 rev A.
6. **Register end device.**
7. Open the new device → **Session** (or **MAC** → session). Note the **Device address** (DevAddr), **AppSKey**, and **F-NwkSIntKey** (this is NwkSKey for 1.0.x). Copy them exactly (hex, no spaces).

**On the RAK10703 (serial 115200)**

Send (replace the values with what TTN shows):

```
AT+NJM=0
AT+DEVADDR=<DevAddr from TTN, 8 hex chars>
AT+NWKSKEY=<F-NwkSIntKey from TTN, 32 hex>
AT+APPSKEY=<AppSKey from TTN, 32 hex>
AT+BAND=5
AT+CLASS=A
AT+CFM=0
AT+TXP=10
ATZ
```

Example (fake values — use yours from TTN):

```
AT+NJM=0
AT+DEVADDR=26021FB4
AT+NWKSKEY=323D155A000DF335307A16DA0C9DF53F
AT+APPSKEY=3F6A66459D5EDCA63CBC4619CD61A11E
AT+BAND=5
AT+CLASS=A
AT+CFM=0
AT+TXP=10
ATZ
```

Reconnect after **ATZ**. The device should send without joining. In TTN, assign the **same uplink payload formatter** (RAK10703-earthquake.js) to this application so the ABP device decodes the same way.

**When to use this:** Use ABP to confirm uplink, formatter, and gateway path work. You can keep trying OTAA (e.g. different gateway, firmware update) later.

---

## 2. AT commands on the device

Connect serial 115200 8N1. Send these lines **in this order**, one per line, with Enter after each. Type `AT+` not `T+`.

```
AT+DEVEUI=AC1F09FFFE215317
AT+APPEUI=AC1F09FFF9154631
AT+APPKEY=AC1F09FFFE215317AC1F09FFF9154631
AT+BAND=5
AT+NJM=1
AT+CLASS=A
AT+LPM=1
AT+CFM=0
AT+TXP=10
AT+MASK=2
AT+JOIN=1:1:8:5
ATZ
```

- **AT+LPM=1** = enable low power mode (recommended for join; with LPM=0 some firmware can miss the Join Accept RX window). If **AT+LPM=1** returns +CME ERROR:2, skip it and continue (this build may not allow LPM change in current state).
- **AT+MASK=2** = channel mask for US915 subband 2 (required for TTN “FSB 2”). Without this, device and gateway use different channels and join fails.
- **AT+TXP=10** = max transmit power (helps gateway hear the device).
- **AT+JOIN=1:1:8:5** = enable auto join (so after ATZ the device keeps trying to join; without this, **AT+JOIN** can return ERROR:2).

Serial will disconnect. Reconnect to the same port. **Do not send AT+JOIN** after reconnect (auto join is on). Wait 2–3 minutes. Then send:

```
AT+NJS=?
```

- Reply **1** = joined. Done.
- Reply **2** = joining. Wait or move device closer to gateway, check again in 1–2 minutes.
- Reply **0** = not joined. Move device near gateway; wait for next auto-join cycle or send `AT+JOIN` once.

---

## 3. Verify device settings

After reconnect (before or after join), confirm:

```
AT+BAND=?
AT+APPEUI=?
AT+DEVEUI=?
```

You must see: **AT+BAND=5**, **AT+APPEUI=AC1F09FFF9154631**, **AT+DEVEUI=AC1F09FFFE215317**.

---

## 4. Payload formatter in TTN

1. TTN Console → your application → **Payload formatters** → **Uplink**.
2. **Formatter type:** JavaScript.
3. Paste the full contents of [lorawan/payload/RAK10703-earthquake.js](../payload/RAK10703-earthquake.js).
4. **Save.**

Decoded fields will show in Live data: `battery_voltage_V`, `earthquake_active`, `si_value_m_s`, `pga_m_s2`, `shutoff_alert`, `collapse_alert`, etc. Uplinks appear every 600 s (alive) or when the D7S triggers.

---

## 5. AT command reference (this firmware)

From `AT?` on RAK4630/WisBlock API 1.5.8:


| Command     | Read/Write | Meaning                                                                                          |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------ |
| AT+APPEUI   | RW         | Application/Join EUI (16 hex)                                                                    |
| AT+DEVEUI   | RW         | Device EUI (16 hex)                                                                              |
| AT+APPKEY   | RW         | Application key (32 hex)                                                                         |
| AT+BAND     | RW         | Region: 0=EU433, 1=CN470, 2=RU864, 3=IN865, 4=EU868, **5=US915**, 6=AU915, 7=KR920, 8–11=AS923-x |
| AT+MASK     | RW         | US915/AU915 channel mask (subband). Use **2** for TTN US915 FSB 2. Verify with AT+MASK=? after reset. |
| AT+NJM      | RW         | Join mode: 1=OTAA, 0=ABP                                                                         |
| AT+JOIN     | W          | Start join (one shot; if auto join on, returns ERROR:2 — do not use)                               |
| AT+NJS      | R          | Join status: 0=not joined, 1=joined, 2=joining                                                   |
| AT+TXP      | RW         | Transmit power 0–10 (10=max). Use 10 for join if link is marginal.                                |
| AT+CFM      | RW         | Confirm: 0=unconfirmed, 1=confirmed                                                              |
| AT+CLASS    | RW         | Class A/B/C                                                                                      |
| AT+LPM      | RW         | Low power mode: 0=off, 1=on. Use 1 for join so RX window timing is correct.                      |
| ATZ         | R          | Reset MCU; serial drops                                                                          |
| ATR         | R          | Restore factory defaults (do not use; resets EUIs to other identity)                             |
| ATC+STATUS  | R          | LoRaWAN status                                                                                   |
| ATC+SENDINT | RW         | Send interval (seconds)                                                                          |
| ATC+SENS    | RW         | Seismic threshold: 1=low, 0=high                                                                 |


---

## References

- [beegee-tokyo/WisBlock-Seismic-Sensor](https://github.com/beegee-tokyo/WisBlock-Seismic-Sensor) — packet format, channel IDs
- [RAK10703 product page](https://store.rakwireless.com/products/wisblock-earthquake-sensor-solution-kit-wisblock-rak10703-k-wisblock-rak10703)
- [RAK4631-R AT Command Manual](https://docs.rakwireless.com/product-categories/wisblock/rak4631-r/at-command-manual/)

