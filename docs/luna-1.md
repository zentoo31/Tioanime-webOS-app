# Luna 1 — Experimental

Versión de desarrollo: `0.5.0-luna.1`. Versión del paquete webOS: `0.5.0`.
La app se identifica en el launcher como **TioAnime TV Luna** y muestra el distintivo **LUNA 1 · EXPERIMENTAL**.

Se conserva `com.tioanime.tv`: instalar esta actualización sustituye la versión anterior y conserva el almacenamiento local. No es una instalación paralela. No desinstalar antes de actualizar si se desea conservar Recientes.

## Cambios

- Barra de reproducción simplificada con pausa, saltos de diez segundos, progreso y subtítulos. Las acciones de capítulo, opening, fullscreen y servidor pasan al menú Más. La barra se oculta tras 4,5 segundos reproduciendo; OK, flechas o puntero la muestran. La primera tecla al recuperar controles ocultos no ejecuta otra acción.
- Más y los diálogos retienen el foco. Atrás cierra primero el menú o diálogo correspondiente; conserva la secuencia de salir de pantalla completa y cerrar el reproductor. Stop (413) cierra el reproductor propio.
- Navegación por zonas y filas con conservación de columna al subir/bajar. Las flechas no saltan lateralmente a otra sección al terminar una fila. Atrás restaura tarjeta y desplazamiento.
- Textos y controles más grandes, foco de cuatro píxeles y márgenes para mantener las acciones dentro de la zona segura. El fondo sigue siendo `#18142f`, con esquinas casi rectas y animaciones breves.
- Se elimina el cambio automático de foco al ocultarse el teclado: ese evento también aparece durante el dictado por voz. El campo sigue activándose mediante OK/clic.
- El reproductor propio guarda posición y duración cada diez segundos y al pausar, cerrar u ocultar la app. Recientes muestra progreso. Abrir un episodio con progreso permite continuar o empezar desde cero. Cambiar de servidor conserva el progreso del mismo episodio; otro episodio tiene su propio estado. Un episodio a menos de veinte segundos del final se marca Visto.
- La app pausa el video propio al quedar oculta y no lo reproduce automáticamente al regresar. Soporta eventos de visibilidad estándar y WebKit. Reconoce tanto `PalmSystem` como `webOSSystem`.
- Favoritos locales desde la ficha del anime, con acceso en el encabezado. Se guardan por fuente y no se borran al limpiar Recientes. Máximo de 200 favoritos y 50 recientes.

## Límites

El progreso, la pausa en segundo plano y la sincronización de subtítulos se controlan en el reproductor propio. Los iframes externos mantienen sus limitaciones de origen y no exponen su tiempo de reproducción. Se conserva el registro del episodio abierto para ellos. No se añade un control global del screensaver: requiere pruebas en el modelo y firmware concretos.

Validación automatizada: pruebas de modelos, DOM, navegación por filas, dictado, favorito, autohide, Más, fullscreen/Atrás, Stop, pausa al ocultar, reanudación antes de cargar metadatos y respuesta tardía de subtítulos. La presentación visual y los eventos reales del Magic Remote requieren probarse en la LG.

## Prueba en TV

1. Instalar `dist/com.tioanime.tv_Luna-1_0.5.0_all.ipk` sobre la app anterior.
2. Recorrer una cuadrícula con flechas, abrir una tarjeta y volver: comprobar tarjeta y desplazamiento.
3. Abrir búsqueda con OK y probar dictado por voz; comprobar transición entre puntero y flechas.
4. Abrir un reproductor propio, esperar a que desaparezcan los controles y recuperarlos con OK. Comprobar Más y Atrás.
5. Reproducir más de diez segundos, pausar/cerrar y reabrir. Elegir Continuar; luego probar Desde el inicio.
6. Cambiar a otra app y regresar: comprobar que el video permanece pausado y se puede continuar.
7. Guardar un favorito y comprobar que sigue allí después de borrar Recientes y de relanzar la app.
8. Probar ZokoAnime con subtítulos, VOE y YourUpload; comprobar subtítulos tanto con controles visibles como ocultos.

## Referencias de LG

- [Design Principles](https://webostv.developer.lge.com/develop/guides/design-principles)
- [Magic Remote](https://webostv.developer.lge.com/develop/guides/magic-remote)
- [Virtual Keyboard](https://webostv.developer.lge.com/develop/guides/virtual-keyboard)
- [Overscan](https://webostv.developer.lge.com/develop/guides/overscan)
- [App Lifecycle Management](https://webostv.developer.lge.com/develop/guides/app-lifecycle-management)
