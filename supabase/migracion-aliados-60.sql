-- Migración 21/11/2026: los aliados que se inscriben desde "Portal de aliados" quedan activos con 60 %.
-- El asesor puede cambiar el porcentaje de cualquier aliado en su panel. Se puede ejecutar varias veces.

alter table public.aliados alter column porcentaje set default 60;

-- Quien se inscribe por el Portal de aliados se registra a sí mismo como aliado con 60 %.
-- Si ya era aliado no cambia nada (no puede subirse el porcentaje).
create or replace function public.registrarme_aliado()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  n text;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión'; end if;
  select coalesce(nullif(p.empresa, ''), p.nombre) into n from public.perfiles p where p.id = auth.uid();
  insert into public.aliados (usuario_id, nombre, porcentaje)
  values (auth.uid(), left(n, 120), 60)
  on conflict (usuario_id) do nothing;
end;
$$;

revoke all on function public.registrarme_aliado() from public, anon;
grant execute on function public.registrarme_aliado() to authenticated;
