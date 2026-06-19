-- FinClear · Schema completo
-- Ejecutar en Supabase → SQL Editor

-- Empresas
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ein text,
  state text,
  created_at timestamptz default now()
);

-- Plan de cuentas
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('activo','ingreso','costo','gasto','impuesto','nd')),
  group_name text,
  keywords text[], -- para auto-clasificación
  deductible boolean default true,
  created_at timestamptz default now(),
  unique(company_id, code)
);

-- Extractos subidos
create table if not exists statements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  bank text not null,
  account_number text,
  period_start date not null,
  period_end date not null,
  beginning_balance numeric(12,2) default 0,
  ending_balance numeric(12,2) default 0,
  filename text,
  created_at timestamptz default now()
);

-- Transacciones del extracto
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid references statements(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  date date not null,
  description text not null,
  debit numeric(12,2) default 0,
  credit numeric(12,2) default 0,
  account_id uuid references accounts(id),
  auto_classified boolean default false,
  confidence int default 0,
  is_non_deductible boolean default false,
  status text default 'pending' check (status in ('pending','confirmed')),
  notes text,
  created_at timestamptz default now()
);

-- Asientos de diario
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  transaction_id uuid references transactions(id),
  date date not null,
  description text not null,
  reference text,
  created_at timestamptz default now()
);

-- Líneas de asiento (partida doble)
create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references journal_entries(id) on delete cascade,
  account_id uuid references accounts(id),
  debit numeric(12,2) default 0,
  credit numeric(12,2) default 0,
  created_at timestamptz default now()
);

-- Reglas de auto-clasificación
create table if not exists classification_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  pattern text not null, -- texto a buscar en descripción
  account_id uuid references accounts(id),
  is_non_deductible boolean default false,
  priority int default 0,
  created_at timestamptz default now()
);

-- Índices
create index on transactions(company_id, status);
create index on transactions(statement_id);
create index on journal_entries(company_id);
create index on journal_lines(entry_id);

-- RLS (Row Level Security) - habilitar para producción
alter table companies enable row level security;
alter table accounts enable row level security;
alter table statements enable row level security;
alter table transactions enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table classification_rules enable row level security;

-- Políticas abiertas para MVP (ajustar con auth en producción)
create policy "allow_all_companies"    on companies          for all using (true);
create policy "allow_all_accounts"     on accounts           for all using (true);
create policy "allow_all_statements"   on statements         for all using (true);
create policy "allow_all_transactions" on transactions       for all using (true);
create policy "allow_all_entries"      on journal_entries    for all using (true);
create policy "allow_all_lines"        on journal_lines      for all using (true);
create policy "allow_all_rules"        on classification_rules for all using (true);

-- Datos iniciales: Legacy Luxury Limo Corp
insert into companies (id, name, ein, state)
values ('00000000-0000-0000-0000-000000000001', 'Legacy Luxury Limo Corp', '', 'New York')
on conflict do nothing;

-- Plan de cuentas inicial
insert into accounts (company_id, code, name, type, group_name, keywords, deductible) values
('00000000-0000-0000-0000-000000000001','1.1.01.01','Citibank N.A.','activo','Activos',null,true),
('00000000-0000-0000-0000-000000000001','4.1.01.01','Serv. transporte (Uber)','ingreso','Ingresos',array['UBER','UBER USA'],true),
('00000000-0000-0000-0000-000000000001','4.1.01.02','Serv. transporte (Lyft)','ingreso','Ingresos',array['LYFT','STRIPE LYFT','STRIPE Lyft'],true),
('00000000-0000-0000-0000-000000000001','4.1.01.03','Serv. transporte (Terceros)','ingreso','Ingresos',array['STRIPE P'],true),
('00000000-0000-0000-0000-000000000001','4.1.01.04','Serv. transporte (Propios)','ingreso','Ingresos',null,true),
('00000000-0000-0000-0000-000000000001','5.1.01.01','Combustible','costo','Costos directos',array['BP#','SHELL OIL','FUEL','SUNOCO','EXXON','CHEVRON'],true),
('00000000-0000-0000-0000-000000000001','5.1.01.02','EZ Pass y Peajes','costo','Costos directos',array['E-Z*PASS','EZPASS','EZ PASS','NJ EZPASS','TPKE','DARIEN TPKE'],true),
('00000000-0000-0000-0000-000000000001','5.1.01.03','Carwash','costo','Costos directos',array['CAR WASH','CARWASH','SOARING'],true),
('00000000-0000-0000-0000-000000000001','6.1.01.01','Sueldos directivos','gasto','Gastos operativos',array['JOSE ROSALES','JOSE ROS'],true),
('00000000-0000-0000-0000-000000000001','6.1.01.02','Sueldos administrativos','gasto','Gastos operativos',null,true),
('00000000-0000-0000-0000-000000000001','6.1.01.06','Comisiones bancarias','gasto','Gastos operativos',array['SERVICE CHARGE','ACCT ANALYSIS','MONTHLY MAINTENANCE'],true),
('00000000-0000-0000-0000-000000000001','2.1.01.01','Impuestos por pagar','impuesto','Impuestos',array['LEGACY L','IRS','EFTPS'],true),
('00000000-0000-0000-0000-000000000001','6.1.01.90','Gasto no deducible (registro)','nd','No deducibles',array['NETFLIX','SPOTIFY','APPLE.COM','APPLE COM','AFTERPAY','IDENTITYIQ'],false)
on conflict do nothing;

-- Reglas de clasificación inicial
insert into classification_rules (company_id, pattern, account_id, priority)
select '00000000-0000-0000-0000-000000000001', kw, a.id, 10
from accounts a, unnest(a.keywords) as kw
where a.company_id = '00000000-0000-0000-0000-000000000001'
  and a.keywords is not null
on conflict do nothing;
