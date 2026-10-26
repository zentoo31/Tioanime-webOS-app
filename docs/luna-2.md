# Luna 2 — Experimental

Versión `0.5.1-luna.2`; paquete webOS `0.5.1`. Actualiza sobre Luna 1 y conserva Recientes, progreso y Favoritos.

- Estrella en Favoritos y en la ficha, rellena cuando el anime está guardado.
- Iconos SVG ligeros para pausa/reproducción, saltos, Más, subtítulos, servidor y reproductor web. El icono y texto de pausa se actualizan según el estado del video; el de subtítulos se conserva al cambiar idioma.
- TioAnime también identifica los servidores como App o Web externo. La clasificación usa el mismo reconocimiento de URL del adaptador nativo, compartido con JKAnime y HiAnime; App indica que existe un adaptador, no que el enlace esté disponible en ese momento. Si no se obtiene una fuente nativa se conserva el fallback web.
- En la línea de tiempo, izquierda/derecha saltan diez segundos. Arriba, abajo, Escape o Atrás retiran el foco hacia Pausa sin cerrar el video ni salir de pantalla completa. Una vez fuera de la línea de tiempo, Atrás conserva su comportamiento habitual.
- La barra muestra una ayuda de teclas. Se verifica con pruebas de DOM para las cuatro teclas de salida y con pruebas de clasificación de servidores. Pendiente de comprobar los eventos reales en la TV.
