// Esta prueba no modifica la configuración DNS del equipo.
const dns = require('node:dns');
dns.lookup = function () { throw new Error('La prueba prohíbe usar el DNS del sistema'); };
const { load } = require('../service/client');
load('/', (error, html) => {
  if (error) { console.error(error); process.exitCode = 1; return; }
  if (!html.includes('Últimos Episodios')) { console.error('Respuesta inesperada'); process.exitCode = 1; return; }
  console.log('OK: TioAnime carga por Cloudflare con el DNS del sistema deshabilitado en este proceso.');
});
