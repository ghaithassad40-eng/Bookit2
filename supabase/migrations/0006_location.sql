-- ============================================================
-- Bookit — Business location columns
-- ============================================================
-- Adds optional address + map coordinates so the customer site can
-- show "Find us" with a map and turn-by-turn directions, and so the
-- payment UI can reason about regional methods (KNET in KW, MADA in
-- SA, UAE Cards in AE, etc.).

alter table public.businesses
  add column if not exists address      text,
  add column if not exists city         text,
  add column if not exists country      text,                 -- ISO 3166-1 alpha-2
  add column if not exists postal_code  text,
  add column if not exists lat          numeric(9,6),
  add column if not exists lng          numeric(9,6),
  add column if not exists phone        text,
  add column if not exists website      text,
  add column if not exists timezone     text;

create index if not exists businesses_country_idx on public.businesses(country);
create index if not exists businesses_geo_idx     on public.businesses(lat, lng);
