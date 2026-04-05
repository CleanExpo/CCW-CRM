import { NextResponse } from "next/server";

const receivingQueue = [
  {
    id: "RCV-2041",
    supplier: "Bennett Logistics",
    container: "MSKU-4092",
    eta: "Today 2:30 PM",
    dock: "Dock 3",
    items: 48,
    status: "scheduled",
    priority: "high",
  },
  {
    id: "RCV-2038",
    supplier: "CleanTech Supplies",
    container: "OOLU-8812",
    eta: "Tomorrow 9:10 AM",
    dock: "Dock 1",
    items: 32,
    status: "in_progress",
    priority: "normal",
  },
  {
    id: "RCV-2033",
    supplier: "Pacific Restoration",
    container: "TGHU-2217",
    eta: "Tomorrow 1:45 PM",
    dock: "Dock 2",
    items: 21,
    status: "scheduled",
    priority: "low",
  },
];

const pickQueue = [
  {
    id: "PICK-8412",
    customer: "Metro Facility Services",
    zone: "BNE-02",
    lines: 12,
    promised: "Today 5:00 PM",
    status: "picking",
    priority: "rush",
  },
  {
    id: "PICK-8401",
    customer: "Aero Services Group",
    zone: "SYD-01",
    lines: 6,
    promised: "Today 4:00 PM",
    status: "queued",
    priority: "normal",
  },
  {
    id: "PICK-8396",
    customer: "Harbour Hospitality",
    zone: "BNE-01",
    lines: 9,
    promised: "Tomorrow 11:00 AM",
    status: "queued",
    priority: "normal",
  },
];

const returnsQueue = [
  {
    id: "RMA-4321",
    customer: "Sapphire Maintenance",
    reason: "Damaged on arrival",
    items: 2,
    sla: "Due in 4h",
    status: "inspection",
  },
  {
    id: "RMA-4316",
    customer: "Metro Facility Services",
    reason: "Warranty service",
    items: 1,
    sla: "Due tomorrow",
    status: "awaiting_parts",
  },
  {
    id: "SRV-1198",
    customer: "Aero Services Group",
    reason: "Motor replacement",
    items: 1,
    sla: "Due in 2d",
    status: "in_progress",
  },
];

const aiGuidance = [
  {
    title: "Rebalance BNE-02 picks",
    detail:
      "4 priority picks share the same zone. Recommend splitting to BNE-03 for faster throughput.",
    impact: "ETA risk reduced by 22%",
  },
  {
    title: "Inbound ETA risk",
    detail:
      "RCV-2041 has a 2h dock delay trend. Notify supplier and adjust labor plan.",
    impact: "Prevents overtime spike",
  },
  {
    title: "Return SLA breach",
    detail: "RMA-4321 is 4h from SLA. Assign QA to close inspection.",
    impact: "SLA compliance maintained",
  },
];

export async function GET() {
  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    metrics: {
      inboundToday: receivingQueue.length,
      inboundDocked: 2,
      inboundScheduled: 1,
      picksDueToday: pickQueue.length,
      rushPicks: 1,
      returnsOpen: returnsQueue.length,
      returnSlaRisk: 1,
      onTimeRate: 96,
    },
    receivingQueue,
    pickQueue,
    returnsQueue,
    aiGuidance,
  });
}
