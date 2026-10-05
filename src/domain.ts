export const methods = [
  "UPI",
  "Cash",
  "Debit card",
  "Credit card",
  "Bank transfer",
] as const;
export type Payment = (typeof methods)[number];
export type Category = { id: string; name: string; archived: boolean };
export type Expense = {
  id: string;
  date: string;
  amount_paise: number;
  category_id: string;
  description: string;
  payment_method: Payment;
  merchant: string;
  notes: string;
  version?: number;
};
export type Budget = {
  id: string;
  month: string;
  category_id: string | null;
  amount_paise: number;
};
export type Data = {
  expenses: Expense[];
  categories: Category[];
  budgets: Budget[];
};
export const defaults = [
  "Groceries",
  "Rent",
  "Food & Dining",
  "Transport",
  "Electricity",
  "Internet",
  "Mobile",
  "Health",
  "Shopping",
  "Family",
  "Entertainment",
  "Other",
];
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n / 100);
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    s >= "1900-01-01" &&
    s <= "9999-12-31" &&
    !isNaN(Date.parse(s)) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function paise(s: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(s.trim()))
    throw Error("Enter a positive amount with at most two decimal places.");
  const [a, b = ""] = s.trim().split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n <= 0 || n > 100000000000)
    throw Error("Amount must be between ₹0.01 and ₹1,00,00,00,000.");
  return n;
}
export const total = (items: Expense[]) =>
  items.reduce((n, e) => n + e.amount_paise, 0);
export const inMonth = (items: Expense[], month: string) =>
  items.filter((e) => e.date.startsWith(month));
export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
export function comparison(items: Expense[], month: string, now = today()) {
  const prev = previousMonth(month);
  const day = Number(now.slice(8));
  const current = month === now.slice(0, 7);
  const end = current
    ? `${month}-${String(day).padStart(2, "0")}`
    : `${month}-${daysInMonth(month)}`;
  const prevEnd = `${prev}-${String(current ? Math.min(day, daysInMonth(prev)) : daysInMonth(prev)).padStart(2, "0")}`;
  const a = total(
    items.filter((e) => e.date >= month + "-01" && e.date <= end),
  );
  const b = total(
    items.filter((e) => e.date >= prev + "-01" && e.date <= prevEnd),
  );
  return {
    a,
    b,
    percent: b ? ((a - b) / b) * 100 : null,
    label: `${month}-01 to ${end} vs ${prev}-01 to ${prevEnd}`,
  };
}
export function monthlyAverage(items: Expense[], year: string, now = today()) {
  const count =
    year === now.slice(0, 4)
      ? Number(now.slice(5, 7))
      : year > now.slice(0, 4)
        ? 0
        : 12;
  const eligible = items.filter(
    (e) => e.date.startsWith(year) && Number(e.date.slice(5, 7)) <= count,
  );
  return { count, value: count ? total(eligible) / count : 0 };
}
export function group(items: Expense[], key: "category_id" | "date") {
  return Object.entries(
    items.reduce<Record<string, number>>((a, e) => {
      a[e[key]] = (a[e[key]] || 0) + e.amount_paise;
      return a;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
}
export type Filters = {
  search: string;
  from: string;
  to: string;
  category: string;
  method: string;
  min: string;
  max: string;
};
export const emptyFilters: Filters = {
  search: "",
  from: "",
  to: "",
  category: "",
  method: "",
  min: "",
  max: "",
};
export function filterExpenses(items: Expense[], f: Filters) {
  return items.filter(
    (e) =>
      (!f.search ||
        `${e.description} ${e.merchant} ${e.notes}`
          .toLowerCase()
          .includes(f.search.toLowerCase())) &&
      (!f.from || e.date >= f.from) &&
      (!f.to || e.date <= f.to) &&
      (!f.category || e.category_id === f.category) &&
      (!f.method || e.payment_method === f.method) &&
      (!f.min || e.amount_paise >= Number(f.min) * 100) &&
      (!f.max || e.amount_paise <= Number(f.max) * 100),
  );
}
export function fingerprint(e: Expense, category: string) {
  return JSON.stringify([
    e.date,
    e.amount_paise,
    category.trim().toLowerCase(),
    e.description.trim().toLowerCase(),
    e.payment_method,
    e.merchant.trim().toLowerCase(),
    e.notes.trim().toLowerCase(),
  ]);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateBackup(value: unknown): Data {
  if (!value || typeof value !== "object") throw Error("Invalid backup.");
  const v = value as Record<string, unknown>;
  if (
    v.schema_version !== 1 ||
    !Array.isArray(v.expenses) ||
    !Array.isArray(v.categories) ||
    !Array.isArray(v.budgets)
  )
    throw Error("Use a version 1 expense tracker backup.");
  if (
    v.expenses.length > 50000 ||
    v.categories.length > 500 ||
    v.budgets.length > 10000
  )
    throw Error("Backup exceeds import limits.");
  const ids = new Set<string>();
  const names = new Set<string>();
  const categories: Category[] = v.categories.map((c: any) => {
    if (
      !c ||
      !uuid.test(c.id) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      c.name.length > 60 ||
      typeof c.archived !== "boolean" ||
      ids.has(c.id) ||
      names.has(c.name.trim().toLowerCase())
    )
      throw Error("Invalid or duplicate category.");
    ids.add(c.id);
    names.add(c.name.trim().toLowerCase());
    return { id: c.id, name: c.name.trim(), archived: c.archived };
  });
  const expenseIds = new Set();
  const expenses: Expense[] = v.expenses.map((e: any, i: number) => {
    if (
      !e ||
      !uuid.test(e.id) ||
      expenseIds.has(e.id) ||
      !validDate(e.date) ||
      !Number.isSafeInteger(e.amount_paise) ||
      e.amount_paise <= 0 ||
      e.amount_paise > 100000000000 ||
      !ids.has(e.category_id) ||
      !methods.includes(e.payment_method) ||
      typeof e.description !== "string" ||
      !e.description.trim() ||
      e.description.length > 200 ||
      typeof e.merchant !== "string" ||
      e.merchant.length > 120 ||
      typeof e.notes !== "string" ||
      e.notes.length > 2000
    )
      throw Error(`Invalid expense at row ${i + 1}.`);
    expenseIds.add(e.id);
    return {
      id: e.id,
      date: e.date,
      amount_paise: e.amount_paise,
      category_id: e.category_id,
      description: e.description.trim(),
      payment_method: e.payment_method,
      merchant: e.merchant,
      notes: e.notes,
    };
  });
  const budgetKeys = new Set();
  const budgets: Budget[] = v.budgets.map((b: any) => {
    const key = b?.month + ":" + b?.category_id;
    if (
      !b ||
      !uuid.test(b.id) ||
      !/^\d{4}-\d{2}-01$/.test(b.month) ||
      !validDate(b.month) ||
      (b.category_id !== null && !ids.has(b.category_id)) ||
      !Number.isSafeInteger(b.amount_paise) ||
      b.amount_paise <= 0 ||
      b.amount_paise > 100000000000 ||
      budgetKeys.has(key)
    )
      throw Error("Invalid or duplicate budget.");
    budgetKeys.add(key);
    return {
      id: b.id,
      month: b.month,
      category_id: b.category_id,
      amount_paise: b.amount_paise,
    };
  });
  return { expenses, categories, budgets };
}
export function importPreview(incoming: Data, existing: Data) {
  const name = (data: Data, id: string) =>
    data.categories.find((c) => c.id === id)?.name || "";
  const seen = new Set(
    existing.expenses.map((e) => fingerprint(e, name(existing, e.category_id))),
  );
  const ids = new Set(existing.expenses.map((e) => e.id));
  let skipped = 0;
  const expenses = incoming.expenses.filter((e) => {
    const f = fingerprint(e, name(incoming, e.category_id));
    if (ids.has(e.id) || seen.has(f)) {
      skipped++;
      return false;
    }
    seen.add(f);
    ids.add(e.id);
    return true;
  });
  return { expenses, skipped };
}
export function csv(items: Expense[], categories: Category[]) {
  const cell = (v: string | number) =>
    '"' +
    String(
      typeof v === "string" && /^[=+@\-\t\r]/.test(v) ? "'" + v : v,
    ).replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      [
        "Date",
        "Amount (INR)",
        "Category",
        "Description",
        "Payment method",
        "Merchant",
        "Notes",
      ],
      ...items.map((e) => [
        e.date,
        (e.amount_paise / 100).toFixed(2),
        categories.find((c) => c.id === e.category_id)?.name || "",
        e.description,
        e.payment_method,
        e.merchant,
        e.notes,
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
