# Luna 3 — Experimental

Versión `0.5.2-luna.3`; paquete webOS `0.5.2`.

## Imagen negra con audio en HLS

Se investigó Steins;Gate 0, episodio 1: Desu en JKAnime y ZokoAnime SUB en HiAnime. Las muestras contienen video H.264 High de 720p y 1080p respectivamente; se decodificaron cuadros con imagen mediante FFmpeg/PyAV en el equipo de desarrollo. La muestra de Desu tuvo un paquete inicial rechazado antes de producir cuadros; no demuestra por sí sola la causa en la TV. No se dispone del modelo exacto del usuario. `3.53.46` se trata como número de firmware, no como versión de plataforma confirmada.

La evidencia confirma video en las fuentes investigadas. No confirma que el decodificador de una LG concreta lo admita ni que todos los episodios usen el mismo formato.

## Ajustes

- En TV, las fuentes HLS de JKAnime y ZokoAnime usan hls.js bajo demanda si están disponibles las APIs MSE y los tipos AVC/AAC necesarios. Transforma el contenedor TS a MP4 en memoria y entrega las pistas al decodificador del sistema; no recodifica el video. Puede mejorar diferencias de demultiplexado y timestamps frente al HLS nativo.
- Si no existe soporte MSE o la biblioteca no puede inicializarse, se mantiene la ruta HLS nativa. YourUpload, Okru y la preferencia inicial de VOE se conservan.
- Más incluye una acción para alternar modo compatible/nativo. Si MSE no está disponible, permite reiniciar el video. Cambiar de modo conserva la posición y los subtítulos del mismo episodio, sin preguntar de nuevo por reanudación. Cada nueva selección de servidor vuelve a su preferencia inicial.
- Un error fatal del modo compatible abre Más y permite probar el nativo o cambiar servidor, sin entrar en un ciclo automático de recargas.
- El retransmisor de JKAnime y Zoko limpia etiquetas HLS auxiliares no soportadas por el reproductor nativo de LG. Solo anuncia v3 en listas originalmente v4 cuando contienen únicamente elementos sencillos compatibles; nunca elimina claves, mapas, rangos, pistas alternativas o discontinuidades para forzar esa conversión.
- Todo el acceso gestionado al catálogo, video y subtítulos conserva Cloudflare DoH y TLS.

## Prueba en la LG

1. Instalar Luna 3 sobre la versión anterior y abrir Steins;Gate 0 en Desu o Zoko.
2. Si sigue el negro: OK → Más → Video: probar modo nativo/compatible. Si la TV no ofrece MSE, la opción se llama Video negro: reiniciar video.
3. Comprobar imagen, sonido, subtítulos, minuto conservado y cambio al siguiente episodio.

Pruebas automatizadas: selección MSE en TV compatible, fallback sin esas APIs, cambio de motor con progreso, tratamiento de errores y normalización conservadora de HLS. La reproducción visual en el dispositivo del usuario queda pendiente.

No se cambian niveles ni perfiles AVC en los bytes del video. Una fuente que exceda la capacidad del hardware seguirá requiriendo otro servidor o una variante publicada compatible; no se inventan calidades ni se añade recodificación en la TV.

Referencias: [Streaming Protocol and DRM](https://webostv.developer.lge.com/develop/specifications/streaming-protocol-drm), [formatos de webOS 3.0](https://webostv.developer.lge.com/develop/specifications/video-audio-30).
