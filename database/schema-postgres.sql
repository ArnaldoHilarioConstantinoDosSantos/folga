-- =====================================================================
-- Folga — Finanças pessoais
-- Estrutura do banco para PostgreSQL "puro" (15 ou mais recente), para
-- rodar pelo pgAdmin 4. Não depende de nada do Supabase.
--
-- Como usar no pgAdmin 4:
--   1. Crie o banco: botão direito em "Databases" > Create > Database…
--      e dê o nome "folga" (ou rode, sozinho, em uma Query Tool do banco
--      "postgres":  CREATE DATABASE folga;).
--   2. Clique no banco "folga" e abra Tools > Query Tool.
--   3. Abra este arquivo (ícone de pasta) ou cole o conteúdo e aperte F5.
--
-- O script roda em uma transação: ou cria tudo, ou não cria nada.
-- Pode ser executado mais de uma vez sem apagar dados.
--
-- Diferenças em relação a supabase/schema.sql:
--   * a tabela "users" substitui "auth.users" do Supabase;
--   * "user_id" não tem valor padrão: quem insere informa o usuário;
--   * não há Row Level Security nem os papéis anon/authenticated — o
--     controle de "cada usuário só vê o que é seu" fica com a aplicação
--     que acessar o banco.
--
-- Convenções
--   * Valores monetários são inteiros em centavos (*_cents).
--   * As chaves estrangeiras entre tabelas incluem o user_id, então uma
--     linha nunca aponta para um registro de outro usuário.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Função de apoio: mantém updated_at em dia
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- users: contas de acesso
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL CHECK (position('@' IN email) > 1),
  -- Guarde aqui apenas o hash da senha (bcrypt, argon2…), nunca a senha.
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- E-mail único sem diferenciar maiúsculas de minúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

-- ---------------------------------------------------------------------
-- profiles: um por usuário, criado automaticamente junto com o usuário
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  full_name       text NOT NULL DEFAULT '',
  pay_day         smallint CHECK (pay_day BETWEEN 1 AND 31),
  financial_goal  text,
  onboarded       boolean NOT NULL DEFAULT false,
  defaults_seeded boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created ON users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------
-- accounts: contas e carteiras
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name                  text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  type                  text NOT NULL CHECK (type IN ('checking', 'salary', 'wallet', 'digital', 'savings', 'investment')),
  initial_balance_cents bigint NOT NULL DEFAULT 0,
  color                 text NOT NULL DEFAULT 'blue',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts (user_id);

-- ---------------------------------------------------------------------
-- categories: categorias e subcategorias (parent_id)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  icon       text NOT NULL DEFAULT 'dots',
  color      text NOT NULL DEFAULT 'gray',
  type       text NOT NULL CHECK (type IN ('income', 'expense')),
  parent_id  uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  FOREIGN KEY (parent_id, user_id) REFERENCES categories (id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS categories_user_idx ON categories (user_id);
CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories (parent_id) WHERE parent_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- credit_cards
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS credit_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  bank        text NOT NULL DEFAULT '',
  limit_cents bigint NOT NULL CHECK (limit_cents >= 0),
  closing_day smallint NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day     smallint NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color       text NOT NULL DEFAULT 'violet',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS credit_cards_user_idx ON credit_cards (user_id);

-- ---------------------------------------------------------------------
-- recurring_transactions: gastos fixos e renda mensal
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  description     text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 120),
  amount_cents    bigint NOT NULL CHECK (amount_cents > 0),
  type            text NOT NULL CHECK (type IN ('income', 'expense')),
  category_id     uuid,
  frequency       text NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'yearly')),
  -- dia do mês (mensal e anual)
  day             smallint NOT NULL CHECK (day BETWEEN 1 AND 31),
  -- dia da semana, 0 = domingo (semanal)
  weekday         smallint CHECK (weekday BETWEEN 0 AND 6),
  -- mês 1–12 (anual)
  month           smallint CHECK (month BETWEEN 1 AND 12),
  payment_method  text NOT NULL CHECK (payment_method IN ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer')),
  account_id      uuid,
  card_id         uuid,
  active          boolean NOT NULL DEFAULT true,
  start_date      date NOT NULL,
  end_date        date,
  -- último mês (AAAA-MM) com lançamentos já gerados
  generated_until text CHECK (generated_until ~ '^\d{4}-\d{2}$'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  CHECK (end_date IS NULL OR end_date >= start_date),
  FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id) ON DELETE SET NULL (category_id),
  FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id) ON DELETE SET NULL (account_id),
  FOREIGN KEY (card_id, user_id) REFERENCES credit_cards (id, user_id) ON DELETE SET NULL (card_id)
);

CREATE INDEX IF NOT EXISTS recurring_transactions_user_idx ON recurring_transactions (user_id);

-- ---------------------------------------------------------------------
-- installments: compras parceladas (as parcelas ficam em transactions)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS installments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  description    text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 120),
  total_cents    bigint NOT NULL CHECK (total_cents > 0),
  count          smallint NOT NULL CHECK (count BETWEEN 1 AND 120),
  first_date     date NOT NULL,
  category_id    uuid,
  card_id        uuid,
  account_id     uuid,
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id) ON DELETE SET NULL (category_id),
  FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id) ON DELETE SET NULL (account_id),
  FOREIGN KEY (card_id, user_id) REFERENCES credit_cards (id, user_id) ON DELETE SET NULL (card_id)
);

CREATE INDEX IF NOT EXISTS installments_user_idx ON installments (user_id);

-- ---------------------------------------------------------------------
-- transactions: todos os lançamentos (receitas e despesas)
--   * card_id preenchido  = compra no cartão (entra na fatura)
--   * installment_id      = parcela de uma compra parcelada
--   * recurring_id        = gerado por um gasto fixo / renda mensal
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  description        text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 120),
  amount_cents       bigint NOT NULL CHECK (amount_cents > 0),
  type               text NOT NULL CHECK (type IN ('income', 'expense')),
  category_id        uuid,
  date               date NOT NULL,
  payment_method     text NOT NULL CHECK (payment_method IN ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer')),
  account_id         uuid,
  card_id            uuid,
  notes              text,
  paid               boolean NOT NULL DEFAULT false,
  recurring_id       uuid,
  installment_id     uuid,
  installment_number smallint,
  installment_total  smallint,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id) ON DELETE SET NULL (category_id),
  FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id) ON DELETE SET NULL (account_id),
  FOREIGN KEY (card_id, user_id) REFERENCES credit_cards (id, user_id) ON DELETE SET NULL (card_id),
  FOREIGN KEY (recurring_id, user_id) REFERENCES recurring_transactions (id, user_id) ON DELETE SET NULL (recurring_id),
  FOREIGN KEY (installment_id, user_id) REFERENCES installments (id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS transactions_card_idx ON transactions (card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_installment_idx ON transactions (installment_id) WHERE installment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_recurring_idx ON transactions (recurring_id) WHERE recurring_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_category_idx ON transactions (category_id);
CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions (account_id);

-- Compras de cartão como visão, para consultas e relatórios.
CREATE OR REPLACE VIEW credit_card_transactions AS
  SELECT * FROM transactions WHERE card_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- budgets: limite mensal por categoria
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS budgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id uuid NOT NULL,
  limit_cents bigint NOT NULL CHECK (limit_cents > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id),
  FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- financial_goals e goal_contributions: metas e depósitos
-- (kind = 'emergency' marca a reserva de emergência)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS financial_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  target_cents bigint NOT NULL CHECK (target_cents > 0),
  target_date  date,
  icon         text NOT NULL DEFAULT 'target',
  color        text NOT NULL DEFAULT 'blue',
  kind         text NOT NULL DEFAULT 'goal' CHECK (kind IN ('goal', 'emergency')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS financial_goals_user_idx ON financial_goals (user_id);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  goal_id      uuid NOT NULL,
  -- positivo = depósito, negativo = retirada
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  date         date NOT NULL,
  account_id   uuid,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (goal_id, user_id) REFERENCES financial_goals (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (account_id, user_id) REFERENCES accounts (id, user_id) ON DELETE SET NULL (account_id)
);

CREATE INDEX IF NOT EXISTS goal_contributions_goal_idx ON goal_contributions (goal_id);
CREATE INDEX IF NOT EXISTS goal_contributions_user_idx ON goal_contributions (user_id);

-- ---------------------------------------------------------------------
-- monthly_plans: planejamento do mês (distribuição da renda)
-- allocations: [{ "key", "label", "category_id" | null, "amount_cents" }]
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS monthly_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- mês no formato AAAA-MM
  month                 text NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  expected_income_cents bigint NOT NULL CHECK (expected_income_cents >= 0),
  allocations           jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allocations) = 'array'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

-- ---------------------------------------------------------------------
-- transfers: movimentação entre contas (não é receita nem despesa)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL,
  to_account_id   uuid NOT NULL,
  amount_cents    bigint NOT NULL CHECK (amount_cents > 0),
  date            date NOT NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id),
  FOREIGN KEY (from_account_id, user_id) REFERENCES accounts (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (to_account_id, user_id) REFERENCES accounts (id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS transfers_user_date_idx ON transfers (user_id, date DESC);

-- ---------------------------------------------------------------------
-- notifications: alertas dispensados pelo usuário
-- (os alertas são calculados pela aplicação; aqui fica só o que foi fechado)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key          text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- ---------------------------------------------------------------------
-- Gatilho de updated_at em todas as tabelas
-- ---------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'profiles', 'accounts', 'categories', 'credit_cards', 'recurring_transactions',
    'installments', 'transactions', 'budgets', 'financial_goals', 'goal_contributions',
    'monthly_plans', 'transfers', 'notifications'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t
    );
  END LOOP;
END;
$$;

COMMIT;

-- =====================================================================
-- Conferência (opcional): rode depois, para ver as tabelas criadas.
-- =====================================================================
-- SELECT table_name
--   FROM information_schema.tables
--  WHERE table_schema = 'public'
--  ORDER BY table_name;
