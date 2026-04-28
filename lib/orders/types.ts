export type SupplierSummary = {
  id: number;
  name: string;
};

export type OrderHeader = {
  id: number;
  client_order: string | null;
  order_date: string | null;
  order_type: string | null;
  supplier_id: number | null;
  planned_date: string | null;
  status: string | null;
  delivered_date: string | null;
  comment: string | null;
  updated_by: string | null;
  updated_at: string | null;
  supplier?: SupplierSummary | null;
};

export type OrderItem = {
  id: number;
  order_id: number;
  article: string | null;
  replacement_article: string | null;
  name: string | null;
  quantity: string | null;
  planned_date: string | null;
  initial_planned_date?: string | null;
  planned_date_change_count?: number | null;
  planned_date_last_changed_at?: string | null;
  planned_date_last_changed_by?: string | null;
  deadline_breached_at?: string | null;
  status: string | null;
  delivered_date: string | null;
  canceled_date: string | null;
};

export type OrderWithItems = OrderHeader & {
  order_items?: OrderItem[];
};

export type ItemForm = {
  id?: number;
  article: string;
  hasReplacement: boolean;
  replacementArticle: string;
  name: string;
  quantity: string;
  plannedDate: string;
  initialPlannedDate?: string;
  plannedDateChangeCount?: number;
  plannedDateLastChangedAt?: string;
  plannedDateLastChangedBy?: string;
  deadlineBreachedAt?: string;
  status: string;
  deliveredDate: string;
  canceledDate: string;
  importSource?: "photo" | "excel" | "clipboard";
  importIssues?: string[];
};

export type OrderFormState = {
  clientOrder: string;
  orderDate: string;
  orderType: string;
  supplierId: string;
  comment: string;
  newComment: string;
  bulkPlannedDate: string;
  bulkStatus: string;
  items: ItemForm[];
};

export type ParsedComment = {
  datetime: string;
  author: string;
  text: string;
};

export type UserProfile = {
  id: string;
  email: string;
  role: "admin" | "supplier" | "viewer" | "buyer";
  name: string;
  supplier_id: number | null;
};

export type SortField =
  | "id"
  | "client_order"
  | "order_date"
  | "order_type"
  | "status"
  | "updated_at"
  | "progress";

export type SortDirection = "asc" | "desc";
