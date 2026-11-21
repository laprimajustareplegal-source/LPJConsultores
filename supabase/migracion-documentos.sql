-- Migración 21/11/2026: documentos para emitir (RUT, cámara de comercio, cédula, estados financieros,
-- declaración de renta y SARLAFT). Se puede ejecutar varias veces. También está incluida en esquema.sql.
alter table public.archivos drop constraint if exists archivos_tipo_check;
alter table public.archivos add constraint archivos_tipo_check
  check (tipo in ('poliza_actual', 'contrato', 'cotizacion', 'poliza_emitida',
                  'recibo_pago', 'comprobante_pago', 'documento_cliente',
                  'rut', 'camara_comercio', 'cedula_rl', 'estados_financieros',
                  'declaracion_renta', 'sarlaft', 'otro'));

drop policy if exists archivos_crear on public.archivos;
create policy archivos_crear on public.archivos for insert to authenticated
  with check (
    public.es_asesor()
    or (usuario_id = (select auth.uid()) and subido_por = 'cliente'
        and ruta like (select auth.uid())::text || '/%'
        and tipo in ('poliza_actual', 'contrato', 'comprobante_pago', 'documento_cliente',
                    'rut', 'camara_comercio', 'cedula_rl', 'estados_financieros',
                    'declaracion_renta', 'sarlaft', 'otro')
        and (solicitud_id is null or exists (
          select 1 from public.solicitudes s where s.id = solicitud_id and s.usuario_id = (select auth.uid())))));
