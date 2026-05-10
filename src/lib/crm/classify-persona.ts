import type { Customer } from "@prisma/client";

/** Keys aligned with PERSONA_CONFIG in personas UI */
export type PersonaKey =
  | "high_value"
  | "equipment_buyer"
  | "consumables"
  | "contractor"
  | "new_account"
  | "dormant"
  | "unclassified";

export interface PersonaClassification {
  persona: PersonaKey;
  confidence: "high" | "medium" | "low";
  reason: string;
}

/** Minimal order shape for classification (map from Prisma + includes). */
export interface OrderInputForPersona {
  status: string;
  createdAt: Date;
  total: number;
  lineItems: Array<{
    quantity: number;
    lineTotal: number;
    product: { name: string; category: string | null };
  }>;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Deterministic persona from order history + customer metadata.
 */
export function classifyCustomerPersona(
  customer: Pick<Customer, "createdAt">,
  orders: OrderInputForPersona[],
): PersonaClassification {
  const now = new Date();
  const accountAgeDays = Math.max(0, daysBetween(customer.createdAt, now));

  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const orderCount = activeOrders.length;

  let lifetimeSpend = 0;
  let totalLines = 0;
  let consumableLines = 0;
  let equipmentSpend = 0;
  let equipmentUnits = 0;
  let maxSingleOrder = 0;

  for (const o of activeOrders) {
    const orderTotal = o.total;
    lifetimeSpend += orderTotal;
    maxSingleOrder = Math.max(maxSingleOrder, orderTotal);

    for (const li of o.lineItems) {
      totalLines++;
      const cat = (li.product.category ?? "").toLowerCase();
      const name = li.product.name.toLowerCase();
      const isConsumable =
        cat.includes("consum") ||
        cat.includes("supply") ||
        cat.includes("media") ||
        cat.includes("ink") ||
        cat.includes("toner") ||
        name.includes("consum") ||
        name.includes("toner") ||
        name.includes("ink");

      if (isConsumable) consumableLines++;

      const isEquipment =
        cat.includes("equipment") ||
        cat.includes("printer") ||
        cat.includes("machine") ||
        cat.includes("plotter") ||
        name.includes("printer") ||
        name.includes("plotter") ||
        name.includes("cutter");

      const lineTotal = li.lineTotal;
      if (isEquipment) {
        equipmentSpend += lineTotal;
        equipmentUnits += li.quantity;
      }
    }
  }

  const avgOrderValue = orderCount > 0 ? lifetimeSpend / orderCount : 0;
  const consumableRatio =
    totalLines > 0 ? consumableLines / totalLines : 0;

  let lastOrderDays = Infinity;
  if (activeOrders.length > 0) {
    const latest = activeOrders.reduce(
      (acc, o) => (o.createdAt > acc ? o.createdAt : acc),
      activeOrders[0].createdAt,
    );
    lastOrderDays = daysBetween(latest, now);
  }

  if (orderCount === 0 && accountAgeDays <= 30) {
    return {
      persona: "new_account",
      confidence: "medium",
      reason: `No orders yet; account created ${accountAgeDays} days ago.`,
    };
  }

  if (orderCount > 0 && lastOrderDays > 90) {
    return {
      persona: "dormant",
      confidence: "high",
      reason: `Last order ${lastOrderDays} days ago (${orderCount} historical orders).`,
    };
  }

  if (lifetimeSpend >= 10000 || maxSingleOrder >= 5000) {
    return {
      persona: "high_value",
      confidence: "high",
      reason: `Lifetime spend $${lifetimeSpend.toFixed(0)}; largest single order $${maxSingleOrder.toFixed(0)}.`,
    };
  }

  if (equipmentSpend >= 5000 || equipmentUnits >= 3) {
    return {
      persona: "equipment_buyer",
      confidence: equipmentSpend >= 10000 ? "high" : "medium",
      reason: `Equipment-heavy purchases (~$${equipmentSpend.toFixed(0)} across flagged lines).`,
    };
  }

  if (orderCount >= 3 && consumableRatio >= 0.55) {
    return {
      persona: "consumables",
      confidence: "medium",
      reason: `${Math.round(consumableRatio * 100)}% of line items look like supplies/consumables.`,
    };
  }

  if (orderCount >= 4 && avgOrderValue < 800 && lifetimeSpend < 15000) {
    return {
      persona: "contractor",
      confidence: "medium",
      reason: `Frequent smaller orders (avg $${avgOrderValue.toFixed(0)} over ${orderCount} orders).`,
    };
  }

  if (orderCount === 0) {
    return {
      persona: "unclassified",
      confidence: "low",
      reason: "No completed order history to classify.",
    };
  }

  return {
    persona: "unclassified",
    confidence: "low",
    reason: "Purchase pattern does not match a strong persona yet.",
  };
}
