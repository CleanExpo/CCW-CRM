-- =============================================================================
-- Migration: Workshop Digital Job Cards — Phase 1 (UNI-1825)
-- Description: Adds job_cards and time_logs tables for workshop labour tracking.
--              Parts consumption is a separate phase.
-- =============================================================================

-- Job card status enum
do $$ begin
    create type jobcardstatus as enum ('open', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- Job cards table
create table if not exists public.job_cards (
    id                  uuid            primary key default gen_random_uuid(),
    job_number          varchar(20)     not null unique,
    booking_id          uuid            references public.workshop_bookings(id) on delete set null,
    service_request_id  uuid            references public.service_requests(id) on delete set null,
    equipment_id        uuid            references public.equipment(id) on delete set null,
    title               varchar(200)    not null,
    description         text,
    status              jobcardstatus   not null default 'open',
    assigned_technician varchar(200),
    created_at          timestamptz     not null default now(),
    updated_at          timestamptz     not null default now()
);

create index if not exists ix_job_cards_job_number    on public.job_cards(job_number);
create index if not exists ix_job_cards_booking_id    on public.job_cards(booking_id);
create index if not exists ix_job_cards_equipment_id  on public.job_cards(equipment_id);
create index if not exists ix_job_cards_status        on public.job_cards(status);

-- Time logs table
create table if not exists public.time_logs (
    id               uuid         primary key default gen_random_uuid(),
    job_card_id      uuid         not null references public.job_cards(id) on delete cascade,
    technician_name  varchar(200) not null,
    started_at       timestamptz  not null,
    stopped_at       timestamptz,
    duration_minutes float,
    notes            text,
    created_at       timestamptz  not null default now(),
    updated_at       timestamptz  not null default now()
);

create index if not exists ix_time_logs_job_card_id on public.time_logs(job_card_id);
create index if not exists ix_time_logs_started_at  on public.time_logs(started_at);

-- updated_at triggers (reuse existing function if present, else create it)
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_job_cards_updated_at on public.job_cards;
create trigger set_job_cards_updated_at
    before update on public.job_cards
    for each row execute function public.handle_updated_at();

drop trigger if exists set_time_logs_updated_at on public.time_logs;
create trigger set_time_logs_updated_at
    before update on public.time_logs
    for each row execute function public.handle_updated_at();

-- Row Level Security
alter table public.job_cards enable row level security;
alter table public.time_logs  enable row level security;

-- Authenticated staff can read and write all job cards (internal workshop tool)
create policy "authenticated_select_job_cards"
    on public.job_cards for select
    to authenticated
    using (true);

create policy "authenticated_insert_job_cards"
    on public.job_cards for insert
    to authenticated
    with check (true);

create policy "authenticated_update_job_cards"
    on public.job_cards for update
    to authenticated
    using (true)
    with check (true);

-- Service role has full access (backend API)
create policy "service_role_job_cards"
    on public.job_cards for all
    to service_role
    using (true)
    with check (true);

create policy "authenticated_select_time_logs"
    on public.time_logs for select
    to authenticated
    using (true);

create policy "authenticated_insert_time_logs"
    on public.time_logs for insert
    to authenticated
    with check (true);

create policy "authenticated_update_time_logs"
    on public.time_logs for update
    to authenticated
    using (true)
    with check (true);

create policy "service_role_time_logs"
    on public.time_logs for all
    to service_role
    using (true)
    with check (true);
