type NotificationRecipientRole = "admin" | "supplier" | "buyer" | "viewer";
type NotificationChannel = "push" | "email";
type NotificationEventType =
  | "new_order"
  | "overdue"
  | "status_changed"
  | "cancellation"
  | "planned_date_changed"
  | "replacement_set";

type NotificationSetting = {
  eventType: NotificationEventType;
  role: NotificationRecipientRole;
  pushEnabled: boolean;
  emailEnabled: boolean;
};

const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
  new_order: "Новый заказ",
  status_changed: "Изменение статуса",
  replacement_set: "Проставлена замена",
  overdue: "Просрочка",
  planned_date_changed: "Изменение планового срока",
  cancellation: "Отмена позиции",
};

const NOTIFICATION_EVENT_DESCRIPTIONS: Record<NotificationEventType, string> = {
  new_order: "Когда в системе появляется новый заказ.",
  status_changed: "Когда меняется статус одной или нескольких позиций.",
  replacement_set: "Когда по позиции указан актуальный артикул замены.",
  overdue: "Когда заказ или позиции требуют внимания по срокам.",
  planned_date_changed: "Когда поставщик или админ меняет плановую дату.",
  cancellation: "Когда по позиции появляется отмена.",
};

const NOTIFICATION_ROLE_LABELS: Record<NotificationRecipientRole, string> = {
  admin: "Админ",
  buyer: "Покупатель",
  supplier: "Поставщик",
  viewer: "Наблюдатель",
};

const NOTIFICATION_EVENTS = Object.keys(
  NOTIFICATION_EVENT_LABELS
) as NotificationEventType[];

const NOTIFICATION_ROLES = Object.keys(
  NOTIFICATION_ROLE_LABELS
) as NotificationRecipientRole[];

function getDefaultNotificationSetting(
  eventType: NotificationEventType,
  role: NotificationRecipientRole
): NotificationSetting {
  const adminEnabled = role === "admin";
  const buyerEnabled =
    role === "buyer" &&
    [
      "new_order",
      "status_changed",
      "replacement_set",
      "overdue",
      "planned_date_changed",
      "cancellation",
    ].includes(eventType);
  const supplierEnabled =
    role === "supplier" && ["new_order", "overdue"].includes(eventType);
  const enabled = adminEnabled || buyerEnabled || supplierEnabled;

  return {
    eventType,
    role,
    pushEnabled: enabled,
    emailEnabled: enabled,
  };
}

function getDefaultNotificationSettings() {
  return NOTIFICATION_EVENTS.flatMap((eventType) =>
    NOTIFICATION_ROLES.map((role) => getDefaultNotificationSetting(eventType, role))
  );
}

function isKnownNotificationEventType(value: string): value is NotificationEventType {
  return NOTIFICATION_EVENTS.includes(value as NotificationEventType);
}

function isKnownNotificationRole(value: string): value is NotificationRecipientRole {
  return NOTIFICATION_ROLES.includes(value as NotificationRecipientRole);
}

export {
  NOTIFICATION_EVENT_DESCRIPTIONS,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_ROLE_LABELS,
  NOTIFICATION_ROLES,
  getDefaultNotificationSetting,
  getDefaultNotificationSettings,
  isKnownNotificationEventType,
  isKnownNotificationRole,
};

export type {
  NotificationChannel,
  NotificationEventType,
  NotificationRecipientRole,
  NotificationSetting,
};
