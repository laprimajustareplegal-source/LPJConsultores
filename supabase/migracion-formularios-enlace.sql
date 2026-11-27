-- Migración 26/11/2026: un formulario puede ser un archivo subido o un enlace (formato genérico de Fasecolda
-- o el enlace web de una aseguradora). Se puede ejecutar varias veces.
alter table public.formularios add column if not exists url text check (url is null or url ~ '^https://');
alter table public.formularios alter column ruta drop not null;
alter table public.formularios drop constraint if exists formularios_archivo_o_enlace;
alter table public.formularios add constraint formularios_archivo_o_enlace check (ruta is not null or url is not null);

-- SARLAFT: formato genérico de Fasecolda vigente (versión 2025-3, publicado en fasecolda.com/asuntos-financieros/sarlaft).
insert into public.formularios (nombre, aseguradora, ramo, para, url, orden)
select 'SARLAFT persona natural (formato genérico Fasecolda V2025-3)', 'Todas (formato Fasecolda)', 'Todos',
       'Conocimiento del cliente para emitir o renovar. Firma y huella; anexar copia de la cédula. Si la aseguradora usa SARLAFT digital, el asesor envía su enlace.',
       'https://www.fasecolda.com/wp-content/uploads/FCC_202508_PN_-V2025-3_VF-1.pdf', 1
where not exists (select 1 from public.formularios where url = 'https://www.fasecolda.com/wp-content/uploads/FCC_202508_PN_-V2025-3_VF-1.pdf');
insert into public.formularios (nombre, aseguradora, ramo, para, url, orden)
select 'SARLAFT persona jurídica (formato genérico Fasecolda V2025-3)', 'Todas (formato Fasecolda)', 'Todos',
       'Conocimiento del cliente para emitir o renovar a nombre de una empresa. Firma y huella del representante legal; anexar cédula del representante, RUT, cámara de comercio y estados financieros o declaración de renta. Si la aseguradora usa SARLAFT digital, el asesor envía su enlace.',
       'https://www.fasecolda.com/wp-content/uploads/FCC_202508-PJ_V2025-3_VF-1.pdf', 2
where not exists (select 1 from public.formularios where url = 'https://www.fasecolda.com/wp-content/uploads/FCC_202508-PJ_V2025-3_VF-1.pdf');

notify pgrst, 'reload schema';
