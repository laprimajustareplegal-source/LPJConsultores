-- Migración 21/11/2026: equipo LPJ (administrador y empleados) y registro de las conversaciones del chat.
-- Se puede ejecutar varias veces.

-- ---------- Equipo: rol de cada cuenta del equipo ----------
-- admin: ve el resumen de todo (cuentas, chat IA, aliados) y administra equipo y aliados.
-- empleado: atiende solicitudes en el panel.
alter table public.asesores add column if not exists rol text not null default 'empleado';
do $$ begin
  alter table public.asesores add constraint asesores_rol_chk check (rol in ('admin', 'empleado'));
exception when duplicate_object then null; end $$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.asesores where usuario_id = auth.uid() and rol = 'admin');
$$;
grant execute on function public.es_admin() to authenticated;

-- El equipo se ve entre sí; solo el administrador agrega, cambia o quita.
drop policy if exists asesores_ver on public.asesores;
create policy asesores_ver on public.asesores for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_asesor());
drop policy if exists asesores_admin on public.asesores;
create policy asesores_admin on public.asesores for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
grant insert, update, delete on public.asesores to authenticated;

-- Solo el administrador cambia aliados y porcentajes.
drop policy if exists aliados_asesor on public.aliados;
drop policy if exists aliados_equipo_ver on public.aliados;
create policy aliados_equipo_ver on public.aliados for select to authenticated using (public.es_asesor());
drop policy if exists aliados_admin on public.aliados;
create policy aliados_admin on public.aliados for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------- Conversaciones del chat de la página ----------
-- Cada conversación (con o sin cuenta) se guarda para que el equipo la vea. Nadie de afuera puede leerlas.
create table if not exists public.chat_sesiones (
  id uuid primary key,
  usuario_id uuid references auth.users (id) on delete set null,
  pagina text,
  tema text,
  mensajes jsonb not null default '[]'::jsonb,
  n_mensajes int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists chat_sesiones_act_idx on public.chat_sesiones (actualizado desc);
alter table public.chat_sesiones enable row level security;
revoke all on public.chat_sesiones from anon, authenticated;
grant select on public.chat_sesiones to authenticated;
drop policy if exists chat_equipo_ver on public.chat_sesiones;
create policy chat_equipo_ver on public.chat_sesiones for select to authenticated using (public.es_asesor());

-- La página guarda la conversación por esta función (con límites de tamaño); no puede leer ni borrar nada.
create or replace function public.registrar_chat(p_id uuid, p_mensajes jsonb, p_pagina text default null, p_tema text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_id is null or jsonb_typeof(p_mensajes) <> 'array' then return; end if;
  if jsonb_array_length(p_mensajes) > 300 or length(p_mensajes::text) > 120000 then return; end if;
  insert into public.chat_sesiones (id, usuario_id, pagina, tema, mensajes, n_mensajes)
  values (p_id, auth.uid(), left(p_pagina, 200), left(p_tema, 120), p_mensajes, jsonb_array_length(p_mensajes))
  on conflict (id) do update
    set mensajes = excluded.mensajes,
        n_mensajes = excluded.n_mensajes,
        tema = coalesce(excluded.tema, public.chat_sesiones.tema),
        usuario_id = coalesce(public.chat_sesiones.usuario_id, excluded.usuario_id),
        actualizado = now()
    where public.chat_sesiones.creado > now() - interval '2 days';
end;
$$;
revoke all on function public.registrar_chat(uuid, jsonb, text, text) from public;
grant execute on function public.registrar_chat(uuid, jsonb, text, text) to anon, authenticated;

-- Resumen para el administrador.
create or replace function public.resumen_admin()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador'; end if;
  return jsonb_build_object(
    'cuentas', (select count(*) from public.perfiles),
    'cuentas_7d', (select count(*) from public.perfiles where creado > now() - interval '7 days'),
    'aliados', (select count(*) from public.aliados),
    'equipo', (select count(*) from public.asesores),
    'solicitudes', (select count(*) from public.solicitudes),
    'solicitudes_7d', (select count(*) from public.solicitudes where creado > now() - interval '7 days'),
    'por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb) from (select estado, count(*) n from public.solicitudes group by estado) x),
    'chats', (select count(*) from public.chat_sesiones),
    'chats_7d', (select count(*) from public.chat_sesiones where creado > now() - interval '7 days'),
    'chats_hoy', (select count(*) from public.chat_sesiones where creado > date_trunc('day', now()))
  );
end;
$$;
grant execute on function public.resumen_admin() to authenticated;
