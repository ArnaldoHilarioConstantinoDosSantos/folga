-- =====================================================================
-- Folga — Finanças pessoais
-- Estrutura do banco (Supabase / PostgreSQL 15+)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". O script pode ser executado mais de uma vez.
--
-- Convenções
--   * Toda tabela pertence a um usuário (user_id) e é protegida por RLS:
--     cada pessoa só enxerga e altera as próprias linhas.
--   * Valores monetários são inteiros em centavos (*_cents) — sem erros de
--     arredondamento de ponto flutuante.
--   * As chaves estrangeiras entre tabelas incluem o user_id, então uma
--     linha nunca consegue apontar para um registro de outro usuário.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: um por usuário, criado automaticamente no cadastro
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null default '',
  pay_day         smallint check (pay_day between 1 and 31),
  financial_goal  text,
  onboarded       boolean not null default false,
  defaults_seeded boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- accounts: contas e carteiras
-- ---------------------------------------------------------------------

create table if not exists public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 60),
  type                  text not null check (type in ('checking', 'salary', 'wallet', 'digital', 'savings', 'investment')),
  initial_balance_cents bigint not null default 0,
  color                 text not null default 'blue',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, user_id)
);

-- ---------------------------------------------------------------------
-- categories: categorias e subcategorias (parent_id)
-- ---------------------------------------------------------------------

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  icon       text not null default 'dots',
  color      text not null default 'gray',
  type       text not null check (type in ('income', 'expense')),
  parent_id  uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id) references public.categories (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- credit_cards
-- ---------------------------------------------------------------------

create table if not exists public.credit_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  bank        text not null default '',
  limit_cents bigint not null check (limit_cents >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day     smallint not null check (due_day between 1 and 31),
  color       text not null default 'violet',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);

-- ---------------------------------------------------------------------
-- recurring_transactions: gastos fixos e renda mensal
-- (a sugestão "recurring_expenses" virou uma tabela só, com a coluna type,
--  para a renda recorrente usar exatamente o mesmo mecanismo)
-- ---------------------------------------------------------------------

create table if not exists public.recurring_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description     text not null check (char_length(description) between 1 and 120),
  amount_cents    bigint not null check (amount_cents > 0),
  type            text not null check (type in ('income', 'expense')),
  category_id     uuid,
  frequency       text not null check (frequency in ('monthly', 'weekly', 'yearly')),
  day             smallint not null check (day between 1 and 31),
  weekday         smallint check (weekday between 0 and 6),
  month           smallint check (month between 1 and 12),
  payment_method  text not null check (payment_method in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer')),
  account_id      uuid,
  card_id         uuid,
  active          boolean not null default true,
  start_date      date not null,
  end_date        date,
  generated_until text check (generated_until ~ '^\d{4}-\d{2}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (card_id, user_id) references public.credit_cards (id, user_id) on delete set null (card_id)
);

-- ---------------------------------------------------------------------
-- installments: compras parceladas (as parcelas ficam em transactions)
-- ---------------------------------------------------------------------

create table if not exists public.installments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description    text not null check (char_length(description) between 1 and 120),
  total_cents    bigint not null check (total_cents > 0),
  count          smallint not null check (count between 1 and 120),
  first_date     date not null,
  category_id    uuid,
  card_id        uuid,
  account_id     uuid,
  payment_method text not null check (payment_method in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (card_id, user_id) references public.credit_cards (id, user_id) on delete set null (card_id)
);

-- ---------------------------------------------------------------------
-- transactions: todos os lançamentos (receitas e despesas)
--   * card_id preenchido  = compra no cartão (entra na fatura)
--   * installment_id      = parcela de uma compra parcelada
--   * recurring_id        = gerado por um gasto fixo / renda mensal
-- ---------------------------------------------------------------------

create table if not exists public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description        text not null check (char_length(description) between 1 and 120),
  amount_cents       bigint not null check (amount_cents > 0),
  type               text not null check (type in ('income', 'expense')),
  category_id        uuid,
  date               date not null,
  payment_method     text not null check (payment_method in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer')),
  account_id         uuid,
  card_id            uuid,
  notes              text,
  paid               boolean not null default false,
  recurring_id       uuid,
  installment_id     uuid,
  installment_number smallint,
  installment_total  smallint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id),
  foreign key (card_id, user_id) references public.credit_cards (id, user_id) on delete set null (card_id),
  foreign key (recurring_id, user_id) references public.recurring_transactions (id, user_id) on delete set null (recurring_id),
  foreign key (installment_id, user_id) references public.installments (id, user_id) on delete cascade
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_card_idx on public.transactions (card_id) where card_id is not null;
create index if not exists transactions_installment_idx on public.transactions (installment_id) where installment_id is not null;
create index if not exists transactions_recurring_idx on public.transactions (recurring_id) where recurring_id is not null;
create index if not exists transactions_category_idx on public.transactions (category_id);
create index if not exists transactions_account_idx on public.transactions (account_id);

-- Compras de cartão como visão, para consultas e relatórios direto no banco.
-- security_invoker faz a visão respeitar a RLS de quem consulta.
create or replace view public.credit_card_transactions
with (security_invoker = true) as
  select * from public.transactions where card_id is not null;

-- ---------------------------------------------------------------------
-- budgets: limite mensal por categoria
-- ---------------------------------------------------------------------

create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  limit_cents bigint not null check (limit_cents > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, category_id),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- financial_goals e goal_contributions: metas e depósitos
-- (kind = 'emergency' marca a reserva de emergência)
-- ---------------------------------------------------------------------

create table if not exists public.financial_goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  target_cents bigint not null check (target_cents > 0),
  target_date  date,
  icon         text not null default 'target',
  color        text not null default 'blue',
  kind         text not null default 'goal' check (kind in ('goal', 'emergency')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.goal_contributions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id      uuid not null,
  -- positivo = depósito, negativo = retirada
  amount_cents bigint not null check (amount_cents <> 0),
  date         date not null,
  account_id   uuid,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.financial_goals (id, user_id) on delete cascade,
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null (account_id)
);

create index if not exists goal_contributions_goal_idx on public.goal_contributions (goal_id);

-- ---------------------------------------------------------------------
-- monthly_plans: planejamento do mês (distribuição da renda)
-- allocations: [{ key, label, category_id | null, amount_cents }]
-- ---------------------------------------------------------------------

create table if not exists public.monthly_plans (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month                 text not null check (month ~ '^\d{4}-\d{2}$'),
  expected_income_cents bigint not null check (expected_income_cents >= 0),
  allocations           jsonb not null default '[]'::jsonb check (jsonb_typeof(allocations) = 'array'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, month)
);

-- ---------------------------------------------------------------------
-- transfers: movimentação entre contas (não é receita nem despesa)
-- ---------------------------------------------------------------------

create table if not exists public.transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_account_id uuid not null,
  to_account_id   uuid not null,
  amount_cents    bigint not null check (amount_cents > 0),
  date            date not null,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (from_account_id <> to_account_id),
  foreign key (from_account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- notifications: alertas dispensados pelo usuário
-- (os alertas em si são calculados no app; aqui fica só o que foi fechado)
-- ---------------------------------------------------------------------

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key          text not null,
  dismissed_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, key)
);

-- =====================================================================
-- Segurança: Row Level Security, permissões e gatilho de updated_at
-- =====================================================================

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'credit_cards', 'recurring_transactions', 'installments',
    'transactions', 'budgets', 'financial_goals', 'goal_contributions', 'monthly_plans',
    'transfers', 'notifications'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    -- Uma política para todas as operações: só as próprias linhas, e uma
    -- linha nunca pode ser criada ou movida para outro usuário.
    execute format('drop policy if exists "own_rows" on public.%I', t);
    execute format(
      'create policy "own_rows" on public.%I for all to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );

    -- Visitantes não autenticados não têm acesso algum.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

revoke all on public.credit_card_transactions from anon;
grant select on public.credit_card_transactions to authenticated;

-- As funções de gatilho não devem ser chamadas pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
