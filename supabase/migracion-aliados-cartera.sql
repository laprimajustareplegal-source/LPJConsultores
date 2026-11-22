-- Migración 21/11/2026: portal de aliados, cartera y comisiones. Se puede ejecutar varias veces.
-- Modelo: el aliado es el dueño (usuario_id) de las solicitudes, pólizas y documentos de sus clientes;
-- cada registro guarda el cliente (empresa y NIT). El cliente del aliado no tiene cuenta con LPJ.

-- ---------- Aliados ----------
create table if not exists public.aliados (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  porcentaje numeric(5, 2),            -- porcentaje de la comisión que se le gira al aliado (ej. 60)
  creado timestamptz not null default now()
);

create or replace function public.es_aliado()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.aliados where usuario_id = auth.uid());
$$;

-- ---------- Cliente del aliado en solicitudes, pólizas y archivos ----------
alter table public.solicitudes add column if not exists cliente_nit text check (char_length(cliente_nit) <= 40);
alter table public.polizas     add column if not exists cliente text check (char_length(cliente) <= 200);
alter table public.polizas     add column if not exists cliente_nit text check (char_length(cliente_nit) <= 40);
alter table public.archivos    add column if not exists cliente_nit text check (char_length(cliente_nit) <= 40);

-- ---------- Cartera (cuotas y pagos por póliza) ----------
create table if not exists public.cartera (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,   -- cliente directo o aliado
  poliza_id uuid references public.polizas (id) on delete cascade,
  cliente text check (char_length(cliente) <= 200),
  concepto text not null check (char_length(concepto) <= 200),             -- "Contado", "Cuota 2 de 11 (Finesa)"…
  valor numeric(14, 0) not null,
  fecha_limite date,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'anulada')),
  fecha_pago date,
  medio text check (char_length(medio) <= 200),                            -- link, PSE, financiera…
  nota text check (char_length(nota) <= 1000),
  creado timestamptz not null default now()
);
create index if not exists cartera_usuario_idx on public.cartera (usuario_id);
create index if not exists cartera_poliza_idx on public.cartera (poliza_id);

-- ---------- Comisiones del aliado ----------
create table if not exists public.comisiones (
  id uuid primary key default gen_random_uuid(),
  aliado_id uuid not null references auth.users (id) on delete cascade,
  poliza_id uuid references public.polizas (id) on delete set null,
  cliente text check (char_length(cliente) <= 200),
  aseguradora text check (char_length(aseguradora) <= 80),
  prima numeric(14, 0),                 -- prima sin IVA sobre la que se liquida
  porcentaje numeric(5, 2),             -- porcentaje que le corresponde al aliado
  valor numeric(14, 0) not null,        -- valor a girar al aliado
  estado text not null default 'causada' check (estado in ('causada', 'recibida', 'girada')),
  fecha_girada date,
  nota text check (char_length(nota) <= 1000),
  creado timestamptz not null default now()
);
create index if not exists comisiones_aliado_idx on public.comisiones (aliado_id);

-- ---------- Seguridad ----------
alter table public.aliados    enable row level security;
alter table public.cartera    enable row level security;
alter table public.comisiones enable row level security;

drop policy if exists aliados_ver on public.aliados;
create policy aliados_ver on public.aliados for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_asesor());
drop policy if exists aliados_asesor on public.aliados;
create policy aliados_asesor on public.aliados for all to authenticated
  using (public.es_asesor()) with check (public.es_asesor());

drop policy if exists cartera_ver on public.cartera;
create policy cartera_ver on public.cartera for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_asesor());
drop policy if exists cartera_asesor on public.cartera;
create policy cartera_asesor on public.cartera for all to authenticated
  using (public.es_asesor()) with check (public.es_asesor());

drop policy if exists comisiones_ver on public.comisiones;
create policy comisiones_ver on public.comisiones for select to authenticated
  using (aliado_id = (select auth.uid()) or public.es_asesor());
drop policy if exists comisiones_asesor on public.comisiones;
create policy comisiones_asesor on public.comisiones for all to authenticated
  using (public.es_asesor()) with check (public.es_asesor());

revoke all on public.aliados, public.cartera, public.comisiones from anon, authenticated;
grant select, insert, update, delete on public.aliados, public.cartera, public.comisiones to authenticated;
grant insert (cliente_nit) on public.solicitudes to authenticated;
grant insert (cliente_nit) on public.archivos to authenticated;

revoke all on function public.es_aliado() from public, anon;
grant execute on function public.es_aliado() to authenticated;

notify pgrst, 'reload schema';
