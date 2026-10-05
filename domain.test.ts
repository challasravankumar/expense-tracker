import { describe, it, expect } from "vitest";
import {
  paise,
  validDate,
  today,
  total,
  comparison,
  monthlyAverage,
  previousMonth,
  filterExpenses,
  emptyFilters,
  validateBackup,
  importPreview,
  csv,
  type Expense,
  type Data,
} from "../src/domain";
const category = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const e = (date: string, amount_paise = 100): Expense => ({
  id: crypto.randomUUID(),
  date,
  amount_paise,
  category_id: category,
  description: "Milk",
  payment_method: "UPI",
  merchant: "Store",
  notes: "",
});
const backup = (expenses: Expense[]): Data => ({
  expenses,
  categories: [{ id: category, name: "Groceries", archived: false }],
  budgets: [],
});
describe("accurate accounting and calendar dates", () => {
  it("parses integer paise without floating point rounding", () => {
    expect(paise("0.29")).toBe(29);
    expect(paise("125000.01")).toBe(12500001);
    expect(total([e("2026-01-01", 29), e("2026-01-01", 71)])).toBe(100);
    for (const v of ["0", "-1", "1.234", "NaN", "1e5", "1000000001"])
      expect(() => paise(v)).toThrow();
  });
  it("validates leap days, month boundaries and Kolkata midnight", () => {
    expect(validDate("2024-02-29")).toBe(true);
    expect(validDate("2025-02-29")).toBe(false);
    expect(validDate("2026-04-31")).toBe(false);
    expect(today(new Date("2026-12-31T18:30:00Z"))).toBe("2027-01-01");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
  it("compares equivalent elapsed periods and handles short previous month", () => {
    const c = comparison(
      [
        e("2026-03-05", 300),
        e("2026-03-25", 900),
        e("2026-02-05", 100),
        e("2026-02-25", 500),
      ],
      "2026-03",
      "2026-03-05",
    );
    expect(c.a).toBe(300);
    expect(c.b).toBe(100);
    expect(c.percent).toBe(200);
    expect(comparison([], "2024-03", "2024-03-31").label).toContain(
      "2024-02-29",
    );
    expect(comparison([], "2026-01").percent).toBeNull();
  });
  it("excludes future months from current-year monthly average", () => {
    const a = monthlyAverage(
      [e("2026-01-01", 100), e("2026-02-01", 300), e("2026-12-01", 900)],
      "2026",
      "2026-02-08",
    );
    expect(a).toEqual({ count: 2, value: 200 });
    expect(
      monthlyAverage([e("2025-01-01", 1200)], "2025", "2026-02-08"),
    ).toEqual({ count: 12, value: 100 });
  });
  it("combines search, date, category, method and inclusive amount filters", () => {
    const x = e("2026-01-02", 1000);
    expect(
      filterExpenses([x, e("2026-02-01", 2000)], {
        ...emptyFilters,
        search: "store",
        from: "2026-01-01",
        to: "2026-01-31",
        category,
        method: "UPI",
        min: "10",
        max: "10",
      }),
    ).toEqual([x]);
  });
  it("counts payment method only once", () => {
    const x = {
      ...e("2026-01-01", 1000),
      payment_method: "Credit card" as const,
    };
    expect(total([x])).toBe(1000);
  });
});
describe("backup safety", () => {
  it("validates and rejects malformed backups and duplicate IDs", () => {
    const x = e("2026-01-01");
    expect(
      validateBackup({ schema_version: 1, ...backup([x]) }).expenses,
    ).toHaveLength(1);
    expect(() =>
      validateBackup({ schema_version: 1, ...backup([x, x]) }),
    ).toThrow();
    expect(() =>
      validateBackup({
        schema_version: 1,
        ...backup([{ ...x, amount_paise: -1 }]),
      }),
    ).toThrow();
    expect(() =>
      validateBackup({
        schema_version: 1,
        ...backup([{ ...x, category_id: crypto.randomUUID() }]),
      }),
    ).toThrow();
  });
  it("prevents both ID and content duplicates including duplicates within import", () => {
    const x = e("2026-01-01");
    const p = importPreview(
      backup([x, { ...x, id: crypto.randomUUID() }, e("2026-01-02")]),
      backup([x]),
    );
    expect(p.skipped).toBe(2);
    expect(p.expenses).toHaveLength(1);
  });
  it("escapes CSV commas, quotes and spreadsheet formulas", () => {
    const out = csv(
      [{ ...e("2026-01-01"), description: '=CMD("x,y")' }],
      backup([]).categories,
    );
    expect(out).toContain('"\'=CMD(""x,y"")"');
    expect(out).toContain('"1.00"');
  });
});
