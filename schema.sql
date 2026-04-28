create extension if not exists "pgcrypto";

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  line_user_id text unique,
  plan text not null default 'free',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete set null,
  topic text not null default 'general',
  name text,
  birth_date date,
  birth_time text,
  bazi_score integer not null,
  liuyao_score integer not null,
  total_score integer not null,
  diff_score integer not null,
  state text not null,
  free_summary text,
  full_report jsonb,
  is_paid boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  member_id uuid references members(id) on delete set null,
  report_id uuid references reports(id) on delete set null,
  product text not null default 'full_report',
  amount integer not null default 399,
  currency text not null default 'TWD',
  provider text not null default 'manual',
  provider_trade_no text,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists unlock_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  order_id uuid references orders(id) on delete cascade,
  report_id uuid references reports(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  product text not null default 'full_report',
  used boolean not null default false,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_member_id on reports(member_id);
create index if not exists idx_orders_order_no on orders(order_no);
create index if not exists idx_unlock_codes_code on unlock_codes(code);
create index if not exists idx_members_line_user_id on members(line_user_id);
