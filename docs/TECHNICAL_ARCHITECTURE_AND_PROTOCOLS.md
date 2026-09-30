# PlantOps — Technical Architecture & Industrial Protocols Reference

> **Document Version:** 2.0  
> **Last Updated:** 29 September 2026  
> **Purpose:** Technical architecture reference, system explanation guide, and protocol documentation for engineering and management reviews.

---

## 1. System Architecture Overview

PlantOps is an enterprise-grade Smart Factory OS designed for autonomous predictive maintenance, real-time industrial telemetry ingestion, and closed-loop supply chain orchestration.

```
                         ┌────────────────────────────────────────────────────────┐
                         │                  FACTORY FLOOR ASSETS                  │
                         │    CNC Mills • Robots • Hydraulic Presses • AGVs       │
                         └──────────────────────────┬─────────────────────────────┘
                                                    │ (100 Hz Sensor Telemetry)
                                                    ▼
                         ┌────────────────────────────────────────────────────────┐
                         │         Mosquitto MQTT Broker (TCP: 1883)              │
                         │     Topics: plantops/machines/+/telemetry              │
                         └──────────────────────────┬─────────────────────────────┘
                                                    │
                                                    ▼
                         ┌────────────────────────────────────────────────────────┐
                         │              PLANTOPS NODE.JS / TS BACKEND             │
                         │    • Anomaly Detection Engine    • LOTO Safety Engine  │
                         │    • Autonomous Procurement Agent • AGV Fleet Dispatch │
                         └───┬──────────────────────┬───────────────────────┬─────┘
                             │                      │                       │
           (ACID Relational) │   (Time-Series Stream)│     (Pub/Sub & Cache) │
                             ▼                      ▼                       ▼
┌───────────────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────┐
│     TiDB Cloud (Distributed SQL)  │ │   TimescaleDB (Hypertables)│ │   Redis In-Memory Bus │
│  • Spare Parts & ATP Inventory    │ │ • 100Hz Vibration RMS     │ │ • Telemetry Pub/Sub   │
│  • Work Orders & LOTO Padlocks    │ │ • Thermal IR Profiles     │ │ • Lockout/Tagout Locks│
│  • Purchase Orders & Suppliers    │ │ • Spindle RPM & Wattage   │ │ • AGV Dispatch Events │
│  • Incidents & Daily Run History  │ │ • Downsampled Aggregations│ │ • Cluster Cache       │
└───────────────────────────────────┘ └───────────────────────────┘ └───────────────────────┘
                             │
                             ▼ (Bi-Directional Real-Time Events)
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                        WebSocket Event Bus (Broadcast / Socket.io)                         │
└────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                             │
                                             ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                           PLANTOPS FRONTEND WEB APPLICATION                               │
│  3D Digital Twin • Factory Floor Map • ATP Spares • Autonomous POs • Vendor Directory      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Technologies & Data Stores

### 2.1. Mosquitto MQTT Broker
* **Role:** Lightweight Industrial Edge Telemetry Broker.
* **Port / Protocol:** `TCP: 1883` | MQTT 3.1.1 / 5.0.
* **Why Used:**
  - **Industrial Hardware Standard:** Natively supported by PLCs (Siemens, Allen-Bradley), edge gateways (Advantech UNO, Moxa), and smart sensors (IFM vibration MEMS) without third-party cloud SDKs.
  - **Ultra-Low Bandwidth & Latency:** Binary header overhead is minimal (~2 bytes), enabling continuous 100 Hz vibration sampling on the factory floor with zero network congestion.
  - **Wildcard Topic Routing:** Uses hierarchical topics (`plantops/machines/+/telemetry`, `plant/+/telemetry`, `plantops/incidents/alerts`).

---

### 2.2. TiDB Cloud (MySQL-Compatible Distributed SQL)
* **Role:** Authoritative ACID Transactional Ledger.
* **Port / Protocol:** `TCP: 3307` | MySQL Protocol TLS 1.2+.
* **Why Used:**
  - **High Availability & Distributed Scale:** Combines relational consistency (ACID) with horizontal scale-out capabilities.
  - **Zero-Mock Production Persistence:** Stores operational entities including `spare_parts`, `inventory`, `purchase_orders`, `suppliers`, `work_orders`, `technicians`, and `incidents`.
  - **Real-Time ATP Calculations:** Evaluates Available-To-Promise stock dynamically via transactional SQL joins:
    $$\text{ATP} = \text{Quantity on Hand} - \text{Reserved Quantity}$$

---

### 2.3. TimescaleDB (Time-Series Database on PostgreSQL)
* **Role:** High-Frequency Sensor Telemetry Ingestion & Historical Downsampling.
* **Port / Protocol:** `TCP: 5432` | PostgreSQL Protocol.
* **Why Used:**
  - **Hypertables (Automatic Partitioning):** Partitions massive telemetry streams by timestamp chunks, maintaining high ingestion rates even with 50M+ rows.
  - **Built-in Downsampling (`time_bucket`):** Powers live sparklines in the 3D Digital Twin by aggregating raw sensor points into 1-second, 1-minute, or 1-hour metrics in milliseconds:
    ```sql
    SELECT time_bucket('1 minute', recorded_at) AS bucket,
           AVG(vibration_rms) AS avg_vib,
           MAX(temperature_c) AS max_temp
    FROM machine_telemetry
    WHERE machine_id = 'CNC-01' AND recorded_at > NOW() - INTERVAL '6 hours'
    GROUP BY bucket ORDER BY bucket DESC;
    ```
  - **Columnar Compression:** Compresses telemetry data by up to **90–95%**, significantly cutting disk storage costs.

---

### 2.4. Redis (Cache & Inter-Service Pub/Sub)
* **Role:** High-Speed In-Memory Cache and Distributed Microservice Event Bus.
* **Port / Protocol:** `TCP: 6379` | RESP Protocol.
* **Why Used:**
  - **Sub-Millisecond Pub/Sub:** Decouples sensor ingestion workers from AI diagnosis engines and API endpoints.
  - **Distributed Locks:** Prevents double-allocation of spare parts and ensures single-technician assignment during simultaneous work order requests.

---

### 2.5. WebSocket / Socket.io
* **Role:** Real-Time Bi-Directional Client Push Layer.
* **Port / Protocol:** `WSS / WS` on Port `4000`.
* **Why Used:**
  - **Zero-Polling UI Updates:** Pushes machine telemetry, power state changes, E-Stop trip locks, AGV fleet movements, and PO receipts directly to the React application in real time.
  - **Live Events Broadcasted:**
    - `power:status_changed`, `power:started`, `power:estop`
    - `breaker:toggled`, `part:reserved`, `po:received`
    - `work_order:dispatched`, `loto:verified`
    - `pallet:accumulated`, `agv:status_updated`

---

## 3. Industrial Protocols & Standards

### 3.1. MQTT (Message Queuing Telemetry Transport)
* **Standard:** ISO/IEC 20922:2016.
* **Architecture:** Publish/Subscribe model over TCP/IP.
* **Implementation in PlantOps:**
  - **Publishers:** Advantech UNO Edge Gateways, Siemens SIMATIC IOT2050, IFM Diagnostic Vibration Sensors.
  - **QoS Level:** QoS 1 (At least once delivery) for telemetry; QoS 2 (Exactly once) for safety and incident alert topics.

---

### 3.2. EDI AS2 (Applicability Statement 2)
* **Standard:** RFC 4130 (Electronic Data Interchange over HTTP/S with S/MIME).
* **Role in PlantOps Autonomous Procurement:**
  - Facilitates machine-to-machine B2B communication with Tier-1 MRO distributors (Motion Industries, NSK, Sandvik Coromant, Parker Hannifin).
  - Encrypts purchase order payloads (ANSI X12 850 / EDIFACT ORDERS) with digital signatures and Message Disposition Notifications (MDN).
  - Guarantees non-repudiation and automated vendor receipt confirmation within <15 minutes.

---

### 3.3. OSHA 1910.147 Safety Workflow (The Control of Hazardous Energy / Lockout-Tagout)
* **Standard:** OSHA Title 29 CFR § 1910.147.
* **Implementation in PlantOps Digital Twin & Work Orders:**

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ 1. TRIP / FAULT │ ──> │ 2. DIGITAL LOTO PAD │ ──> │ 3. ZERO ENERGY VERIF│
│ Machine in ESTOP│     │ Assigned Tech Locks │     │ 0.0V / 0.0 PSI Check│
└─────────────────┘     └─────────────────────┘     └─────────────────────┘
                                                               │
┌─────────────────┐     ┌─────────────────────┐                │
│ 5. POWER RESUME │ <── │ 4. REPAIR COMPLETE  │ <──────────────┘
│ Operator Start  │     │ Padlock Removed     │
└─────────────────┘     └─────────────────────┘
```

1. **Hazardous Energy Isolation:** Upon critical failure or E-Stop trip, the machine transitions to `DE-ENERGIZED` state.
2. **Digital Lockout / Tagout:** Work orders enforce digital padlock pairing (e.g. `PADLOCK-PLANT-01`) tied to a verified technician ID.
3. **Zero-Energy Verification:** Technician confirms digital multimeter voltage ($0.0\text{ V}$) and hydraulic line pressure ($0.0\text{ PSI}$) before mechanical inspection begins.
4. **Controlled Re-Energization:** Resetting the E-Stop only clears the trip interlock. OSHA compliance mandates an explicit, authorized operator action (**"START PLANT POWER"**) to re-energize the 480V distribution bus.

---

## 4. Architectural Summary Matrix

| Capability | Technology | Protocol / Port | Primary Benefit in PlantOps |
|---|---|---|---|
| **Edge Ingestion** | Eclipse Mosquitto | MQTT (TCP:1883) | 100Hz real-time sensor streams with minimal edge bandwidth. |
| **Relational Data** | TiDB Cloud | MySQL (TCP:3307) | Distributed ACID ledger for Spares, ATP, POs, and Work Orders. |
| **Time-Series Data**| TimescaleDB | Postgres (TCP:5432) | Hypertables with instant `time_bucket` downsampling & 90% compression. |
| **Inter-Service Bus**| Redis | RESP (TCP:6379) | Sub-millisecond Pub/Sub messaging and distributed locks. |
| **Client Streaming**| WebSocket | WS/WSS (TCP:4000) | Live bi-directional event broadcast to React 3D Digital Twin. |
| **Vendor EDI** | EDI AS2 | HTTPS / S/MIME | Secure, automated PO dispatch to industrial distributors. |
| **Safety Governance**| OSHA 1910.147 | Digital LOTO API | Audited zero-energy verification and controlled re-energization. |
