-- IAMTRADER Phase 1 — PostgreSQL/Supabase foundation
-- Financial values use NUMERIC rather than floating-point types.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER','ADMIN','MEMBER','VIEWER')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  broker text,
  prop_firm text,
  account_type text not null default 'PERSONAL' check (account_type in ('PERSONAL','DEMO','PROP_EVALUATION','FUNDED','SIMULATION')),
  initial_balance numeric(20,8) not null check (initial_balance >= 0),
  current_balance numeric(20,8) not null default 0,
  current_equity numeric(20,8) not null default 0,
  currency char(3) not null default 'USD',
  leverage numeric(12,4),
  default_risk_percent numeric(10,4),
  daily_loss_limit numeric(20,8),
  max_drawdown numeric(20,8),
  profit_target numeric(20,8),
  timezone text not null default 'UTC',
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  symbol text not null,
  direction text not null check (direction in ('BUY','SELL')),
  entry_time timestamptz not null,
  entry_price numeric(30,12) not null,
  quantity numeric(30,12) not null check (quantity > 0),
  stop_loss numeric(30,12) not null,
  take_profit numeric(30,12) not null,
  exit_time timestamptz,
  exit_price numeric(30,12),
  exit_reason text,
  contract_multiplier numeric(30,12) not null default 1 check (contract_multiplier > 0),
  gross_pnl numeric(30,12),
  commission numeric(30,12) not null default 0,
  swap numeric(30,12) not null default 0,
  fees numeric(30,12) not null default 0,
  net_pnl numeric(30,12),
  initial_risk_amount numeric(30,12),
  risk_percent numeric(20,8),
  rr_planned numeric(20,8),
  r_multiple numeric(20,8),
  result text check (result in ('WIN','LOSS','BE')),
  note text,
  emotion text,
  entry_reason text,
  timeframe text,
  session text,
  kill_zone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (stop_loss <> entry_price),
  check (exit_price is null or exit_time is not null)
);

create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_accounts_workspace on public.accounts(workspace_id);
create index if not exists idx_trades_account_entry_time on public.trades(account_id, entry_time desc);
create index if not exists idx_trades_symbol on public.trades(symbol);
create index if not exists idx_trades_result on public.trades(result);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.accounts enable row level security;
alter table public.trades enable row level security;

-- Policies intentionally keep access scoped through workspace membership.
create policy "workspace members can read workspace"
on public.workspaces for select
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = id and wm.user_id = auth.uid()
));

create policy "members can read accounts"
on public.accounts for select
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id = accounts.workspace_id and wm.user_id = auth.uid()
));

create policy "members can read trades"
on public.trades for select
using (exists (
  select 1
  from public.accounts a
  join public.workspace_members wm on wm.workspace_id = a.workspace_id
  where a.id = trades.account_id and wm.user_id = auth.uid()
));
