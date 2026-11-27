-- Migración 26/11/2026: formularios descargables (los sube el equipo en el panel, los ve cualquiera en la
-- página y el asesor IA los envía) y archivos que la gente adjunta en el chat (solo los lee el servidor).
-- Se puede ejecutar varias veces.

-- ---------- Formularios descargables ----------
create table if not exists public.formularios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 2 and 160),
  aseguradora text check (char_length(aseguradora) <= 80),
  ramo text check (char_length(ramo) <= 120),
  para text check (char_length(para) <= 400),
  ruta text not null,
  publico boolean not null default true,
  orden int not null default 100,
  creado timestamptz not null default now()
);
alter table public.formularios enable row level security;

drop policy if exists formularios_leer on public.formularios;
create policy formularios_leer on public.formularios for select to anon, authenticated
  using (publico or public.es_asesor());
drop policy if exists formularios_equipo on public.formularios;
create policy formularios_equipo on public.formularios for all to authenticated
  using (public.es_asesor()) with check (public.es_asesor());
grant select on public.formularios to anon, authenticated;
grant insert, update, delete on public.formularios to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('formularios', 'formularios', true, 15728640,
        array['application/pdf',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists formularios_subir on storage.objects;
create policy formularios_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'formularios' and public.es_asesor());
drop policy if exists formularios_cambiar on storage.objects;
create policy formularios_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'formularios' and public.es_asesor());
drop policy if exists formularios_borrar on storage.objects;
create policy formularios_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'formularios' and public.es_asesor());

-- ---------- Archivos adjuntos en el chat ----------
-- Privado y sin políticas: solo el servidor (clave de servicio) sube y lee. Se envían al equipo con la solicitud.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-adjuntos', 'chat-adjuntos', false, 8388608,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
