-- Run once in the Supabase SQL Editor. All money values are integer paise.
create table public.categories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 60), archived boolean not null default false,
 unique(user_id,id)
);
create unique index categories_owner_name on public.categories(user_id,lower(btrim(name)));
create table public.expenses (
 id uuid primary key, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 date date not null check(date between '1900-01-01' and '9999-12-31'),
 amount_paise bigint not null check(amount_paise between 1 and 100000000000),
 category_id uuid not null, description text not null check(length(btrim(description)) between 1 and 200),
 payment_method text not null check(payment_method in ('UPI','Cash','Debit card','Credit card','Bank transfer')),
 merchant text not null default '' check(length(merchant)<=120), notes text not null default '' check(length(notes)<=2000),
 version integer not null default 1, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(user_id,category_id) references public.categories(user_id,id)
);
create index expenses_owner_date on public.expenses(user_id,date desc) where deleted_at is null;
create index expenses_owner_category on public.expenses(user_id,category_id);
create table public.budgets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 month date not null check(extract(day from month)=1 and month between '1900-01-01' and '9999-12-01'), category_id uuid,
 amount_paise bigint not null check(amount_paise between 1 and 100000000000),
 foreign key(user_id,category_id) references public.categories(user_id,id),
 unique nulls not distinct(user_id,month,category_id)
);
-- Explicit read/write ownership checks, including new ownership on UPDATE.
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
do $$ declare t text; begin foreach t in array array['categories','expenses','budgets'] loop
 execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
 execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('grant select, insert, update, delete on public.%I to authenticated',t);
end loop; end $$;
create function public.seed_categories() returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.categories(name) select unnest(array['Groceries','Rent','Food & Dining','Transport','Electricity','Internet','Mobile','Health','Shopping','Family','Entertainment','Other']) where not exists(select 1 from public.categories) on conflict do nothing;
end $$;
-- One statement returns a consistent snapshot without the API's row pagination limit.
create function public.expense_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('categories',coalesce((select jsonb_agg(to_jsonb(c)-'user_id' order by c.name) from public.categories c),'[]'::jsonb),
 'expenses',coalesce((select jsonb_agg(to_jsonb(e)-'user_id'-'deleted_at'-'created_at'-'updated_at' order by e.date desc,e.created_at desc) from public.expenses e where deleted_at is null),'[]'::jsonb),
 'budgets',coalesce((select jsonb_agg(to_jsonb(b)-'user_id') from public.budgets b),'[]'::jsonb));
$$;
create function public.save_expense(item jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare old public.expenses; wanted public.expenses; begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 wanted := jsonb_populate_record(null::public.expenses,item);
 select * into old from public.expenses where id=wanted.id for update;
 if found then
  if old.deleted_at is not null then raise exception 'This expense was deleted. Refresh before continuing.'; end if;
  if row(old.date,old.amount_paise,old.category_id,old.description,old.payment_method,old.merchant,old.notes) is not distinct from row(wanted.date,wanted.amount_paise,wanted.category_id,wanted.description,wanted.payment_method,wanted.merchant,wanted.notes) then return; end if;
  if wanted.version is null or old.version<>wanted.version then raise exception 'This expense changed on another device. Close this form, refresh, and edit again.'; end if;
  update public.expenses set date=wanted.date,amount_paise=wanted.amount_paise,category_id=wanted.category_id,description=wanted.description,payment_method=wanted.payment_method,merchant=wanted.merchant,notes=wanted.notes,version=old.version+1,updated_at=now() where id=wanted.id;
 else
  if wanted.version is not null then raise exception 'Expense no longer exists'; end if;
  insert into public.expenses(id,date,amount_paise,category_id,description,payment_method,merchant,notes) values(wanted.id,wanted.date,wanted.amount_paise,wanted.category_id,wanted.description,wanted.payment_method,wanted.merchant,wanted.notes);
 end if;
end $$;
create function public.delete_expense(expense_id uuid, expected_version integer) returns void language plpgsql security invoker set search_path='' as $$
declare old public.expenses; begin
 select * into old from public.expenses where id=expense_id for update;
 if not found or old.deleted_at is not null then return; end if;
 if old.version<>expected_version then raise exception 'Expense changed on another device. Refresh and try again.'; end if;
 update public.expenses set deleted_at=now(),version=version+1 where id=expense_id;
end $$;
create function public.set_budget(budget_month date, category uuid, amount bigint) returns void language plpgsql security invoker set search_path='' as $$
begin
 if amount is null then delete from public.budgets where month=budget_month and category_id is not distinct from category;
 else insert into public.budgets(month,category_id,amount_paise) values(budget_month,category,amount) on conflict(user_id,month,category_id) do update set amount_paise=excluded.amount_paise; end if;
end $$;
-- Atomic, additive import. Never update existing expenses, categories, or budgets.
create function public.import_backup(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c jsonb; e jsonb; b jsonb; mapped uuid; mapping jsonb:='{}'; added integer:=0; skipped integer:=0; budgets_added integer:=0; begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if payload->>'schema_version' is distinct from '1' or jsonb_typeof(payload->'categories') is distinct from 'array' or jsonb_typeof(payload->'expenses') is distinct from 'array' or jsonb_typeof(payload->'budgets') is distinct from 'array' then raise exception 'Invalid backup format'; end if;
 if jsonb_array_length(payload->'categories')>500 or jsonb_array_length(payload->'expenses')>50000 or jsonb_array_length(payload->'budgets')>10000 then raise exception 'Import too large'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 for c in select value from jsonb_array_elements(payload->'categories') loop
  select id into mapped from public.categories where lower(btrim(name))=lower(btrim(c->>'name'));
  if mapped is null then insert into public.categories(name,archived) values(btrim(c->>'name'),coalesce((c->>'archived')::boolean,false)) returning id into mapped; end if;
  mapping:=mapping||jsonb_build_object(c->>'id',mapped);
 end loop;
 for e in select value from jsonb_array_elements(payload->'expenses') loop
  mapped:=(mapping->>(e->>'category_id'))::uuid;
  if mapped is null then raise exception 'Unknown category'; end if;
  if exists(select 1 from public.expenses x where x.id=(e->>'id')::uuid or (x.date=(e->>'date')::date and x.amount_paise=(e->>'amount_paise')::bigint and x.category_id=mapped and lower(btrim(x.description))=lower(btrim(e->>'description')) and x.payment_method=e->>'payment_method' and lower(btrim(x.merchant))=lower(btrim(e->>'merchant')) and lower(btrim(x.notes))=lower(btrim(e->>'notes')))) then skipped:=skipped+1;
  else
   insert into public.expenses(id,date,amount_paise,category_id,description,payment_method,merchant,notes) values((e->>'id')::uuid,(e->>'date')::date,(e->>'amount_paise')::bigint,mapped,btrim(e->>'description'),e->>'payment_method',e->>'merchant',e->>'notes');added:=added+1;
  end if;
 end loop;
 for b in select value from jsonb_array_elements(payload->'budgets') loop
  mapped:=(mapping->>(b->>'category_id'))::uuid;
  if b->>'category_id' is not null and mapped is null then raise exception 'Unknown budget category'; end if;
  insert into public.budgets(month,category_id,amount_paise) values((b->>'month')::date,mapped,(b->>'amount_paise')::bigint) on conflict(user_id,month,category_id) do nothing;
  if found then budgets_added:=budgets_added+1; end if;
 end loop;
 return jsonb_build_object('added',added,'skipped',skipped,'budgets_added',budgets_added);
end $$;
revoke all on function public.seed_categories(), public.expense_snapshot(), public.save_expense(jsonb), public.delete_expense(uuid,integer), public.set_budget(date,uuid,bigint), public.import_backup(jsonb) from public,anon;
grant execute on function public.seed_categories(), public.expense_snapshot(), public.save_expense(jsonb), public.delete_expense(uuid,integer), public.set_budget(date,uuid,bigint), public.import_backup(jsonb) to authenticated;
-- Reliable 20-second snapshot refresh is built in; Realtime reduces latency further.
do $$ declare t text; begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then foreach t in array array['expenses','categories','budgets'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
end loop; end if; end $$;
