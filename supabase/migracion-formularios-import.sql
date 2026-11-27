-- Migración 27/11/2026: cola de formularios en blanco que se bajan del correo (Graph) y se publican.
-- Solo la usa el servidor con la clave de servicio: RLS activo y sin políticas.
create table if not exists public.formularios_import (
  id uuid primary key default gen_random_uuid(),
  buzon text not null,
  mensaje_id text not null,
  adjunto_id text not null,
  archivo text,
  nombre text not null,
  aseguradora text,
  ramo text,
  para text,
  orden int not null default 100,
  estado text not null default 'pendiente' check (estado in ('pendiente','hecho','error','descartado')),
  ruta text,
  nota text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  unique (mensaje_id, adjunto_id)
);
alter table public.formularios_import enable row level security;
revoke all on public.formularios_import from anon, authenticated;
