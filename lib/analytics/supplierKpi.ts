import type { OrderItem, OrderWithItems } from "../orders/types";

export type SupplierClass = "A" | "B" | "C" | "D";
export type SupplierTrendDirection = "up" | "down" | "flat";

export type SupplierPeriodMetrics = {
  totalOrders: number;
  totalLines: number;
  deliveredLines: number;
  canceledLines: number;
  overdueLinesCurrent: number;
  deliveredOnTimeLines: number;
  deliveredLateLines: number;
  averageLeadTime: number;
  averageDelay: number;
  onTimeDelivery: number;
  fillRate: number;
  refusalRate: number;
  communicationScore: number;
};

export type SupplierScoreBreakdown = {
  onTimeDeliveryScore: number;
  fillRateScore: number;
  refusalScore: number;
  leadTimeScore: number;
  communicationScore: number;
  total: number;
};

export type SupplierPeriodComparison = {
  current: number;
  previous: number;
  delta: number;
  direction: SupplierTrendDirection;
};

function normalizeDate(value: string | null | undefined) {
  return (value || "").slice(0, 10);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function roundMetric(value: number, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function diffDays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isDelivered(item: OrderItem) {
  return item.status === "Поставлен" || !!item.delivered_date;
}

function isCanceled(item: OrderItem) {
  return item.status === "Отменен" || !!item.canceled_date;
}

export function calculateOnTimeDelivery(params: {
  deliveredLines: number;
  deliveredOnTimeLines: number;
}) {
  const { deliveredLines, deliveredOnTimeLines } = params;
  if (!deliveredLines) return 0;
  return clampPercent((deliveredOnTimeLines / deliveredLines) * 100);
}

export function calculateFillRate(params: {
  totalLines: number;
  deliveredLines: number;
}) {
  const { totalLines, deliveredLines } = params;
  if (!totalLines) return 0;
  return clampPercent((deliveredLines / totalLines) * 100);
}

export function calculateRefusalRate(params: {
  totalLines: number;
  canceledLines: number;
}) {
  const { totalLines, canceledLines } = params;
  if (!totalLines) return 0;
  return clampPercent((canceledLines / totalLines) * 100);
}

export function calculateAverageLeadTime(leadTimeSamples: number[]) {
  return roundMetric(average(leadTimeSamples));
}

export function calculateAverageDelay(delaySamples: number[]) {
  return roundMetric(average(delaySamples));
}

function calculateLeadTimeScore(averageLeadTime: number) {
  if (!averageLeadTime) return 100;
  if (averageLeadTime <= 3) return 100;
  if (averageLeadTime <= 5) return 92;
  if (averageLeadTime <= 7) return 84;
  if (averageLeadTime <= 10) return 72;
  return Math.max(20, 72 - (averageLeadTime - 10) * 4);
}

export function calculateSupplierScore(params: {
  onTimeDelivery: number;
  fillRate: number;
  refusalRate: number;
  averageLeadTime: number;
  communicationScore?: number;
}): SupplierScoreBreakdown {
  const onTimeDeliveryScore = clampPercent(params.onTimeDelivery);
  const fillRateScore = clampPercent(params.fillRate);
  const refusalScore = clampPercent(100 - params.refusalRate);
  const leadTimeScore = clampPercent(calculateLeadTimeScore(params.averageLeadTime));
  const communicationScore = clampPercent(params.communicationScore ?? 100);

  const total =
    onTimeDeliveryScore * 0.35 +
    fillRateScore * 0.25 +
    refusalScore * 0.2 +
    leadTimeScore * 0.1 +
    communicationScore * 0.1;

  return {
    onTimeDeliveryScore: roundMetric(onTimeDeliveryScore),
    fillRateScore: roundMetric(fillRateScore),
    refusalScore: roundMetric(refusalScore),
    leadTimeScore: roundMetric(leadTimeScore),
    communicationScore: roundMetric(communicationScore),
    total: roundMetric(total),
  };
}

export function classifySupplier(score: number): SupplierClass {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

export function compareSupplierPeriods(current: number, previous: number): SupplierPeriodComparison {
  const delta = roundMetric(current - previous);
  const direction: SupplierTrendDirection =
    delta > 0.1 ? "up" : delta < -0.1 ? "down" : "flat";

  return {
    current: roundMetric(current),
    previous: roundMetric(previous),
    delta,
    direction,
  };
}

export function collectSupplierPeriodMetrics(
  orders: OrderWithItems[],
  today = new Date().toISOString().slice(0, 10)
): SupplierPeriodMetrics {
  const items = orders.flatMap((order) => (order.order_items || []).map((item) => ({ item, order })));

  let deliveredLines = 0;
  let canceledLines = 0;
  let overdueLinesCurrent = 0;
  let deliveredOnTimeLines = 0;
  let deliveredLateLines = 0;

  const leadTimeSamples: number[] = [];
  const delaySamples: number[] = [];

  for (const { item, order } of items) {
    const plannedDate = normalizeDate(item.planned_date);
    const deliveredDate = normalizeDate(item.delivered_date);
    const orderDate = normalizeDate(order.order_date);
    const delivered = isDelivered(item);
    const canceled = isCanceled(item);

    if (delivered) {
      deliveredLines += 1;

      if (plannedDate && deliveredDate && deliveredDate <= plannedDate) {
        deliveredOnTimeLines += 1;
      } else if (plannedDate && deliveredDate && deliveredDate > plannedDate) {
        deliveredLateLines += 1;
        delaySamples.push(diffDays(plannedDate, deliveredDate));
      }

      if (orderDate && deliveredDate) {
        leadTimeSamples.push(diffDays(orderDate, deliveredDate));
      }
    }

    if (canceled) {
      canceledLines += 1;
    }

    if (plannedDate && plannedDate < today && !delivered && !canceled) {
      overdueLinesCurrent += 1;
    }
  }

  const totalLines = items.length;
  const onTimeDelivery = calculateOnTimeDelivery({
    deliveredLines,
    deliveredOnTimeLines,
  });
  const fillRate = calculateFillRate({
    totalLines,
    deliveredLines,
  });
  const refusalRate = calculateRefusalRate({
    totalLines,
    canceledLines,
  });

  return {
    totalOrders: orders.length,
    totalLines,
    deliveredLines,
    canceledLines,
    overdueLinesCurrent,
    deliveredOnTimeLines,
    deliveredLateLines,
    averageLeadTime: calculateAverageLeadTime(leadTimeSamples),
    averageDelay: calculateAverageDelay(delaySamples),
    onTimeDelivery: roundMetric(onTimeDelivery),
    fillRate: roundMetric(fillRate),
    refusalRate: roundMetric(refusalRate),
    communicationScore: 100,
  };
}
