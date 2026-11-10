/* Configuración del portal PYME de La Prima Justa.
   Es lo único que hay que llenar después de crear Supabase y Vercel.
   Estos datos son públicos por diseño: la seguridad la ponen las reglas de la base de datos, no estas claves.
   NUNCA pegar aquí la clave secreta (sb_secret_...) ni la service_role. */
window.LPJ_CONFIG = {
  // Supabase > botón "Connect" (o Settings > API Keys): "Project URL" y "Publishable key" (empieza por sb_publishable_).
  supabaseUrl: 'https://mdewdzeqftlnxkxmziue.supabase.co',
  supabaseKey: 'sb_publishable_LRZFP5Z-bt3FrMYW77ynGg_kO3Rssm0',

  // Dirección de la función de IA en Vercel, por ejemplo 'https://lpj-consultores.vercel.app/api/chat'.
  apiChat: '',

  // Cambiar a true cuando Supabase tenga configurado un correo propio (SMTP).
  // Mientras sea false, "Olvidé mi contraseña" remite al cliente a WhatsApp.
  recuperarPorCorreo: false,

  correoAsesor: 'luis.pinilla@laprimajusta.co',
  nombreAsesor: 'Luis Felipe Pinilla',
  whatsapp: '573144220945',
  whatsappVisible: '314 422 0945',
  sitio: 'https://laprimajusta.co',

  // Tarifas para el precio orientativo del chat. Mientras sea null, no se muestra precio.
  tarifas: null
};
