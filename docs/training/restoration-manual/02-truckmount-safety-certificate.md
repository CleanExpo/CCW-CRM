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

## 2. Regulatory map by domain

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

### Domain B — Gas (LPG-fired units)

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

### Domain F — Dangerous goods / chemicals carried onboard

| Reference | Governs | Source |
|---|---|---|
| **ADG Code (Edition 7.9)** | If onboard cleaning chemicals are dangerous goods **above placard/exemption quantities**: packaging, segregation, marking, documentation. Most small onboard loads fall **under** DG thresholds (limited-quantity exemptions) — **assess against the actual products** | ntc.gov.au |
| **SDS obligations (WHS Regs, GHS)** | Current Safety Data Sheet held for every hazardous chemical; GHS labelling — applies regardless of DG transport threshold | safeworkaustralia.gov.au |

### Industry bodies (credibility layer, not statutory)

**IICRC** certifies operators/methods/firms (S100 carpet cleaning, S500 water damage) — a
credibility layer, **not** a machine/vehicle safety authority. **RIA** is a US trade
association with **no Australian statutory role**. No industry body certifies truck-mount
vehicle/gas/electrical safety — that is why this certificate binds the statutory sign-offs.

---

## 3. Why the certificate is structured as a compliance dossier

No single body certifies the whole unit, so a credible certificate **binds together the
separate licensed sign-offs** into one dossier. Each section is signed by whoever is
legally competent to sign it. The manufacturer signs the design/WHS/pressure/DG sections;
the vehicle signatory, gasfitter and electrician sign theirs. This is honest, defensible,
and matches how Australian law actually allocates the duties.

---

## 4. Certificate template (complete one per unit)

> Copy this block into the issued certificate. Delete rows that do not apply (e.g. gas
> rows for a non-gas unit). Do not issue until every **⚠ CONFIRM** item is resolved and
> every required licensed signatory has signed.

---

### CERTIFIED MANUFACTURER'S TRUCK-MOUNT SAFETY CERTIFICATE

**Issued by (manufacturer/supplier):** Carpet Cleaners Warehouse
**Certificate no.:** __________  **Date of issue:** __________

**Section 1 — Unit & vehicle identification**
- Truck-mount make / model / serial: __________
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

**Section 4 — Gas installation & appliance** *(gas/LPG units only)*
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

**Section 8 — Dangerous goods / chemicals**
- Onboard chemical DG threshold assessed (ADG 7.9): ☐ Under threshold ☐ ADG controls applied
- Current SDS register + GHS labelling: ☐ Confirmed
- *Signed (manufacturer / operator):* __________

**Section 9 — Residual operator duties (ongoing, not discharged by this certificate)**
- In-service test-and-tag (AS/NZS 3760), periodic gas/electrical re-inspection, load
  restraint on every trip, and mass compliance when loaded remain the **operator's**
  ongoing responsibility.
- *Acknowledged by operator:* __________

---

## 5. Before issuing — confirmation checklist

Resolve every **⚠ CONFIRM** item with the named primary authority or licensed
practitioner first:

- [ ] Exact VSB14 / QRVM modification code(s) — nominated by the vehicle signatory
- [ ] AS/NZS 3001 vehicle-electrical current designation — confirmed with the electrician
- [ ] AS/NZS 5601.1 vs 5601.2 applicability — determined by the gasfitter
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
