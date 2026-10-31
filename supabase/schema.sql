-- Run in your own Supabase project's SQL editor. These are DEMO cost assumptions,
-- not market observations. No personal farmer data is stored.
create table if not exists public.seedhedge_demo_rates (
  region_id text not null,
  crop_id text not null default 'soybean',
  rates jsonb not null,
  note text not null,
  updated_at timestamptz not null default now(),
  primary key (region_id, crop_id),
  constraint valid_rates check (jsonb_typeof(rates) = 'object')
);
alter table public.seedhedge_demo_rates enable row level security;
revoke all on public.seedhedge_demo_rates from anon, authenticated;
grant select on public.seedhedge_demo_rates to anon, authenticated;
drop policy if exists public_read_demo_rates on public.seedhedge_demo_rates;
create policy public_read_demo_rates on public.seedhedge_demo_rates
  for select to anon, authenticated using (true);
-- Owner populates examples; browser clients cannot insert/update/delete.
insert into public.seedhedge_demo_rates(region_id,crop_id,rates,note) values
 ('akola','soybean','{"seedKgPerAcre":30,"seedPricePerKg":75,"laborPerAcre":850,"machineryPerAcre":1050,"mobilizationPerVisit":450,"otherPerVisit":0}', 'Editable illustration; not verified local prices'),
 ('jalna','soybean','{"seedKgPerAcre":30,"seedPricePerKg":75,"laborPerAcre":950,"machineryPerAcre":1150,"mobilizationPerVisit":500,"otherPerVisit":0}', 'Editable illustration; not verified local prices'),
 ('nagpur','soybean','{"seedKgPerAcre":30,"seedPricePerKg":75,"laborPerAcre":900,"machineryPerAcre":1100,"mobilizationPerVisit":550,"otherPerVisit":0}', 'Editable illustration; not verified local prices'),
 ('pune','soybean','{"seedKgPerAcre":30,"seedPricePerKg":75,"laborPerAcre":1100,"machineryPerAcre":1350,"mobilizationPerVisit":600,"otherPerVisit":0}', 'Editable illustration; not verified local prices')
on conflict (region_id,crop_id) do update
 set rates=excluded.rates,note=excluded.note,updated_at=now();
