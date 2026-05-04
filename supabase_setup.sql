-- 1. Create companies table
create table
  public.companies (
    id uuid not null default gen_random_uuid (),
    created_at timestamptz default now() not null,
    name text not null,
    logo text null,
    constraint companies_pkey primary key (id)
  ) tablespace pg_default;

-- 2. Create company_users table (join table for many-to-many relationship)
create table
  public.company_users (
    company_id uuid not null,
    user_id uuid not null,
    role text not null default 'member'::text,
    constraint company_users_pkey primary key (company_id, user_id),
    constraint company_users_company_id_fkey foreign key (company_id) references companies (id) on delete cascade,
    constraint company_users_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
  ) tablespace pg_default;

-- 3. Create projects table
create table
  public.projects (
    id uuid not null default gen_random_uuid (),
    company_id uuid not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    name text not null,
    projectNo text null,
    client text not null,
    supervisor text null,
    planner text null,
    status text not null default 'Setup'::text,
    budgetedCost numeric null,
    actualCost numeric null,
    revenue numeric null,
    progress integer null,
    startDate date null,
    targetCompletionDate date null,
    actualCompletionDate date null,
    clientBoq jsonb null,
    engineeringBoq jsonb null,
    materialBoq jsonb null,
    purchaseOrders jsonb null,
    dailyActivities jsonb null,
    materialRequisitions jsonb null,
    materialIssuances jsonb null,
    materialReturns jsonb null,
    clientClaims jsonb null,
    subconClaims jsonb null,
    teamCosts jsonb null,
    constraint projects_pkey primary key (id),
    constraint projects_company_id_fkey foreign key (company_id) references companies (id) on delete cascade
  ) tablespace pg_default;

-- 4. Create plant_units table
create table
  public.plant_units (
    id uuid not null default gen_random_uuid (),
    company_id uuid not null,
    created_at timestamptz default now() not null,
    description text not null,
    unit text not null,
    rate numeric not null,
    category text not null,
    materialManagementFee boolean null,
    clientName text null,
    constraint plant_units_pkey primary key (id),
    constraint plant_units_company_id_fkey foreign key (company_id) references companies (id) on delete cascade
  ) tablespace pg_default;

-- 5. Create in_house_teams table
create table
  public.in_house_teams (
    id uuid not null default gen_random_uuid (),
    company_id uuid not null,
    created_at timestamptz default now() not null,
    name text not null,
    members jsonb null,
    constraint in_house_teams_pkey primary key (id),
    constraint in_house_teams_company_id_fkey foreign key (company_id) references companies (id) on delete cascade
  ) tablespace pg_default;

-- 6. Create general_team_costs table
create table
  public.general_team_costs (
    id uuid not null default gen_random_uuid (),
    team_id uuid not null,
    created_at timestamptz default now() not null,
    month text not null,
    ppe numeric null,
    vehicleUpkeep numeric null,
    other numeric null,
    constraint general_team_costs_pkey primary key (id),
    constraint general_team_costs_team_id_fkey foreign key (team_id) references in_house_teams (id) on delete cascade
  ) tablespace pg_default;
  
-- POLICIES
-- Enable RLS for all tables
alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.projects enable row level security;
alter table public.plant_units enable row level security;
alter table public.in_house_teams enable row level security;
alter table public.general_team_costs enable row level security;

-- Policy: Users can see companies they are a member of.
create policy "Users can view companies they belong to"
on public.companies for select
using (auth.uid() in (
  select user_id from public.company_users where company_id = id
));

-- Policy: Users can see their own memberships.
create policy "Users can view their own company_users entries"
on public.company_users for select
using (auth.uid() = user_id);

-- Policy: Users can view projects of companies they are a member of.
create policy "Users can view projects for their companies"
on public.projects for select
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

-- Policy: Users can insert projects for companies they are a member of.
create policy "Users can insert projects for their companies"
on public.projects for insert
with check (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

-- Policy: Users can update projects for companies they are a member of.
create policy "Users can update projects for their companies"
on public.projects for update
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

-- Policy: Users can delete projects for companies they are a member of.
create policy "Users can delete projects for their companies"
on public.projects for delete
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

-- Policies for plant_units
create policy "Users can view plant units for their companies"
on public.plant_units for select
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

create policy "Users can insert plant units for their companies"
on public.plant_units for insert
with check (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

create policy "Users can update plant units for their companies"
on public.plant_units for update
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

create policy "Users can delete plant units for their companies"
on public.plant_units for delete
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

-- Policies for in_house_teams
create policy "Users can view in_house_teams for their companies"
on public.in_house_teams for select
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

create policy "Users can insert in_house_teams for their companies"
on public.in_house_teams for insert
with check (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

create policy "Users can update in_house_teams for their companies"
on public.in_house_teams for update
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

create policy "Users can delete in_house_teams for their companies"
on public.in_house_teams for delete
using (company_id in (
  select company_id from public.company_users where user_id = auth.uid()
));

-- Policies for general_team_costs
create policy "Users can view general_team_costs for their companies"
on public.general_team_costs for select
using (team_id in (
    select id from public.in_house_teams where company_id in (
        select company_id from public.company_users where user_id = auth.uid()
    )
));

create policy "Users can insert general_team_costs for their companies"
on public.general_team_costs for insert
with check (team_id in (
    select id from public.in_house_teams where company_id in (
        select company_id from public.company_users where user_id = auth.uid()
    )
));

create policy "Users can update general_team_costs for their companies"
on public.general_team_costs for update
using (team_id in (
    select id from public.in_house_teams where company_id in (
        select company_id from public.company_users where user_id = auth.uid()
    )
));

create policy "Users can delete general_team_costs for their companies"
on public.general_team_costs for delete
using (team_id in (
    select id from public.in_house_teams where company_id in (
        select company_id from public.company_users where user_id = auth.uid()
    )
));