# Viabilidad de JKAnime como fuente de búsqueda

Comprobación inicial: 25 de octubre de 2026. Este informe describe la investigación previa. La integración ya está implementada en 0.3.0; véase README.md y `npm run test:jkanime`.

## Resultado

Es viable implementar JKAnime como fuente alternativa de búsqueda, fichas y episodios dentro de la interfaz existente. La disponibilidad del catálogo no acredita compatibilidad de todos los reproductores.

## Prueba reproducible

```powershell
node scripts/check-jkanime.cjs
```

El script deshabilita `dns.lookup` únicamente dentro de su proceso. Resuelve cada dominio permitido mediante DNS sobre HTTPS de Cloudflare, llegando al resolvedor por 1.1.1.1 o 1.0.0.1 sin depender del DNS del equipo. Mantiene Host, SNI y validación TLS. No cambia ajustes de red ni ejecuta scripts descargados.

Resultados observados:

| Paso | Resultado |
| --- | --- |
| Inicio de JKAnime | HTTP 200 |
| `/buscar?q=naruto` | Redirige a `/buscar/naruto`; HTTP 200; 23 resultados |
| Ficha `/naruto/` | HTTP 200; título y portada disponibles |
| Episodios | POST `/ajax/episodes/123/1`, con sesión y CSRF: HTTP 200 |
| Paginación de episodios | 220 episodios, 16 por página, 14 páginas; páginas 1 y 2 verificadas |
| Portada en `cdn.jkdesa.com` | HTTP 200, image/jpeg, también por Cloudflare |
| Episodio `/naruto/1/` | HTTP 200; navegación y datos de reproductores en el HTML |
| Primer wrapper JKPlayer | HTTP 200; no se comprobó reproducción |

El HTML del episodio publica tres wrappers propios y enlaces con nombres como Mega y VOE, además de otros proveedores y descargas. No todos esos enlaces se han probado ni deben tratarse automáticamente como videos compatibles.

No se observaron cabeceras CORS que permitan leer directamente el sitio desde la app local: las consultas deberán pasar por el servicio de webOS. La sesión y el token CSRF se obtienen de las páginas públicas; no fue necesario iniciar sesión. No se guardan tokens ni cookies en este informe.

## Diseño de integración

- Conservar Inicio, directorio y la búsqueda predeterminada de TioAnime.
- Mostrar el selector TioAnime / JKAnime solamente en el contexto de búsqueda. Al cambiar fuente, repetir la misma consulta.
- Mantener la fuente elegida durante la navegación a fichas, páginas de episodios y servidores. No mezclar rutas ni identificadores de las dos páginas.
- Normalizar la salida de cada adaptador al formato de la interfaz existente.
- Añadir un campo de fuente al historial y a la navegación. Los registros anteriores sin ese campo deben seguir interpretándose como TioAnime.
- Ampliar el servicio con rutas permitidas por fuente, sin aceptar URLs arbitrarias. El resolvedor actual está limitado a tioanime.com y necesita cachés y consultas separadas por dominio al añadir JKAnime y su CDN.
- Gestionar cookies y CSRF de JKAnime dentro del servicio y consultar los episodios por páginas, sin descargar toda la serie en cada apertura.

## Alcance de “todo por Cloudflare”

Esta prueba cubre todas las solicitudes realizadas por el script: páginas, búsqueda, API de episodios, portada y wrapper JKPlayer. Los dominios contactados de JKAnime y su CDN se resolvieron mediante Cloudflare.

Para conseguir ese mismo alcance en la app, las portadas deben pasar por el servicio, además del catálogo. Los videos compatibles necesitan una ruta de red controlada por la app, con resolución Cloudflare también para sus manifiestos, segmentos, redirecciones o CDN. Un iframe externo conserva su propia carga de recursos y no queda cubierto simplemente por haber consultado su página mediante Cloudflare. Por tanto, no se puede afirmar todavía que todos los reproductores de JKAnime funcionarán sin el DNS de la TV.

La reproducción, las restricciones de proveedores y la compatibilidad con el firmware de la LG requieren pruebas posteriores a la integración.
