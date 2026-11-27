-- Registro de cotizaciones enviadas por correo por el equipo técnico de LPJ.
-- Lo llena el servidor (clave de servicio) leyendo los Enviados del buzón técnico.
-- El cliente ve solo las que se enviaron a su correo; el aliado, las que se le enviaron a él;
-- el equipo LPJ, todas.

create table if not exists public.cotizaciones_correo (
  id text primary key,                         -- id del mensaje en Microsoft 365
  enviado timestamptz not null,
  asunto text,
  destinatarios text[] not null default '{}',  -- correos en minúscula (para, cc)
  cliente_nombre text,
  cliente_correo text,
  ramo text,
  resumen text,                                -- explicación corta para el chat
  opciones jsonb not null default '[]'::jsonb, -- [{aseguradora, producto, prima, prima_con_iva, valor_asegurado, deducibles, coberturas_clave, condiciones, vigencia_oferta}]
  vigente_hasta date,                          -- hasta cuándo vale la oferta, si se sabe
  estado text not null default 'enviada' check (estado in ('enviada', 'aceptada', 'rechazada', 'vencida', 'reconsideracion')),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists cotizaciones_correo_dest_idx on public.cotizaciones_correo using gin (destinatarios);
create index if not exists cotizaciones_correo_enviado_idx on public.cotizaciones_correo (enviado desc);

-- Estado de la sincronización (última fecha leída).
create table if not exists public.sync_estado (
  clave text primary key,
  valor text,
  actualizado timestamptz not null default now()
);

alter table public.cotizaciones_correo enable row level security;
alter table public.sync_estado enable row level security;

drop policy if exists cot_lectura on public.cotizaciones_correo;
create policy cot_lectura on public.cotizaciones_correo for select to authenticated
  using (
    public.es_asesor()
    or lower(coalesce(auth.jwt() ->> 'email', '')) = any (destinatarios)
  );
-- Sin políticas de escritura: solo la clave de servicio escribe. sync_estado no se lee desde el navegador.

revoke all on public.cotizaciones_correo from anon;
grant select on public.cotizaciones_correo to authenticated;
