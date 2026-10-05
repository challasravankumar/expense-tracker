import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
let cat: string, bobCat: string;
async function as(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
const item = (id = crypto.randomUUID()) => ({
  id,
  date: "2026-01-01",
  amount_paise: 12345,
  category_id: cat,
  description: "Groceries",
  payment_method: "UPI",
  merchant: "Shop",
  notes: "",
});
async function save(e: object) {
  return db.query("select public.save_expense($1::jsonb)", [JSON.stringify(e)]);
}
async function snapshot() {
  return (await db.query<{ d: any }>("select public.expense_snapshot() as d"))
    .rows[0].d;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${alice}'),('${bob}');`,
  );
  await db.exec(
    readFileSync(
      new URL("../supabase/migrations/001_expenses.sql", import.meta.url),
      "utf8",
    ),
  );
  await as(alice);
  await db.exec("select public.seed_categories()");
  cat = (await snapshot()).categories[0].id;
  await as(bob);
  await db.exec("select public.seed_categories()");
  bobCat = (await snapshot()).categories[0].id;
  await as(alice);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("real PostgreSQL migration and RLS", () => {
  it("creates twelve private categories per account", async () => {
    expect((await snapshot()).categories).toHaveLength(12);
    expect(cat).not.toBe(bobCat);
  });
  it("saves idempotently, edits once, rejects stale edits and deletes idempotently", async () => {
    const x = item();
    await save(x);
    await save(x);
    let rows = (await snapshot()).expenses;
    expect(rows.filter((e: any) => e.id === x.id)).toHaveLength(1);
    await save({ ...x, amount_paise: 500, version: 1 });
    await save({ ...x, amount_paise: 500, version: 1 });
    await expect(save({ ...x, amount_paise: 600, version: 1 })).rejects.toThrow(
      /changed/,
    );
    expect(
      (await snapshot()).expenses.find((e: any) => e.id === x.id).amount_paise,
    ).toBe(500);
    await db.query("select public.delete_expense($1,2)", [x.id]);
    await db.query("select public.delete_expense($1,2)", [x.id]);
    expect((await snapshot()).expenses.some((e: any) => e.id === x.id)).toBe(
      false,
    );
    await expect(save(x)).rejects.toThrow(/deleted/);
  });
  it("blocks reading, inserting, updating and deleting another user’s records", async () => {
    const x = item();
    await save(x);
    await as(bob);
    expect((await snapshot()).expenses.some((e: any) => e.id === x.id)).toBe(
      false,
    );
    expect(
      (
        await db.query(
          "update public.expenses set amount_paise=9 where id=$1 returning id",
          [x.id],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("delete from public.expenses where id=$1 returning id", [
          x.id,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query("insert into public.categories(user_id,name) values($1,$2)", [
        alice,
        "Intruder",
      ]),
    ).rejects.toThrow(/row-level security/);
    await as(alice);
    await expect(
      db.query("update public.expenses set user_id=$1 where id=$2", [
        bob,
        x.id,
      ]),
    ).rejects.toThrow();
  });
  it("blocks cross-owner expense and budget category references", async () => {
    await expect(save({ ...item(), category_id: bobCat })).rejects.toThrow(
      /foreign key/,
    );
    await expect(
      db.query("select public.set_budget($1,$2,$3)", [
        "2026-01-01",
        bobCat,
        500,
      ]),
    ).rejects.toThrow(/foreign key/);
  });
  it("enforces positive paise, valid calendar dates and nonblank descriptions", async () => {
    await expect(save({ ...item(), amount_paise: 0 })).rejects.toThrow();
    await expect(save({ ...item(), date: "2026-02-30" })).rejects.toThrow();
    await expect(save({ ...item(), description: " " })).rejects.toThrow();
  });
  it("preserves historical monthly budgets and isolates their visibility", async () => {
    await db.query("select public.set_budget($1,null,$2)", [
      "2026-01-01",
      10000,
    ]);
    await db.query("select public.set_budget($1,null,$2)", [
      "2026-02-01",
      20000,
    ]);
    await db.query("select public.set_budget($1,null,$2)", [
      "2026-02-01",
      30000,
    ]);
    expect(
      (await snapshot()).budgets.find((b: any) => b.month === "2026-01-01")
        .amount_paise,
    ).toBe(10000);
    await as(bob);
    expect((await snapshot()).budgets).toHaveLength(0);
    await as(alice);
  });
  it("imports atomically, skips semantic duplicates and preserves budgets", async () => {
    const x = { ...item(), date: "2026-03-01" };
    const payload = {
      schema_version: 1,
      categories: [
        {
          id: cat,
          name: (await snapshot()).categories.find((c: any) => c.id === cat)
            .name,
          archived: false,
        },
      ],
      expenses: [x, { ...x, id: crypto.randomUUID() }],
      budgets: [
        {
          id: crypto.randomUUID(),
          month: "2026-01-01",
          category_id: null,
          amount_paise: 999,
        },
      ],
    };
    const result = await db.query<{ r: any }>(
      "select public.import_backup($1::jsonb) as r",
      [JSON.stringify(payload)],
    );
    expect(result.rows[0].r).toEqual({
      added: 1,
      skipped: 1,
      budgets_added: 0,
    });
    const again = await db.query<{ r: any }>(
      "select public.import_backup($1::jsonb) as r",
      [JSON.stringify(payload)],
    );
    expect(again.rows[0].r.added).toBe(0);
    const before = (await snapshot()).expenses.length;
    await expect(
      db.query("select public.import_backup($1::jsonb)", [
        JSON.stringify({
          ...payload,
          expenses: [
            { ...x, id: crypto.randomUUID(), date: "2026-04-01" },
            {
              ...x,
              id: crypto.randomUUID(),
              date: "2026-04-02",
              amount_paise: -1,
            },
          ],
        }),
      ]),
    ).rejects.toThrow();
    expect((await snapshot()).expenses).toHaveLength(before);
  });
  it("denies anonymous access to tables and functions", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from public.expenses")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("select public.expense_snapshot()")).rejects.toThrow(
      /permission denied/,
    );
    await as(alice);
  });
});
