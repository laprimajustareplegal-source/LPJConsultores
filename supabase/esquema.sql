-- =====================================================================
-- La Prima Justa — Portal PYME
-- Base de datos para Supabase.
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar TODO este archivo > Run.
-- Se puede volver a ejecutar sin perder datos.
-- =====================================================================

-- ---------- Asesores (quién puede ver y gestionar todas las solicitudes) ----------
-- Solo se agregan desde el SQL Editor; ningún usuario puede volverse asesor por su cuenta.
create table if not exists public.asesores (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  creado timestamptz not null default now()
);

create or replace function public.es_asesor()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.asesores where usuario_id = auth.uid());
$$;

-- ---------- Perfiles de clientes ----------
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text,
  nombre text,
  celular text,
  empresa text,
  nit text,
  autoriza_datos timestamptz,
  creado timestamptz not null default now()
);

-- Crea el perfil cuando alguien se registra. Nunca bloquea el registro.
create or replace function public.crear_perfil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    insert into public.perfiles (id, correo, nombre, celular, empresa, nit, autoriza_datos)
    values (
      new.id,
      new.email,
      left(new.raw_user_meta_data ->> 'nombre', 200),
      left(new.raw_user_meta_data ->> 'celular', 40),
      left(new.raw_user_meta_data ->> 'empresa', 200),
      left(new.raw_user_meta_data ->> 'nit', 40),
      case when (new.raw_user_meta_data ->> 'autoriza') = 'true' then now() end
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'No se pudo crear el perfil de %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Si Supabase no permitiera crear el disparador, el resto se instala igual:
-- el perfil se crea entonces en el primer ingreso (función mi_perfil).
do $$
begin
  create or replace trigger al_crear_usuario
    after insert on auth.users
    for each row execute function public.crear_perfil();
exception when others then
  raise warning 'No se pudo crear el disparador en auth.users: %', sqlerrm;
end $$;

-- Devuelve el perfil de quien llama (lo crea si faltara) y registra la autorización de datos.
create or replace function public.mi_perfil(p_autoriza boolean default false)
returns public.perfiles
language plpgsql security definer set search_path = ''
as $$
declare
  p public.perfiles;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  insert into public.perfiles (id, correo)
    select u.id, u.email from auth.users u where u.id = auth.uid()
    on conflict (id) do nothing;
  if p_autoriza then
    update public.perfiles set autoriza_datos = now() where id = auth.uid() and autoriza_datos is null;
  end if;
  select * into p from public.perfiles where id = auth.uid();
  return p;
end;
$$;

-- ---------- Solicitudes ----------
create table if not exists public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null default 'cotizacion'
    check (tipo in ('cotizacion', 'mejora', 'renovacion', 'otra')),
  estado text not null default 'recibida'
    check (estado in ('recibida', 'en_analisis', 'cotizada', 'ajustes_solicitados',
                      'emision_solicitada', 'en_emision', 'pago_pendiente',
                      'pago_reportado', 'vigente', 'cancelada')),
  empresa text check (char_length(empresa) <= 200),
  datos jsonb not null default '[]'::jsonb check (octet_length(datos::text) <= 20000),
  ajustes jsonb not null default '[]'::jsonb check (octet_length(ajustes::text) <= 20000),
  opcion_elegida text,
  link_pago text,
  referencia_pago text,
  atencion boolean not null default true,   -- true = el cliente hizo algo y el asesor aún no responde
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
alter table public.solicitudes add column if not exists atencion boolean not null default true;
create index if not exists solicitudes_usuario_idx on public.solicitudes (usuario_id);
create index if not exists solicitudes_estado_idx on public.solicitudes (estado);

-- ---------- Historial de estados ----------
create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  estado text not null,
  nota text,
  autor text not null default 'sistema' check (autor in ('cliente', 'asesor', 'sistema')),
  creado timestamptz not null default now()
);
create index if not exists eventos_solicitud_idx on public.eventos (solicitud_id);

create or replace function public.evento_inicial()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.eventos (solicitud_id, estado, nota, autor)
  values (new.id, new.estado, 'Solicitud recibida.', 'sistema');
  return new;
end;
$$;

create or replace trigger al_crear_solicitud
  after insert on public.solicitudes
  for each row execute function public.evento_inicial();

-- ---------- Archivos (pólizas actuales, contratos, cotizaciones, recibos) ----------
create table if not exists public.archivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  solicitud_id uuid references public.solicitudes (id) on delete cascade,
  ruta text not null,
  nombre text not null check (char_length(nombre) <= 300),
  tipo text not null default 'otro'
    check (tipo in ('poliza_actual', 'contrato', 'cotizacion', 'poliza_emitida',
                    'recibo_pago', 'comprobante_pago', 'documento_cliente', 'otro')),
  subido_por text not null default 'cliente' check (subido_por in ('cliente', 'asesor')),
  creado timestamptz not null default now()
);
create index if not exists archivos_solicitud_idx on public.archivos (solicitud_id);
create index if not exists archivos_usuario_idx on public.archivos (usuario_id);

-- ---------- Conversaciones ----------
create table if not exists public.mensajes (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  solicitud_id uuid references public.solicitudes (id) on delete set null,
  rol text not null check (rol in ('cliente', 'asistente', 'asesor')),
  texto text not null check (char_length(texto) <= 8000),
  creado timestamptz not null default now()
);
create index if not exists mensajes_usuario_idx on public.mensajes (usuario_id);
create index if not exists mensajes_solicitud_idx on public.mensajes (solicitud_id);

-- ---------- Pólizas emitidas ----------
create table if not exists public.polizas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  solicitud_id uuid references public.solicitudes (id) on delete set null,
  aseguradora text not null,
  numero text,
  ramo text not null default 'PYME',
  vigencia_desde date,
  vigencia_hasta date,
  prima numeric(14, 0),
  archivo_ruta text,
  creado timestamptz not null default now()
);
create index if not exists polizas_usuario_idx on public.polizas (usuario_id);

-- ---------- Fecha de actualización automática ----------
create or replace function public.marcar_actualizado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

create or replace trigger solicitudes_actualizado
  before update on public.solicitudes
  for each row execute function public.marcar_actualizado();

-- =====================================================================
-- Seguridad por filas: cada cliente ve solo lo suyo; el asesor ve todo.
-- =====================================================================
alter table public.asesores    enable row level security;
alter table public.perfiles    enable row level security;
alter table public.solicitudes enable row level security;
alter table public.eventos     enable row level security;
alter table public.archivos    enable row level security;
alter table public.mensajes    enable row level security;
alter table public.polizas     enable row level security;

drop policy if exists asesores_ver on public.asesores;
create policy asesores_ver on public.asesores for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or public.es_asesor());
drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists solicitudes_ver on public.solicitudes;
create policy solicitudes_ver on public.solicitudes for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_asesor());
drop policy if exists solicitudes_crear on public.solicitudes;
create policy solicitudes_crear on public.solicitudes for insert to authenticated
  with check (usuario_id = (select auth.uid()) and estado = 'recibida'
              and link_pago is null and referencia_pago is null);
drop policy if exists solicitudes_asesor on public.solicitudes;

drop policy if exists eventos_ver on public.eventos;
create policy eventos_ver on public.eventos for select to authenticated
  using (public.es_asesor() or exists (
    select 1 from public.solicitudes s where s.id = solicitud_id and s.usuario_id = (select auth.uid())));

drop policy if exists archivos_ver on public.archivos;
create policy archivos_ver on public.archivos for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_asesor());
drop policy if exists archivos_crear on public.archivos;
create policy archivos_crear on public.archivos for insert to authenticated
  with check (
    public.es_asesor()
    or (usuario_id = (select auth.uid()) and subido_por = 'cliente'
        and ruta like (select auth.uid())::text || '/%'
        and tipo in ('poliza_actual', 'contrato', 'comprobante_pago', 'documento_cliente', 'otro')
        and (solicitud_id is null or exists (
          select 1 from public.solicitudes s where s.id = solicitud_id and s.usuario_id = (select auth.uid())))));

drop policy if exists mensajes_ver on public.mensajes;
create policy mensajes_ver on public.mensajes for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_asesor());
drop policy if exists mensajes_crear on public.mensajes;
create policy mensajes_crear on public.mensajes for insert to authenticated
  with check (
    public.es_asesor()
    or (usuario_id = (select auth.uid()) and rol in ('cliente', 'asistente')
        and (solicitud_id is null or exists (
          select 1 from public.solicitudes s where s.id = solicitud_id and s.usuario_id = (select auth.uid())))));

drop policy if exists polizas_ver on public.polizas;
create policy polizas_ver on public.polizas for select to authenticated
  using (usuario_id = (select auth.uid()) or public.es_asesor());
drop policy if exists polizas_asesor on public.polizas;
create policy polizas_asesor on public.polizas for all to authenticated
  using (public.es_asesor()) with check (public.es_asesor());

-- =====================================================================
-- Acciones del cliente (cambian el estado de forma controlada)
-- =====================================================================
create or replace function public.accion_cliente(p_solicitud uuid, p_accion text, p_texto text default null)
returns public.solicitudes
language plpgsql security definer set search_path = ''
as $$
declare
  s public.solicitudes;
  nuevo text;
  nota text;
begin
  select * into s from public.solicitudes where id = p_solicitud and usuario_id = auth.uid() for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if s.estado = 'cancelada' then raise exception 'La solicitud está cancelada'; end if;
  p_texto := left(btrim(coalesce(p_texto, '')), 2000);
  nuevo := s.estado;

  if p_accion = 'ajuste' then
    if p_texto = '' then raise exception 'Escriba el ajuste que necesita'; end if;
    if s.estado = 'vigente' then raise exception 'La póliza ya está vigente; escriba a su asesor para modificarla'; end if;
    if jsonb_array_length(s.ajustes) >= 50 then raise exception 'Demasiados ajustes; escriba a su asesor'; end if;
    if s.estado = 'cotizada' then nuevo := 'ajustes_solicitados'; end if;
    nota := 'Ajuste pedido: ' || p_texto;
    update public.solicitudes
      set estado = nuevo, atencion = true,
          ajustes = ajustes || jsonb_build_array(jsonb_build_object('texto', p_texto, 'fecha', now()))
      where id = s.id returning * into s;
  elsif p_accion = 'emision' then
    if s.estado not in ('cotizada', 'ajustes_solicitados') then
      raise exception 'Solo puede solicitar la emisión cuando tenga una cotización';
    end if;
    nuevo := 'emision_solicitada';
    nota := 'Emisión solicitada' || case when p_texto <> '' then ': ' || p_texto else '.' end;
    update public.solicitudes set estado = nuevo, atencion = true, opcion_elegida = nullif(p_texto, '')
      where id = s.id returning * into s;
  elsif p_accion = 'pago' then
    if s.estado <> 'pago_pendiente' then raise exception 'Esta solicitud no tiene un pago pendiente'; end if;
    nuevo := 'pago_reportado';
    nota := 'Pago reportado' || case when p_texto <> '' then ': ' || p_texto else '.' end;
    update public.solicitudes set estado = nuevo, atencion = true where id = s.id returning * into s;
  elsif p_accion = 'cancelar' then
    if s.estado in ('en_emision', 'pago_pendiente', 'pago_reportado', 'vigente') then
      raise exception 'La póliza ya está en emisión; escriba a su asesor para cancelarla';
    end if;
    nuevo := 'cancelada';
    nota := 'Solicitud cancelada por el cliente' || case when p_texto <> '' then ': ' || p_texto else '.' end;
    update public.solicitudes set estado = nuevo, atencion = true where id = s.id returning * into s;
  elsif p_accion = 'documento' then
    nota := 'Documentos subidos' || case when p_texto <> '' then ': ' || p_texto else '.' end;
    update public.solicitudes set atencion = true where id = s.id returning * into s;
  elsif p_accion = 'mensaje' then
    if p_texto = '' then raise exception 'Escriba el mensaje'; end if;
    nota := 'Mensaje: ' || p_texto;
    update public.solicitudes set atencion = true where id = s.id returning * into s;
    insert into public.mensajes (usuario_id, solicitud_id, rol, texto) values (s.usuario_id, s.id, 'cliente', p_texto);
  else
    raise exception 'Acción no válida';
  end if;

  insert into public.eventos (solicitud_id, estado, nota, autor) values (s.id, nuevo, nota, 'cliente');
  return s;
end;
$$;

-- =====================================================================
-- Acción del asesor: cambia estado, deja nota (visible para el cliente) y datos de pago
-- =====================================================================
create or replace function public.actualizar_solicitud(
  p_solicitud uuid, p_estado text, p_nota text default null,
  p_link_pago text default null, p_referencia text default null)
returns public.solicitudes
language plpgsql security definer set search_path = ''
as $$
declare
  s public.solicitudes;
begin
  if not public.es_asesor() then raise exception 'Sin permiso'; end if;
  p_nota := nullif(left(btrim(coalesce(p_nota, '')), 2000), '');
  p_link_pago := nullif(btrim(coalesce(p_link_pago, '')), '');
  p_referencia := nullif(btrim(coalesce(p_referencia, '')), '');
  if p_link_pago is not null and p_link_pago !~* '^https?://' then
    raise exception 'El link de pago debe empezar por https://';
  end if;
  select * into s from public.solicitudes where id = p_solicitud for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if p_estado = s.estado and p_nota is null and p_link_pago is null and p_referencia is null then
    -- Sin cambios: solo se marca como atendida, sin dejar registro en el historial.
    update public.solicitudes set atencion = false where id = s.id returning * into s;
    return s;
  end if;
  update public.solicitudes
    set estado = p_estado, atencion = false,
        link_pago = coalesce(p_link_pago, link_pago),
        referencia_pago = coalesce(p_referencia, referencia_pago)
    where id = s.id returning * into s;
  insert into public.eventos (solicitud_id, estado, nota, autor) values (s.id, p_estado, p_nota, 'asesor');
  if p_nota is not null then
    insert into public.mensajes (usuario_id, solicitud_id, rol, texto) values (s.usuario_id, s.id, 'asesor', p_nota);
  end if;
  return s;
end;
$$;

-- =====================================================================
-- Permisos explícitos. Los proyectos nuevos de Supabase no exponen las tablas
-- por defecto: aquí se concede solo lo necesario a los usuarios con sesión.
-- Los visitantes sin sesión (anon) no tienen acceso a nada.
-- =====================================================================
grant usage on schema public to authenticated;

revoke all on public.asesores, public.perfiles, public.solicitudes, public.eventos,
              public.archivos, public.mensajes, public.polizas
  from anon, authenticated;

grant select on public.asesores to authenticated;
grant select on public.perfiles to authenticated;
grant update (nombre, celular, empresa, nit) on public.perfiles to authenticated;
grant select on public.solicitudes to authenticated;
grant insert (usuario_id, tipo, empresa, datos, ajustes) on public.solicitudes to authenticated;
grant select on public.eventos to authenticated;
grant select on public.archivos to authenticated;
grant insert (usuario_id, solicitud_id, ruta, nombre, tipo, subido_por) on public.archivos to authenticated;
grant select on public.mensajes to authenticated;
grant insert (usuario_id, solicitud_id, rol, texto) on public.mensajes to authenticated;
grant select, insert, update, delete on public.polizas to authenticated;

revoke all on function public.es_asesor() from public, anon;
revoke all on function public.mi_perfil(boolean) from public, anon;
revoke all on function public.accion_cliente(uuid, text, text) from public, anon;
revoke all on function public.actualizar_solicitud(uuid, text, text, text, text) from public, anon;
revoke all on function public.crear_perfil() from public, anon, authenticated;
revoke all on function public.evento_inicial() from public, anon, authenticated;
revoke all on function public.marcar_actualizado() from public, anon, authenticated;

grant execute on function public.es_asesor() to authenticated;
grant execute on function public.mi_perfil(boolean) to authenticated;
grant execute on function public.accion_cliente(uuid, text, text) to authenticated;
grant execute on function public.actualizar_solicitud(uuid, text, text, text, text) to authenticated;

-- =====================================================================
-- Almacenamiento privado de documentos (una carpeta por cliente)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.ms-excel'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documentos_ver on storage.objects;
create policy documentos_ver on storage.objects for select to authenticated
  using (bucket_id = 'documentos'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.es_asesor()));

drop policy if exists documentos_subir on storage.objects;
create policy documentos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos'
              and ((storage.foldername(name))[1] = (select auth.uid())::text or public.es_asesor()));

drop policy if exists documentos_borrar on storage.objects;
create policy documentos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.es_asesor());

-- Avisa a la API de Supabase que hay tablas y funciones nuevas, para que las use de inmediato.
notify pgrst, 'reload schema';
