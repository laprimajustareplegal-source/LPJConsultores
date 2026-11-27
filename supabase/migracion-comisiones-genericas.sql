-- Migración 26/11/2026: comisión genérica por ramo que el asesor IA le muestra a quien quiere ser aliado,
-- para que calcule cuánto ganaría. NO son las comisiones reales de cada aseguradora: es una referencia
-- que fijan los administradores de la agencia en el panel (Aliados). El aliado ve el 60 % de este valor.
-- Se puede ejecutar varias veces.

create table if not exists public.comisiones_genericas (
  ramo text primary key,
  porcentaje numeric(5,2) check (porcentaje is null or (porcentaje >= 0 and porcentaje <= 100)),
  nota text,
  orden int not null default 100,
  actualizado timestamptz not null default now()
);

alter table public.comisiones_genericas enable row level security;

-- Es información pública (se muestra en el chat de la página): cualquiera la lee; solo el administrador la cambia.
drop policy if exists comgen_leer on public.comisiones_genericas;
create policy comgen_leer on public.comisiones_genericas for select to anon, authenticated using (true);
drop policy if exists comgen_admin on public.comisiones_genericas;
create policy comgen_admin on public.comisiones_genericas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
grant select on public.comisiones_genericas to anon, authenticated;
grant insert, update, delete on public.comisiones_genericas to authenticated;

-- Ramos de partida, sin porcentaje: los llenan los administradores en el panel.
insert into public.comisiones_genericas (ramo, orden) values
  ('Autos', 10), ('PYME / multirriesgo', 20), ('Hogar', 30), ('Cumplimiento', 40),
  ('Responsabilidad civil', 50), ('Transporte', 60), ('Vida grupo y accidentes personales', 70),
  ('Vida individual', 80), ('Salud', 90), ('ARL', 100), ('SOAT', 110)
on conflict (ramo) do nothing;
