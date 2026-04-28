export type AnalyticsPeriod = "week" | "month" | "quarter" | "year" | "all";

export function parseAnalyticsPeriod(value?: string | null): AnalyticsPeriod {
  switch (value) {
    case "week":
      return "week";
    case "month":
    case "30d":
      return "month";
    case "quarter":
    case "90d":
      return "quarter";
    case "year":
    case "180d":
      return "year";
    case "all":
      return "all";
    default:
      return "month";
  }
}

export function getAnalyticsPeriodLabel(period: AnalyticsPeriod) {
  switch (period) {
    case "week":
      return "Неделя";
    case "month":
      return "Месяц";
    case "quarter":
      return "Квартал";
    case "year":
      return "Год";
    case "all":
      return "За всё время";
  }
}

function shiftDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getAnalyticsPeriodDays(period: AnalyticsPeriod) {
  switch (period) {
    case "week":
      return 7;
    case "month":
      return 30;
    case "quarter":
      return 90;
    case "year":
      return 365;
    case "all":
      return null;
  }
}

export function getAnalyticsCutoffDate(period: AnalyticsPeriod) {
  const days = getAnalyticsPeriodDays(period);
  if (!days) return null;

  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function getAnalyticsPreviousWindow(period: AnalyticsPeriod) {
  const days = getAnalyticsPeriodDays(period);
  if (!days) {
    return {
      currentStart: null,
      previousStart: null,
      previousEnd: null,
    };
  }

  const today = new Date();
  const currentStartDate = shiftDays(today, -days);
  const previousEndDate = shiftDays(currentStartDate, -1);
  const previousStartDate = shiftDays(previousEndDate, -days);

  return {
    currentStart: currentStartDate.toISOString().slice(0, 10),
    previousStart: previousStartDate.toISOString().slice(0, 10),
    previousEnd: previousEndDate.toISOString().slice(0, 10),
  };
}
