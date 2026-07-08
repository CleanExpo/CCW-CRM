# Module 02 — Manufacturer's Truck-Mount Safety Certificate (Australia)

**Part of:** CCW Restoration Training Manual
**Audience:** CCW as manufacturer/supplier of truck-mount systems; installers; and operators
who need to understand the compliance basis of a mounted unit.
**Status:** Framework + ready-to-complete certificate template.

> **Important.** There is **no accredited Australian "truck-mount certification scheme.**"
> Compliance is assembled from the separate vehicle, gas, electrical, pressure and WHS
> regimes below. This certificate is therefore a **manufacturer's compliance declaration
> that references the underlying statutory sign-offs** — not a third-party accreditation.
> Three of those sign-offs (vehicle-modification signatory, licensed gasfitter, licensed
> electrician) **cannot be self-certified by the manufacturer** and must be completed by
> the licensed practitioner. Items marked **⚠ CONFIRM** below must be verified against the
> named authority before a certificate is issued.

---

## 1. The two questions that drive everything

Before any standard applies, resolve these two determinations for the specific unit and
host vehicle. They decide which rules bind.

### 1a. GVM band — light vehicle or heavy vehicle?

Australian obligations split sharply on **Gross Vehicle Mass (GVM)**:

- **≤ 4.5 t GVM** (most vans/utes) → **light vehicle**. Modifications certified under the
  relevant **state light-vehicle scheme** against **VSB14 (National Code of Practice for
  Light Vehicle Construction and Modification, "NCOP")**.
- **> 4.5 t GVM** (trucks) → **heavy vehicle**. Modifications regulated by the **National
  Heavy Vehicle Regulator (NHVR)**, certified by an **Approved Vehicle Examiner (AVE)**
  against **VSB6 (National Code of Practice for Heavy Vehicle Modifications)**.

> **Terminology correction:** VSB6 is the **heavy**-vehicle code, and **VSB14** is the
> **light**-vehicle code. These are commonly confused — the certificate must cite whichever
> matches the host vehicle's GVM.

### 1b. Load or modification?

The single most important legal question for a slide-in unit:

- **Restrained cargo (genuinely slide-in / removable):** sits in the tray or van, held by
  rated tie-downs, not structurally bolted or hard-plumbed. Governed by the **Load
  Restraint Guide** — **no modification plate required**, but the unit's mass must fit
  within GVM and axle limits.
- **Permanent modification (bolted to chassis/body, hard-plumbed gas/water, fixed tanks):**
  affects mass and mass distribution → **requires engineering certification (modification
  plate) under the light- or heavy-vehicle scheme.**

An uncertified permanent install can render the vehicle **unregistered / unroadworthy and
void insurance.** This determination must be stated explicitly on the certificate, and for
a permanent install must be ruled on by the vehicle signatory before anything else.

**The most common real-world failure point:** full water tanks + fuel + occupants pushing
the loaded vehicle over its **GVM or axle-group mass limits.** Always compute loaded mass
per vehicle — never assume.

---

## 2. Brands, models and heat-source architecture

CCW's truck-mount range is built around two primary manufacturer families — **HydraMaster**
and **Sapphire Scientific**. Getting the certificate right starts with identifying the
unit's **power and heat architecture**, because that decides which compliance domains
actually bite.

### 2a. Corporate note (state accurately)

- **Sapphire Scientific** and **Dri-Eaz** are **Legend Brands** companies — the same parent
  as the Dri-Eaz dehumidifier referenced in Module 01. (Confirmed: Legend Brands' portfolio
  includes Dri-Eaz, Sapphire Scientific, Prochem, Chemspec, ODORx, Unsmoke.)
- **HydraMaster** operates under **Universal Cleaning Concepts LLC** per its own current
  corporate/copyright statements. It shares deep industry lineage with the Legend Brands
  cleaning line but should **not** be described as a current Legend Brands company on a
  formal certificate. State the manufacturer entity as it appears on the unit.

### 2b. The compliance-critical distinction: how the unit makes heat and power

Verified across the current HydraMaster and Sapphire Scientific ranges, mainstream units
fall into two architectures — **and neither is a gas-fired appliance**:

| Architecture | Example models | Power | Heat | What this means for compliance |
|---|---|---|---|---|
| **Direct-drive / engine-heat** (host-vehicle powered) | HydraMaster **CDS xDrive** (Thermal Accumulation Heating System) | Runs off the **host vehicle engine** — no separate engine | Recovered from the **vehicle engine** (thermal exchange), no burner | Vehicle-modification and WHS dominate; **no gas appliance**; no separate fuel store beyond the vehicle's own tank |
| **Onboard-engine slide-in** | HydraMaster **Boxxer 318HP** (18 HP air-cooled), **Boxxer XL** (31 HP Briggs & Stratton), **TMTG4000** (23 HP Vanguard); Sapphire Scientific **370SS** (23 HP Kohler, 3000 RPM in the AU spec), **370EFI** (liquid-cooled Kubota 4-cyl) | Own **petrol** engine (EFI models are fuel-injected) | Recovered from the **engine exhaust** via a **stainless finned-tube heat exchanger** | Adds **petrol fuel storage** (flammable liquid) and **engine exhaust / CO in the enclosed van** as the salient hazards; heat exchanger assessed under pressure rules (AS 4343), **not** gas rules |

Typical operating envelope for these units: solution pressure to ~**1,500 psi**, single- or
multi-stage **finned-tube (stainless) heat exchanger**, high heat (93 °C+ / 200 °F+).

> **Key correction to the generic framework:** because standard HydraMaster and Sapphire
> Scientific units take heat from the **engine exhaust**, not a **fuel-gas burner**, the
> **gas domain (AS/NZS 5601 / 1596 / appliance certification) generally does NOT apply**.
> It applies **only** if a specific unit is fitted with a **gas-fired auxiliary heater**
> (uncommon in this range). For the mainstream engine-heat units the salient hazards are
> **petrol fuel handling, engine exhaust / CO extraction from an enclosed vehicle, the
> finned-tube heat exchanger (pressure), noise, and the vehicle modification.**

## 3. Regulatory map by domain

Each row: what governs a truck-mount, the issuing body, and an official source. Standard
editions current as at the 2026 research pass; always work to the current published
edition.

### Domain A — Vehicle & road ("Main Roads")

| Reference | Governs | Source |
|---|---|---|
| **Australian Design Rules (ADRs)** under the Road Vehicle Standards Act 2018 | Base vehicle must stay ADR-compliant post-install (braking, mass, lighting, emissions, occupant protection) | infrastructure.gov.au — vehicle design regulation |
| **VSB14 / NCOP** (light ≤4.5 t) | Technical requirements for modifying a light vehicle: mass/loading, GVM, body/structural mounting | infrastructure.gov.au — NCOP bulletins |
| **VSB6** (heavy >4.5 t) | Standard AVEs use to approve heavy-vehicle modifications | nhvr.gov.au — VSB6 |
| **NHVR + Approved Vehicle Examiners (AVEs)** | Regulator and signatory for heavy-vehicle mods (issues heavy mod plate) | nhvr.gov.au — heavy vehicle modifications |
| **Load Restraint Guide 2018** (heavy) / **Load Restraint Guide for Light Vehicles 2018** (NTC) | Restraint of a slide-in treated as cargo | nhvr.gov.au / ntc.gov.au |
| **GVM/GCM & axle mass limits** | Loaded unit + water + fuel + occupants must stay within limits | nhvr.gov.au — mass, dimension & loading |

**State modification sign-off (the "Main Roads" certificate):**

| State | Scheme | Signatory | Authority |
|---|---|---|---|
| QLD | Approved Person Scheme (QRVM codes) | Approved Person | Transport and Main Roads (TMR) |
| NSW | Vehicle Safety Compliance Certification Scheme (VSCCS) | Licensed Certifier | Transport for NSW |
| VIC | Vehicle Assessment Signatory Scheme (VASS) | VASS Signatory | Dept of Transport and Planning |
| SA / WA / TAS / NT / ACT | Equivalent state schemes (VASS certificates are commonly recognised for light vehicles) — **⚠ CONFIRM per state** | Varies | State transport authority |

> **⚠ CONFIRM:** the **exact VSB14 / QRVM modification code(s)** applicable to a permanently
> mounted equipment module and its mass effect is a **signatory determination** — the
> certifying signatory nominates the applicable code(s). Do not pre-print a code.

### Domain B — Gas (⚠ ONLY if a gas-fired auxiliary heater is fitted)

> **Applies only to gas-fired configurations.** Mainstream HydraMaster / Sapphire
> Scientific units are **engine-heat** (see §2b) and this whole domain is **N/A** for them.
> Complete it only where a gas-fired auxiliary heater is actually installed.

| Reference | Governs | Source |
|---|---|---|
| **AS/NZS 5601.1** Gas installations — general | Design/install/commission of the fuel-gas system feeding the fired heat exchanger | store.standards.org.au |
| **AS/NZS 5601.2** LP Gas in caravans/boats (non-propulsive) — **⚠ CONFIRM applicability** | Possible boundary standard for in-vehicle LP Gas; a licensed gasfitter determines whether .1 or .2 governs | standards.org.au |
| **AS/NZS 1596** Storage & handling of LP Gas | LPG **cylinder** mounting, location, impact/fire protection, ventilation | store.standards.org.au |
| **Gas appliance certification** (AS/NZS 5263 series; GTRC listing) — **⚠ CONFIRM exact part** | The fired heat exchanger is a **gas appliance** — usually must be type-certified by a recognised Conformity Assessment Body and listed on the GTRC database before a gasfitter may connect it | gtrc.gov.au |

**Sign-off:** a **licensed gasfitter** installs and certifies the gas installation; the
appliance must hold current certification. **The manufacturer cannot self-certify the gas
installation.**

### Domain C — Electrical (onboard generator / 230 V system)

| Reference | Governs | Source |
|---|---|---|
| **AS/NZS 3000** (Wiring Rules) | Fixed onboard 230/400 V installation fed by generator/inverter | store.standards.org.au |
| **AS/NZS 3001** Electrical installations — transportable structures and vehicles — **⚠ CONFIRM current designation** | Likely the most directly applicable *vehicle* installation standard; confirm with a licensed electrician | standards.org.au |
| **AS/NZS 3760** In-service inspection & testing | Periodic test-and-tag of plug-in leads/tools (ongoing operator duty) | store.standards.org.au |
| **RCD protection** (within AS/NZS 3000) | 30 mA RCD on socket-outlets/final subcircuits — critical in wet carpet-cleaning work | AS/NZS 3000 |

**Sign-off:** a **licensed electrician** installs and certifies the fixed electrical
installation (Certificate of Electrical Safety / state equivalent). **Not
self-certifiable by the manufacturer.**

### Domain D — Pressure / mechanical

| Reference | Governs | Source |
|---|---|---|
| **AS 4343** Pressure equipment — hazard levels | Hazard-level (A–E) calculation for the heat exchanger from pressure × volume × fluid; drives whether design/item **registration** with the state WHS regulator is required | store.standards.org.au |
| **AS 1210** Pressure vessels | Design/construction/testing if a component is a pressure vessel | standards.org.au |
| **Model WHS Regs — plant registration** | Ties hazard level to registration duty | safeworkaustralia.gov.au |

**Practical read:** a fired heat-exchange coil is typically small-volume and usually
computes to **Hazard Level D or E** (little/no registration) — but this **must be
calculated per AS 4343 for the specific unit**, not assumed. Rotating plant (blower, pump,
engine, belts) must be **guarded** per WHS plant duties.

### Domain E — Work Health & Safety (the legal spine of the certificate)

| Reference | Governs | Source |
|---|---|---|
| **Model WHS Act — duties of designers / manufacturers / importers / suppliers / installers of plant** (approx. s22–s26 — **⚠ CONFIRM section numbers**) | Core manufacturer/supplier duty: ensure plant is without risk so far as reasonably practicable, test as necessary, provide safety information | safeworkaustralia.gov.au — model WHS laws |
| **Model WHS Regulations — Chapter 5 (Plant and structures)** | Guarding, controls, risk control, plant registration, information provision | safeworkaustralia.gov.au |
| **AS/NZS 1269 series** + Managing Noise Code of Practice | Blower/engine noise; exposure standard 85 dB(A) L_Aeq,8h / 140 dB(C) peak | safeworkaustralia.gov.au |
| **Workplace Exposure Standards — carbon monoxide** | **Exhaust/CO in an enclosed van** is a real design hazard: prevent CO accumulation in the operator/cabin space (exhaust routing, ventilation, CO alarm as a control) | safeworkaustralia.gov.au |

### Domain F — Fuel, dangerous goods & chemicals carried onboard

| Reference | Governs | Source |
|---|---|---|
| **Petrol / flammable-liquid fuel storage** (onboard-engine models) | Onboard-engine HydraMaster/Sapphire units carry **petrol** — the fuel tank/lines must be safely mounted, vented and protected from ignition and impact; combined with the engine-exhaust/CO control in Domain E this is the dominant hazard on engine-heat units | AS 1940 (storage & handling of flammable & combustible liquids) — **⚠ CONFIRM applicability of onboard quantities**; safeworkaustralia.gov.au |
| **ADG Code (Edition 7.9)** | If onboard cleaning chemicals are dangerous goods **above placard/exemption quantities**: packaging, segregation, marking, documentation. Most small onboard loads fall **under** DG thresholds (limited-quantity exemptions) — **assess against the actual products** | ntc.gov.au |
| **SDS obligations (WHS Regs, GHS)** | Current Safety Data Sheet held for every hazardous chemical; GHS labelling — applies regardless of DG transport threshold | safeworkaustralia.gov.au |

### Industry bodies (credibility layer, not statutory)

**IICRC** certifies operators/methods/firms (S100 carpet cleaning, S500 water damage) — a
credibility layer, **not** a machine/vehicle safety authority. **RIA** is a US trade
association with **no Australian statutory role**. No industry body certifies truck-mount
vehicle/gas/electrical safety — that is why this certificate binds the statutory sign-offs.

---

## 4. Why the certificate is structured as a compliance dossier

No single body certifies the whole unit, so a credible certificate **binds together the
separate licensed sign-offs** into one dossier. Each section is signed by whoever is
legally competent to sign it. The manufacturer signs the design/WHS/pressure/DG sections;
the vehicle signatory, gasfitter and electrician sign theirs. This is honest, defensible,
and matches how Australian law actually allocates the duties.

---

## 5. Certificate template (complete one per unit)

> Copy this block into the issued certificate. Delete rows that do not apply (e.g. gas
> rows for a non-gas unit). Do not issue until every **⚠ CONFIRM** item is resolved and
> every required licensed signatory has signed.

---

### CERTIFIED MANUFACTURER'S TRUCK-MOUNT SAFETY CERTIFICATE

**Issued by (manufacturer/supplier):** Carpet Cleaners Warehouse
**Certificate no.:** __________  **Date of issue:** __________

**Section 1 — Unit & vehicle identification**
- Truck-mount make / model / serial: __________ (e.g. HydraMaster Boxxer 318HP / CDS xDrive; Sapphire Scientific 370SS / 370EFI)
- Manufacturer entity as marked on unit: __________ (e.g. Universal Cleaning Concepts LLC for HydraMaster; Legend Brands for Sapphire Scientific)
- **Power/heat architecture:** ☐ Direct-drive / engine-heat (host vehicle) ☐ Onboard petrol engine + finned-tube exchanger ☐ Gas-fired auxiliary heat fitted
- Host vehicle make / model / VIN: __________
- Vehicle **GVM**: ______ t  → **Band:** ☐ Light (≤4.5 t) ☐ Heavy (>4.5 t)
- Tare / kerb mass: ______  Loaded mass (unit + full water + fuel + occupants): ______
- **Within GVM & axle-group limits?** ☐ Yes ☐ No — computed value: __________

**Section 2 — Load-vs-modification determination**
- This installation is: ☐ Restrained cargo (Load Restraint Guide) ☐ Permanent modification (mod plate required)
- Basis for determination: __________
- *Manufacturer signature:* __________  *Vehicle signatory concurrence (if permanent):* __________

**Section 3 — Vehicle modification / engineering certificate** *(permanent installs)*
- Scheme: ☐ QLD Approved Person ☐ NSW VSCCS ☐ VIC VASS ☐ NHVR AVE (heavy) ☐ Other: ____
- Applicable VSB14 (light) / VSB6 (heavy) code(s), as nominated by the signatory: __________
- ADRs not degraded by the modification: ☐ Confirmed
- Modification plate no.: __________
- *Licensed vehicle signatory (name / licence no. / signature):* __________

**Section 4 — Gas installation & appliance** *(⚠ ONLY if gas-fired auxiliary heat fitted — N/A for standard engine-heat HydraMaster/Sapphire units)*
- ☐ N/A — unit is engine-heat, no gas appliance
- Gas installation to **AS/NZS 5601.1** (or .2 if determined): ☐ Confirmed
- Fired appliance certification / GTRC listing ref: __________
- LPG cylinder mounting to **AS/NZS 1596**: ☐ Confirmed
- *Licensed gasfitter (name / licence no. / signature):* __________

**Section 5 — Electrical installation** *(onboard 230 V units)*
- Fixed installation to **AS/NZS 3000** (and **AS/NZS 3001** vehicle installation): ☐ Confirmed
- 30 mA RCD protection on socket-outlets: ☐ Confirmed
- Certificate of Electrical Safety no.: __________
- *Licensed electrician (name / licence no. / signature):* __________

**Section 6 — Pressure equipment**
- **AS 4343** hazard-level calculation for heat exchanger: Level ____ (A/B/C = register; D = design only; E = neither)
- **AS 1210** conformance if a pressure vessel: ☐ N/A ☐ Confirmed  Registration status: __________
- *Signed (manufacturer / competent pressure engineer):* __________

**Section 7 — WHS plant safety & design declaration**
- Model WHS Act designer/manufacturer/supplier duty discharged (plant without risk SFARP; safety information provided): ☐ Confirmed
- Rotating plant (blower, pump, engine, belts) guarded: ☐ Confirmed
- Noise data (AS/NZS 1269) provided: ______ dB(A)
- **CO/exhaust control** in enclosed vehicle (exhaust routing / ventilation / CO alarm): ☐ Confirmed
- Operating & safety manual supplied to operator: ☐ Confirmed
- *Manufacturer signature:* __________

**Section 8 — Fuel, dangerous goods & chemicals**
- Petrol fuel tank/lines safely mounted, vented, impact/ignition protected (onboard-engine units): ☐ N/A ☐ Confirmed
- Onboard chemical DG threshold assessed (ADG 7.9): ☐ Under threshold ☐ ADG controls applied
- Current SDS register + GHS labelling: ☐ Confirmed
- *Signed (manufacturer / operator):* __________

**Section 9 — Residual operator duties (ongoing, not discharged by this certificate)**
- In-service test-and-tag (AS/NZS 3760), periodic gas/electrical re-inspection, load
  restraint on every trip, and mass compliance when loaded remain the **operator's**
  ongoing responsibility.
- *Acknowledged by operator:* __________

---

## 6. Before issuing — confirmation checklist

Resolve every **⚠ CONFIRM** item with the named primary authority or licensed
practitioner first:

- [ ] Exact VSB14 / QRVM modification code(s) — nominated by the vehicle signatory
- [ ] AS/NZS 3001 vehicle-electrical current designation — confirmed with the electrician
- [ ] AS/NZS 5601.1 vs 5601.2 applicability — determined by the gasfitter (**only if a gas-fired heater is fitted**)
- [ ] AS 1940 flammable-liquid applicability to onboard petrol quantities — confirmed for engine-heat units
- [ ] Model WHS Act section numbers for manufacturer/supplier duties — confirmed against the model Act text
- [ ] Specific AS/NZS 5263 appliance-standard part + certification pathway — confirmed with a Conformity Assessment Body
- [ ] Per-state modification schemes beyond QLD/NSW/VIC — confirmed with each authority
- [ ] ADG threshold applicability for the specific onboard chemicals — assessed per load

---

*Sources: infrastructure.gov.au (ADRs/NCOP), nhvr.gov.au (VSB6/AVE/mass/load restraint),
ntc.gov.au (Load Restraint Guide light / ADG Code), store.standards.org.au (AS/NZS 5601,
1596, 3000, 3001, 3760, 4343, 1210, 1269), gtrc.gov.au (gas appliance certification),
safeworkaustralia.gov.au (model WHS Act & Regs, noise, WES), tmr.qld.gov.au /
transport.nsw.gov.au / transport.vic.gov.au (state modification schemes), iicrc.org.
Framework material — not legal advice. Confirm ⚠ items before issuing any certificate.*
