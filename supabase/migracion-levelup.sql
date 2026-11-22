-- Migración 22/11/2026: copia diaria de LevelUp (Broker UP) en la plataforma.
-- LevelUp sigue siendo la base oficial. Estas tablas las llena SOLO la sincronización
-- (función de Vercel con la clave de servicio); nadie las edita desde la página.
-- Quién ve qué:
--   equipo LPJ: todo
--   cliente con cuenta: solo lo del cliente de LevelUp al que el equipo vinculó su cuenta
--   aliado: solo lo que en LevelUp tiene su nombre de aliado (lo vincula el administrador)
-- Se puede ejecutar varias veces.

create table if not exists public.lu_clientes (
  id_cliente bigint primary key,
  identificacion text,
  nombre text,
  aliado text,
  comercial text,
  estado text,
  email text,
  celular text,
  ciudad text,
  es_prospecto boolean,
  datos jsonb not null default '{}'::jsonb,
  visto timestamptz not null default now()
);
create index if not exists lu_clientes_ident_idx on public.lu_clientes (identificacion);
create index if not exists lu_clientes_aliado_idx on public.lu_clientes (aliado);

create table if not exists public.lu_polizas (
  id_poliza bigint primary key,
  id_cliente bigint,
  numero text,
  aseguradora text,
  ramo text,
  tomador text,
  asegurado text,
  beneficiario text,
  identificacion text,
  desde date,
  hasta date,
  estado text,
  placa text,
  prima numeric(16, 2),
  comision numeric(16, 2),
  pct_comision numeric(7, 3),
  comercial text,
  aliado text,
  vigente_en_levelup boolean not null default true,
  datos jsonb not null default '{}'::jsonb,
  visto timestamptz not null default now()
);
create index if not exists lu_polizas_cliente_idx on public.lu_polizas (id_cliente);
create index if not exists lu_polizas_hasta_idx on public.lu_polizas (hasta);
create index if not exists lu_polizas_aliado_idx on public.lu_polizas (aliado);

-- Remisiones (cobros) pendientes de pago: se reemplaza completa en cada sincronización.
create table if not exists public.lu_cartera (
  id_produccion bigint primary key,
  id_poliza bigint,
  id_cliente_tomador bigint,
  numero_remision text,
  numero_poliza text,
  aseguradora text,
  ramo text,
  tomador text,
  identificacion text,
  cuota text,
  fecha_remision date,
  fecha_max_pago date,
  total numeric(16, 2),
  pagado numeric(16, 2),
  saldo numeric(16, 2),
  saldo_comision numeric(16, 2),
  dias int,
  aliado text,
  datos jsonb not null default '{}'::jsonb,
  visto timestamptz not null default now()
);
create index if not exists lu_cartera_poliza_idx on public.lu_cartera (id_poliza);

create table if not exists public.lu_reclamos (
  id_reclamo bigint primary key,
  id_poliza bigint,
  id_cliente bigint,
  numero text,
  numero_compania text,
  aseguradora text,
  ramo text,
  numero_poliza text,
  tomador text,
  amparo text,
  estado text,
  fecha_suceso date,
  fecha_aviso date,
  valor_pagado numeric(16, 2),
  reserva numeric(16, 2),
  datos jsonb not null default '{}'::jsonb,
  visto timestamptz not null default now()
);

create table if not exists public.lu_sincronizaciones (
  id bigint generated always as identity primary key,
  inicio timestamptz not null default now(),
  fin timestamptz,
  ok boolean,
  resumen jsonb,
  error text
);

-- Vínculos: cuenta de la página ↔ cliente de LevelUp (lo hace el equipo) y aliado ↔ nombre de aliado en LevelUp.
create table if not exists public.cuentas_levelup (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  id_cliente bigint not null,
  vinculado_por uuid references auth.users (id),
  creado timestamptz not null default now()
);
alter table public.aliados add column if not exists levelup_nombre text;

-- ¿Qué cliente de LevelUp es el usuario que llama? ¿Con qué nombre aparece como aliado?
create or replace function public.mi_cliente_levelup()
returns bigint language sql stable security definer set search_path = ''
as $$ select id_cliente from public.cuentas_levelup where usuario_id = auth.uid(); $$;

create or replace function public.mi_nombre_aliado_levelup()
returns text language sql stable security definer set search_path = ''
as $$ select nullif(upper(trim(levelup_nombre)), '') from public.aliados where usuario_id = auth.uid(); $$;

grant execute on function public.mi_cliente_levelup() to authenticated;
grant execute on function public.mi_nombre_aliado_levelup() to authenticated;

-- ---------- Permisos ----------
alter table public.lu_clientes enable row level security;
alter table public.lu_polizas enable row level security;
alter table public.lu_cartera enable row level security;
alter table public.lu_reclamos enable row level security;
alter table public.lu_sincronizaciones enable row level security;
alter table public.cuentas_levelup enable row level security;

revoke all on public.lu_clientes, public.lu_polizas, public.lu_cartera, public.lu_reclamos,
              public.lu_sincronizaciones, public.cuentas_levelup from anon, authenticated;
grant select on public.lu_clientes, public.lu_polizas, public.lu_cartera, public.lu_reclamos,
                public.lu_sincronizaciones, public.cuentas_levelup to authenticated;
grant insert, update, delete on public.cuentas_levelup to authenticated;

drop policy if exists lu_clientes_ver on public.lu_clientes;
create policy lu_clientes_ver on public.lu_clientes for select to authenticated using (
  public.es_asesor()
  or id_cliente = public.mi_cliente_levelup()
  or upper(trim(aliado)) = public.mi_nombre_aliado_levelup());

drop policy if exists lu_polizas_ver on public.lu_polizas;
create policy lu_polizas_ver on public.lu_polizas for select to authenticated using (
  public.es_asesor()
  or id_cliente = public.mi_cliente_levelup()
  or upper(trim(aliado)) = public.mi_nombre_aliado_levelup());

drop policy if exists lu_cartera_ver on public.lu_cartera;
create policy lu_cartera_ver on public.lu_cartera for select to authenticated using (
  public.es_asesor()
  or id_cliente_tomador = public.mi_cliente_levelup()
  or upper(trim(aliado)) = public.mi_nombre_aliado_levelup());

drop policy if exists lu_reclamos_ver on public.lu_reclamos;
create policy lu_reclamos_ver on public.lu_reclamos for select to authenticated using (
  public.es_asesor() or id_cliente = public.mi_cliente_levelup());

drop policy if exists lu_sinc_ver on public.lu_sincronizaciones;
create policy lu_sinc_ver on public.lu_sincronizaciones for select to authenticated using (public.es_asesor());

drop policy if exists cuentas_lu_ver on public.cuentas_levelup;
create policy cuentas_lu_ver on public.cuentas_levelup for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_asesor());
drop policy if exists cuentas_lu_equipo on public.cuentas_levelup;
create policy cuentas_lu_equipo on public.cuentas_levelup for all to authenticated
  using (public.es_asesor()) with check (public.es_asesor());

-- Resumen del administrador con las cifras de LevelUp.
create or replace function public.resumen_levelup()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_asesor() then raise exception 'Solo el equipo'; end if;
  return jsonb_build_object(
    'clientes', (select count(*) from public.lu_clientes where not coalesce(es_prospecto, false)),
    'polizas', (select count(*) from public.lu_polizas where vigente_en_levelup),
    'vencen_30', (select count(*) from public.lu_polizas where vigente_en_levelup and hasta between current_date and current_date + 30),
    'vencen_60', (select count(*) from public.lu_polizas where vigente_en_levelup and hasta between current_date and current_date + 60),
    'cartera_saldo', (select coalesce(sum(saldo), 0) from public.lu_cartera),
    'cartera_vencida', (select coalesce(sum(saldo), 0) from public.lu_cartera where fecha_max_pago < current_date),
    'cartera_cuotas', (select count(*) from public.lu_cartera),
    'reclamos_abiertos', (select count(*) from public.lu_reclamos where coalesce(estado, '') not ilike '%cerrad%'),
    'ultima_sync', (select fin from public.lu_sincronizaciones where ok order by id desc limit 1)
  );
end;
$$;
grant execute on function public.resumen_levelup() to authenticated;
