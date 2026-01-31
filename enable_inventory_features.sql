-- Enable Inventory & Warehouse Management Features
-- Run this SQL in your Supabase SQL Editor to set up the necessary tables and columns

-- 1. Locations Management
create table if not exists locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text check (type in ('WAREHOUSE', 'BRANCH', 'ROASTERY')),
  address text,
  contact_person_name text,
  contact_person_phone text,
  contact_person_email text,
  is_active boolean default true,
  is_roastery boolean default false,
  created_at timestamptz default now()
);

-- 2. Stock Transfers
create table if not exists stock_transfers (
  id uuid default gen_random_uuid() primary key,
  source_location_id uuid references locations(id),
  destination_location_id uuid references locations(id),
  status text check (status in ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz default now(),
  received_at timestamptz,
  notes text,
  total_value numeric default 0,
  created_by uuid,
  manifest jsonb -- Storing items as JSON for simplicity: [{itemId, quantity, name, ...}]
);

-- 3. Stock Adjustments
create table if not exists stock_adjustments (
  id uuid default gen_random_uuid() primary key,
  location_id uuid references locations(id),
  item_id uuid references inventory_items(id),
  quantity numeric not null,
  reason text check (reason in ('DAMAGE', 'THEFT', 'COUNTING_ERROR', 'EXPIRY', 'OTHER')),
  notes text,
  status text check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz default now(),
  user_name text,
  user_id uuid,
  value numeric
);

-- 4. Enable RLS
alter table locations enable row level security;
create policy "Public read locations" on locations for select using (true);
create policy "Auth all locations" on locations for all using (auth.role() = 'authenticated');

alter table stock_transfers enable row level security;
create policy "Auth all transfers" on stock_transfers for all using (auth.role() = 'authenticated');

alter table stock_adjustments enable row level security;
create policy "Auth all adjustments" on stock_adjustments for all using (auth.role() = 'authenticated');

-- 5. Seed Initial Locations if empty
insert into locations (name, type, is_roastery, address)
select 'Central Roastery', 'ROASTERY', true, 'Industrial Area, Doha'
where not exists (select 1 from locations where type = 'ROASTERY');

insert into locations (name, type, is_roastery, address)
select 'Katara Branch', 'BRANCH', false, 'Katara Cultural Village'
where not exists (select 1 from locations where type = 'BRANCH');
