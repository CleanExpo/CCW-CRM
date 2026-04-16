# Workshop Technician Quick-Start Guide

**Time to Complete**: 30 minutes
**Role**: Workshop Technician / Service Coordinator
**Daily Modules**: Workshop Dashboard, Equipment, Schedule, Templates, Reminders

---

## Your Daily Workflow

```
1. Check Workshop Dashboard (due today, overdue, reminders)
2. Review today's Schedule
3. Update booking status (in progress, completed)
4. Log service history on equipment
5. Check service reminders for upcoming due dates
6. Create new bookings or add new equipment as needed
```

---

## Step 1: Finding the Workshop Menu (3 min)

### Workshop section in the sidebar

The Workshop module lives in its own section of the left sidebar. Look for the **Wrench** icon labelled "Workshop". Under it you will find:

- **Workshop** (dashboard) → `/workshop`
- **Equipment** → `/workshop/equipment`
- **Schedule** → `/workshop/schedule`
- **Templates** → `/workshop/templates`
- **Reminders** → `/workshop/reminders`

### Workshop Dashboard overview

Navigate to `/workshop`. The dashboard shows:

- **Location filter tabs** — All Locations / Brisbane / Sydney / Melbourne
- **Upcoming bookings** — jobs scheduled for today and the next 7 days
- **Overdue services** — equipment past its scheduled service date
- **Active reminders** — reminder notifications due or past due
- **Quick link**: "View Schedule" button (top right) → opens `/workshop/schedule`

---

## Step 2: Adding Equipment (7 min)

Equipment records track every machine that your workshop services.

### View existing equipment

1. Navigate to `/workshop/equipment`
2. The list shows all registered equipment with: name, serial number, customer, last service date, next service due
3. Use the search bar to find by serial number or customer name

### Add new equipment

1. On `/workshop/equipment`, click **+ Add Equipment**
2. Fill in the equipment form:
   - **Equipment Name** — e.g. "Prochem Truckmount TM500"
   - **Serial Number** — unique identifier (required)
   - **Customer** — search and select the customer who owns/operates it
   - **Product** — optionally link to the product in your catalogue
   - **Purchase Date** — when the equipment was sold or registered
   - **Location** — which workshop location services this unit
   - **Service Interval (km)** — distance-based service trigger (leave blank if not applicable)
   - **Service Interval (days)** — time-based service trigger (e.g. 90 for quarterly)
3. Click **Save Equipment**

### View an equipment record

Click the **equipment name** or the **Eye** icon on any row to open the full record at `/workshop/equipment/[id]`.
The detail page shows:

- Equipment specifications
- Full service history (all past bookings)
- Upcoming scheduled services
- Attached reminders

**How the dual-interval scheduler works**: The system uses whichever trigger comes first — if a machine needs service every 90 days OR every 500 km (whichever is sooner), enter both values. The system computes the next service date automatically and creates a reminder when it is due.

---

## Step 3: Creating a Service Booking (10 min)

A service booking represents a job in the workshop — whether routine maintenance, repair, or inspection.

### Create a booking from the Schedule

1. Navigate to `/workshop/schedule`
2. Click **+ New Booking**
3. Fill in the booking form:
   - **Equipment** — search and select the equipment being serviced
   - **Service Template** — optional; select a template to pre-fill job items (see Step 5)
   - **Scheduled Date** — date the service is to be performed
   - **Technician** — assign to a staff member (optional)
   - **Location** — which workshop
   - **Notes** — customer complaints, special instructions

### Booking statuses

| Status      | Meaning                                |
| ----------- | -------------------------------------- |
| Scheduled   | Booked, not yet started                |
| Confirmed   | Customer / job confirmed               |
| In Progress | Technician actively working            |
| Completed   | Service finished, ready for collection |
| Cancelled   | Job cancelled                          |
| No Show     | Customer did not bring equipment in    |

### Update a booking status

1. On `/workshop/schedule`, find the booking
2. Click the booking row to open it
3. Click the status badge to change it (e.g. Scheduled → In Progress → Completed)
4. Add completion notes when marking as Completed

---

## Step 4: Logging Service History (5 min)

Service history is automatically created when a booking is marked **Completed**. You can also log history manually for work done outside the booking system.

### How history is recorded automatically

When you change a booking status to **Completed**:

1. A service history entry is created on the equipment record
2. The "Last Service Date" on the equipment updates
3. The "Next Service Due" is recalculated based on the service intervals

### Log a manual history entry

1. Navigate to `/workshop/equipment/[id]` (the equipment detail page)
2. Scroll to the **Service History** section
3. Click **Add History Entry**
4. Fill in:
   - **Service Date**
   - **Service Type** — Routine / Repair / Inspection / Warranty
   - **Work Performed** — description of what was done
   - **Parts Used** (optional)
   - **Technician**
5. Click **Save**

This is useful for recording warranty work, field service, or services performed before the system was in use.

---

## Step 5: Checking Service Reminders (3 min)

### Reminders dashboard

1. Navigate to `/workshop/reminders`
2. Reminders are listed by urgency:
   - **Overdue** (red) — service was due in the past
   - **Due Soon** (amber) — due within the next 14 days
   - **Upcoming** (green) — due within the next 30 days
3. Each reminder shows: equipment name, customer, due date, and reminder type

### Dismiss or action a reminder

- Click **Dismiss** to acknowledge and close a reminder (does not delete — creates a dismissed record)
- Click **Create Booking** on a reminder to jump straight to a new booking form pre-filled with that equipment

### Automatic reminder generation

The system automatically generates reminders based on the service intervals set on each equipment record. You do not need to create reminders manually — they appear when the due date approaches.

---

## Step 6: Using Service Templates (2 min)

Service templates define the standard checklist for common job types — so technicians do not need to remember every step.

### View templates

1. Navigate to `/workshop/templates`
2. Templates are listed with their job type and item count

### Create a template

1. Click **+ New Template**
2. Enter the template name (e.g. "Annual Truckmount Service") and description
3. Add **Template Items** — each item is a checklist step:
   - Step name (e.g. "Replace water filters")
   - Estimated time (minutes)
   - Required (yes/no)
4. Click **Save Template**

### Use a template in a booking

When creating a booking (Step 3), select the template in the **Service Template** dropdown. All template items are added to the booking as a checklist that the technician ticks off during the job.

---

## Quick Reference

| Task                  | Where                      | Action                          |
| --------------------- | -------------------------- | ------------------------------- |
| Workshop dashboard    | `/workshop`                | Sidebar: Workshop               |
| Equipment list        | `/workshop/equipment`      | Sidebar: Equipment              |
| Equipment detail      | `/workshop/equipment/[id]` | Click equipment name            |
| New equipment         | `/workshop/equipment`      | + Add Equipment                 |
| Schedule / bookings   | `/workshop/schedule`       | Sidebar: Schedule               |
| New booking           | `/workshop/schedule`       | + New Booking                   |
| Service reminders     | `/workshop/reminders`      | Sidebar: Reminders              |
| Service templates     | `/workshop/templates`      | Sidebar: Templates              |
| Update booking status | `/workshop/schedule`       | Click row → change status badge |
| Log service history   | `/workshop/equipment/[id]` | Add History Entry               |

---

## AI Features for Workshop Technicians

| Feature       | Location                            | How to use                                                                                                            |
| ------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| AI Assistant  | `/ai-assistant`                     | "List all equipment overdue for service at Brisbane" or "What parts are typically needed for a TM500 annual service?" |
| Staff Copilot | Available via Customer Service team | Assists with customer communication about service status                                                              |

**Pro tip**: When adding a new piece of equipment, use the AI Assistant to ask for the manufacturer's recommended service intervals. Paste the answer directly into the service interval fields to set up correct reminders from day one.
