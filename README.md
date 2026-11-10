# laprimajusta.co

Sitio de La Prima Justa Ltda. (LPJ Consultores), agencia de seguros. Se publica solo con GitHub Pages cada vez que cambia la rama `main`.

## Páginas

| Archivo | Qué es |
|---|---|
| `index.html` | Página de inicio: el chat PYME arriba y la información de la agencia abajo. El botón "Acceso" lleva a Mi cuenta. En producción desde el 9 de noviembre de 2026. |
| `inicio-pyme.html` | Era la versión de prueba. Ahora solo redirige al inicio, para que los enlaces guardados sigan funcionando. |
| `diseno.html` | **Versión de prueba del estilo sobrio** (con `noindex`): la misma página de inicio con la hoja `pyme/sobrio.css`; casi toda en azul profundo, con dos secciones blancas y una en azul grisáceo. Cuando se apruebe, ese estilo pasa a `index.html`. |
| `mi-cuenta.html` | Portal del cliente: solicitudes con su estado, documentos, pólizas, conversaciones y datos. |
| `asesor.html` | Panel del asesor: atender solicitudes, cambiar estados, subir cotizaciones y pólizas, publicar el link de pago. |
| `test-felipe.html`, `firmas/` | Material anterior (prototipo del chat para asesores y firmas de correo). |

La página de inicio anterior (sin chat) quedó en el historial: es el `index.html` del commit `c20e710`. Para volver a ella basta restaurar ese archivo.

## Portal PYME (`pyme/`)

- `config.js` — lo único que se configura: dirección y clave pública de Supabase, dirección de la función de IA, correo y WhatsApp del asesor. Nunca va aquí una clave secreta.
- `datos.js` — todas las llamadas a Supabase y los avisos por correo al asesor.
- `chat-pyme.js` / `chat-pyme.css` — el chat. Las preguntas de la cotización corren en la página (no usan IA). La IA solo responde preguntas libres.
- `mi-cuenta.js`, `asesor.js`, `cuenta.css` — portal del cliente y panel del asesor.
- `lib/` — librería oficial de Supabase incluida en el sitio.
- `sobrio.css` — estilo sobrio de la página de inicio: casi toda la página sobre el azul profundo de LPJ con texto blanco, titulares grandes en Archivo, líneas finas, esquinas rectas, fotos en azul. Solo se aplica en páginas con `<body class="sobrio">`. Cada sección tiene un tono (azul profundo, blanco o azul grisáceo) y se cambia moviéndola de lista en el bloque "Tonos por sección" del archivo: hoy van en blanco "Transformamos el riesgo…" y "Sectores que atendemos", y en azul grisáceo "¿Cómo trabajamos con usted?". Los colores del sitio (`--negro`, `--azul`…) toman el valor del tono de cada zona y dentro de `.pyme-chat` valen lo de siempre. Versiones anteriores: inicio azul con el resto en blanco, commit `dd709f1`; toda azul, commit `1d9ee53`.
- `fuentes/` — tipografía Archivo (licencia abierta OFL, incluida) alojada en el sitio.

Mientras `config.js` no tenga los datos de Supabase, el chat funciona en modo sencillo: no hay cuentas ni archivos y cada solicitud llega al correo del asesor.

### Cómo viaja una solicitud

1. El cliente cotiza o pide mejorar su póliza en el chat, adjunta su póliza o contrato si quiere, y crea su cuenta.
2. La solicitud queda en Supabase y al asesor le llega un correo con el enlace al panel.
3. El asesor responde desde el panel (estado, nota, archivos, link de pago). El cliente lo ve en Mi cuenta y el asesor le avisa por correo o WhatsApp con un clic.
4. El cliente pide ajustes, solicita la emisión, reporta el pago y, al final, encuentra su póliza en Mi cuenta.

Estados: Recibida → En análisis → Cotización enviada ⇄ Ajustes solicitados → Emisión solicitada → En emisión → Pago pendiente → Pago reportado → Póliza vigente (o Cancelada).

Si Supabase no responde, la solicitud no se pierde: sale por correo al asesor y el chat se lo dice al cliente.

## Base de datos (`supabase/esquema.sql`)

Se pega completo en Supabase > SQL Editor y se ejecuta. Se puede volver a ejecutar sin perder datos. Crea las tablas, las reglas de seguridad (cada cliente ve solo lo suyo; el asesor ve todo) y el almacenamiento privado de documentos. Si Supabase muestra una advertencia antes de ejecutarlo, es normal en este archivo: se confirma y se ejecuta.

Configuración en Supabase después de ejecutar el esquema:

1. Authentication > Sign In / Providers > Email: desactivar **Confirm email** (el correo de prueba de Supabase solo entrega a miembros del proyecto).
2. Authentication > URL Configuration: Site URL `https://laprimajusta.co` y Redirect URL `https://laprimajusta.co/mi-cuenta.html`.
3. Crear el usuario del asesor en Authentication > Users y darle permiso con:

```sql
insert into public.asesores (usuario_id, nombre)
select id, 'Luis Felipe Pinilla' from auth.users where email = 'luis.pinilla@laprimajusta.co'
on conflict do nothing
returning nombre;
```

Debe devolver una fila con el nombre. Si no devuelve nada, el usuario todavía no existe (o ya era asesor). Esto se hace antes de poner las claves en `config.js`, es decir, antes de que el portal quede abierto al público.

4. Copiar en `pyme/config.js` el Project URL y la Publishable key.

Pendiente recomendado: conectar un correo propio (SMTP) en Supabase para que funcione "Olvidé mi contraseña" y luego poner `recuperarPorCorreo: true` en `config.js`.

## IA del chat (`api/chat.js`, `conocimiento/pyme.md`, `vercel.json`)

Función para Vercel que responde preguntas libres con Claude Haiku. Lee únicamente `conocimiento/pyme.md`: para que responda mejor se edita ese archivo. La clave de Anthropic se guarda en Vercel como variable `ANTHROPIC_API_KEY`, nunca en el código. Tiene topes de mensajes por conversación y por hora.

## Avisos por correo

Los avisos al asesor salen por FormSubmit (formsubmit.co) hacia el correo definido en `config.js`. La primera vez FormSubmit envía un correo de activación a esa dirección: hay que abrirlo y activar.
