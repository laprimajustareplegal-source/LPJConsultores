-- Preparación para integrar runers.ai (autos todo riesgo).
-- runers es la fuente de verdad de las pólizas de autos; LPJ guarda una copia para mostrarla
-- en el perfil del cliente y del aliado. Se enlaza por correo del usuario y por el id de runers.
-- Seguro de correr más de una vez.

alter table public.polizas add column if not exists origen text not null default 'lpj';   -- 'lpj' o 'runers'
alter table public.polizas add column if not exists externo_id text;                       -- id de la póliza en runers
alter table public.polizas add column if not exists placa text;                            -- solo autos
alter table public.polizas add column if not exists actualizado timestamptz not null default now();

create unique index if not exists polizas_origen_externo_idx
  on public.polizas (origen, externo_id) where externo_id is not null;

alter table public.cartera add column if not exists origen text not null default 'lpj';
alter table public.cartera add column if not exists externo_id text;
