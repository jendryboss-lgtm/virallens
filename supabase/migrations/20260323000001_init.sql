-- ViralLens initial schema: profiles, analyses, events, subscriptions, usage
-- RLS enabled; private videos bucket policies

create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type public.platform_pref as enum ('tiktok', 'instagram_reels', 'youtube_shorts', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.niche_pref as enum (
    'comedy', 'education', 'lifestyle', 'fitness', 'beauty',
    'food', 'gaming', 'business', 'tech', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.experience_level as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.growth_goal as enum ('followers', 'engagement', 'views', 'sales', 'brand_awareness');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.analysis_status as enum (
    'pending_upload', 'uploaded', 'queued', 'processing', 'completed', 'failed', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum (
    'inactive', 'trialing', 'active', 'past_due', 'canceled', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_type as enum ('none', 'trial', 'monthly', 'annual');
exception when duplicate_object then null; end $$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  platform public.platform_pref,
  niche public.niche_pref,
  experience public.experience_level,
  growth_goal public.growth_goal,
  onboarding_completed boolean not null default false,
  ai_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Analyses
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.analysis_status not null default 'pending_upload',
  storage_path text,
  mime_type text,
  duration_seconds numeric,
  size_bytes bigint,
  platform_hint text,
  result jsonb,
  error_message text,
  video_expires_at timestamptz,
  video_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists analyses_user_id_created_at_idx
  on public.analyses (user_id, created_at desc);
create index if not exists analyses_status_idx on public.analyses (status);
create index if not exists analyses_video_expires_at_idx
  on public.analyses (video_expires_at)
  where video_deleted_at is null;

-- Analysis events (audit / realtime breadcrumbs)
create table if not exists public.analysis_events (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  status public.analysis_status not null,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists analysis_events_analysis_id_idx
  on public.analysis_events (analysis_id, created_at desc);

-- Subscriptions (server truth from RevenueCat webhook)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  status public.subscription_status not null default 'inactive',
  plan public.plan_type not null default 'none',
  product_id text,
  rc_app_user_id text,
  entitlement_active boolean not null default false,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_entitlement_active_idx
  on public.subscriptions (entitlement_active);

-- Usage quotas per billing period
create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  analyses_used integer not null default 0 check (analyses_used >= 0),
  plan public.plan_type not null default 'none',
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index if not exists usage_user_period_idx
  on public.usage (user_id, period_start, period_end);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists analyses_set_updated_at on public.analyses;
create trigger analyses_set_updated_at
  before update on public.analyses
  for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists usage_set_updated_at on public.usage;
create trigger usage_set_updated_at
  before update on public.usage
  for each row execute function public.set_updated_at();

-- Auto-create profile + empty subscription on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Append analysis_events on status change
create or replace function public.log_analysis_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.analysis_events (analysis_id, status, message)
    values (new.id, new.status, new.error_message);
  end if;
  return new;
end;
$$;

drop trigger if exists analyses_log_status on public.analyses;
create trigger analyses_log_status
  after insert or update of status on public.analyses
  for each row execute function public.log_analysis_status();

-- RLS
alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Analyses policies
drop policy if exists "analyses_select_own" on public.analyses;
create policy "analyses_select_own" on public.analyses
  for select using (auth.uid() = user_id);

drop policy if exists "analyses_insert_own" on public.analyses;
create policy "analyses_insert_own" on public.analyses
  for insert with check (auth.uid() = user_id);

drop policy if exists "analyses_update_own" on public.analyses;
create policy "analyses_update_own" on public.analyses
  for update using (auth.uid() = user_id);

drop policy if exists "analyses_delete_own" on public.analyses;
create policy "analyses_delete_own" on public.analyses
  for delete using (auth.uid() = user_id);

-- Events: read own via join ownership
drop policy if exists "events_select_own" on public.analysis_events;
create policy "events_select_own" on public.analysis_events
  for select using (
    exists (
      select 1 from public.analyses a
      where a.id = analysis_id and a.user_id = auth.uid()
    )
  );

-- Subscriptions: users can read; only service role writes (no user update policy)
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Usage: users can read; service role writes
drop policy if exists "usage_select_own" on public.usage;
create policy "usage_select_own" on public.usage
  for select using (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.analyses;

-- Storage bucket: private videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,
  104857600,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: path must start with user id
drop policy if exists "videos_select_own" on storage.objects;
create policy "videos_select_own" on storage.objects
  for select using (
    bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "videos_insert_own" on storage.objects;
create policy "videos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "videos_update_own" on storage.objects;
create policy "videos_update_own" on storage.objects
  for update using (
    bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "videos_delete_own" on storage.objects;
create policy "videos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]
  );
