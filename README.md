# TioAnime TV para LG webOS

Autor: **zentoo31**.

Aplicación independiente, sin afiliación a TioAnime. Versión 0.2.0.

## Funciones

- Inicio con episodios recientes y miniaturas del sitio.
- Directorio con paginación y búsqueda.
- Fichas con portada, sinopsis y lista de episodios.
- Selección de servidor y reproductor externo integrado en un iframe.
- Navegación por flechas, OK, puntero y Atrás, con restauración del foco al volver.
- Estados de carga, resultados vacíos, errores y reintento.

El catálogo se consulta en vivo. No se incluyen videos ni contenido precargado.

## Arquitectura

`app/` contiene la interfaz y `service/` un servicio Node para webOS llamado `com.tioanime.tv.catalog`. La app usa Luna Bus para solicitar HTML al servicio y no depende de que TioAnime habilite CORS para el origen local. Solo se admiten consultas HTTPS a rutas del catálogo, fichas y episodios de `tioanime.com`, con timeout y límite de tamaño. No es un proxy de URLs arbitrarias.

El HTML se interpreta en un documento separado sin ejecutar sus scripts. Los datos de episodios y servidores se leen como JSON, sin eval. Se incluye webOSTV.js 1.2.13 de la plantilla oficial del CLI.

La vista de desarrollo usa el mismo cliente de red mediante `/api/page`, servido solo en `127.0.0.1`. La TV usa el servicio del paquete; no requiere mantener el equipo encendido.

## Desarrollo

Requiere Node.js y `npm install -g @webos-tools/cli`.

```powershell
npm ci
npm run serve
```

Abre http://127.0.0.1:8080. Los cambios en el servicio requieren reiniciar el servidor local.

```powershell
npm test
npm run test:live
npm run check
npm run package
```

`test` comprueba extracción, rutas y el flujo de la interfaz con un DOM simulado. `test:live` consulta inicio, búsqueda, paginación, ficha y servidores del sitio real. No verifican reproducción ni renderizado visual.

## Instalar en LG

Activa Developer Mode y conecta ambos equipos a la misma red. Configura el dispositivo con su IP y los datos de Developer Mode:

```powershell
ares-setup-device
ares-novacom --device NOMBRE_TV --getkey
ares-install --device NOMBRE_TV dist/com.tioanime.tv_0.2.0_all.ipk
ares-launch --device NOMBRE_TV com.tioanime.tv
```

Sustituye `NOMBRE_TV` por el dispositivo configurado. La sesión Developer Mode debe estar activa. El paquete incluye la interfaz y el servicio.

## Uso y límites actuales

Flechas y OK recorren las tarjetas. En la búsqueda, izquierda/derecha editan el texto; arriba/abajo salen del campo. Atrás regresa a la vista anterior y, desde Inicio, usa la salida de webOS.

Al elegir servidor se abre su reproductor externo. El botón superior permite cerrarlo. Atrás y el botón rojo también lo cierran **cuando la app conserva el foco**. Si el foco entra en un iframe externo, sus eventos no llegan a la app: puede ser necesario usar el puntero del Magic Remote para pulsar el cierre. No se garantiza manejo completo con un mando sin puntero.

Los proveedores pueden bloquear iframes, exigir interacciones, presentar publicidad o usar formatos no soportados por la TV. El iframe restringe ventanas emergentes y navegación de la aplicación; algunos proveedores pueden no funcionar con esas restricciones. No se eluden bloqueos ni se resuelven desafíos automáticamente.

Pendiente de validar en una LG real: arranque del servicio y permisos, TLS del firmware, renderizado, teclado virtual, controles de cada servidor, reproducción y regreso desde el iframe. Aún no se conoce el modelo ni la versión webOS de destino. Un cambio en el HTML de TioAnime puede requerir actualizar el analizador.

Referencias: [servicios JS de LG](https://webostv.developer.lge.com/develop/guides/js-service-usage), [manejo de Atrás](https://webostv.developer.lge.com/develop/guides/back-button).


## Animaciones

Las tarjetas tienen una entrada de 180 ms limitada a las primeras ocho. El foco y la pulsación desplazan los botones unos pocos píxeles en 120 ms. Un pequeño indicador pulsa solo durante la carga. Se usan transform y opacity con prefijos WebKit, sin librerías ni capas permanentes; se respeta prefers-reduced-motion donde el motor lo soporte. La fluidez final requiere comprobarse en el modelo de TV de destino.

## Vistos recientemente

La sección Recientes guarda hasta 50 animes en localStorage del dispositivo, con una sola entrada por anime y el último episodio abierto al elegir un servidor. Se ordena por apertura más reciente y permite regresar a la selección de servidor del episodio. No guarda minutos de reproducción ni confirma que el video haya comenzado: los reproductores externos no exponen ese estado a la app. El historial es local, no se sincroniza con TioAnime y puede perderse al borrar los datos o desinstalar la app. Si falla la escritura, la sesión mantiene el historial en memoria y muestra un aviso.

### Compatibilidad con Netu

Netu en `https://hqq.tv` se abre sin el atributo sandbox, como en el reproductor de TioAnime. Su código intenta modificar document.domain, operación prohibida en un iframe sandboxed. Esta excepción se limita al servidor etiquetado Netu y al hostname exacto hqq.tv. Cada apertura crea un iframe nuevo y el resto de servidores conserva el sandbox. Netu puede abrir publicidad o intentar redirecciones; el modo no garantiza reproducción ni elimina comprobaciones de origen, cookies o bloqueos del proveedor. Se verificó la configuración con pruebas de DOM; falta comprobar la reproducción en navegador y TV.

## Pantalla de lanzamiento de webOS

`appinfo.json` configura `splashBackground: splash.png`, un PNG de 1920 × 1080 con fondo #18142f y logo centrado. Se genera con `scripts/create-splash.ps1`. Es una pantalla estática que webOS muestra durante el arranque, anterior a la interfaz HTML. No reemplaza la animación nativa del indicador de carga: LG no proporciona una API para personalizarla. No se muestra al abrir la vista en un navegador de escritorio; debe verificarse en una TV.

## Organización de la interfaz

El menú marca la sección activa con un subrayado, separado del contorno de foco del mando. Las tarjetas limitan títulos a dos líneas y separan el número de episodio. La ficha agrupa portada, título, metadatos y sinopsis e incluye Continuar cuando el historial contiene un episodio disponible de ese anime; este botón vuelve a la selección de servidor, sin reanudar minutos de video. La paginación muestra el número de página y desactiva los extremos sin destino. Recientes ofrece un botón compacto de eliminación por anime con nombre accesible. Los servidores muestran la identidad del episodio y opciones numeradas. Se mantiene el fondo #18142f y las animaciones ligeras, con soporte para movimiento reducido.
