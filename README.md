# TioAnime TV para LG webOS

Autor: **zentoo31**.

Aplicación independiente, sin afiliación a TioAnime. Release **Luna 2 - Experimental** (0.5.1-luna.2; paquete webOS 0.5.1).

## Funciones

- Inicio con episodios recientes y miniaturas del sitio.
- Directorio con paginación y búsqueda; selector TioAnime/JKAnime en búsquedas.
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
ares-install --device NOMBRE_TV dist/com.tioanime.tv_Luna-2_0.5.1_all.ipk
ares-launch --device NOMBRE_TV com.tioanime.tv
```

Sustituye `NOMBRE_TV` por el dispositivo configurado. La sesión Developer Mode debe estar activa. El paquete incluye la interfaz y el servicio.

## Uso y límites actuales

Flechas y OK recorren las tarjetas. En la búsqueda, izquierda/derecha editan el texto; arriba/abajo salen del campo. Atrás regresa a la vista anterior y, desde Inicio, usa la salida de webOS.

Al elegir servidor se abre su reproductor externo. El botón superior permite cerrarlo. Atrás y el botón rojo también lo cierran **cuando la app conserva el foco**. Si el foco entra en un iframe externo, sus eventos no llegan a la app: puede ser necesario usar el puntero del Magic Remote para pulsar el cierre. No se garantiza manejo completo con un mando sin puntero.

Los proveedores pueden bloquear iframes, exigir interacciones, presentar publicidad o usar formatos no soportados por la TV. El modo protegido restringe popups, navegación superior y fullscreen del iframe. El modo compatible, opcional, puede permitir publicidad o redirecciones fuera de la app. No se eluden bloqueos ni se resuelven desafíos automáticamente.

Pendiente de validar en una LG real: arranque del servicio y permisos, TLS del firmware, renderizado, teclado virtual, controles de cada servidor, reproducción y regreso desde el iframe. Aún no se conoce el modelo ni la versión webOS de destino. Un cambio en el HTML de TioAnime puede requerir actualizar el analizador.

Referencias: [servicios JS de LG](https://webostv.developer.lge.com/develop/guides/js-service-usage), [manejo de Atrás](https://webostv.developer.lge.com/develop/guides/back-button).


## Animaciones

Las tarjetas tienen una entrada de 180 ms limitada a las primeras ocho. El foco y la pulsación desplazan los botones unos pocos píxeles en 120 ms. Un pequeño indicador pulsa solo durante la carga. Se usan transform y opacity con prefijos WebKit, sin librerías ni capas permanentes; se respeta prefers-reduced-motion donde el motor lo soporte. La fluidez final requiere comprobarse en el modelo de TV de destino.

## Vistos recientemente

La sección Recientes guarda hasta 50 animes en localStorage del dispositivo, con una sola entrada por anime y el último episodio abierto al elegir un servidor. Se ordena por apertura más reciente y permite regresar a la selección de servidor del episodio. No guarda minutos de reproducción ni confirma que el video haya comenzado: los reproductores externos no exponen ese estado a la app. El historial es local, no se sincroniza con TioAnime y puede perderse al borrar los datos o desinstalar la app. Si falla la escritura, la sesión mantiene el historial en memoria y muestra un aviso.

### Compatibilidad de los reproductores

En 0.2.1 se quitaron las restricciones para resolver rechazos por sandbox. Las pruebas en TV reportaron anuncios que reemplazaban la app. Desde 0.2.4 se usa modo protegido por defecto; ver las opciones de reproducción descritas abajo.

## Pantalla de lanzamiento de webOS

`appinfo.json` configura `splashBackground: splash.png`, un PNG de 1920 × 1080 con fondo #18142f y logo centrado. Se genera con `scripts/create-splash.ps1`. Es una pantalla estática que webOS muestra durante el arranque, anterior a la interfaz HTML. No reemplaza la animación nativa del indicador de carga: LG no proporciona una API para personalizarla. No se muestra al abrir la vista en un navegador de escritorio; debe verificarse en una TV.

## Organización de la interfaz

El menú marca la sección activa con un subrayado, separado del contorno de foco del mando. Las tarjetas limitan títulos a dos líneas y separan el número de episodio. La ficha agrupa portada, título, metadatos y sinopsis e incluye Continuar cuando el historial contiene un episodio disponible de ese anime; este botón vuelve a la selección de servidor, sin reanudar minutos de video. La paginación muestra el número de página y desactiva los extremos sin destino. Recientes ofrece un botón compacto de eliminación por anime con nombre accesible. Los servidores muestran la identidad del episodio y opciones numeradas. Se mantiene el fondo #18142f y las animaciones ligeras, con soporte para movimiento reducido.



## Miniaturas en TV (0.2.2)

Las tarjetas usan ancho de columna explícito y min-width: 0. La proporción 16:9 de Inicio y Recientes y 2:3 del directorio se reserva con un espaciador en flujo normal, en lugar de padding porcentual sobre un hijo flex. Así la geometría no depende del tamaño original ni de la carga de cada imagen. Pendiente de confirmar el resultado visual en el dispositivo reportado.



## DNS de Cloudflare integrado (0.2.3)

El cliente del catálogo resuelve tioanime.com usando DNS sobre HTTPS de Cloudflare, sin usar el DNS del sistema ni cambiar ajustes de la TV o del router. Para llegar al resolvedor usa directamente 1.1.1.1 y, si falla, 1.0.0.1, conservando el hostname cloudflare-dns.com para TLS. Luego conecta a TioAnime mediante la dirección obtenida, conservando tioanime.com en Host/SNI y la validación normal del certificado. No se deshabilita TLS. Las respuestas IPv4 se cachean según TTL con un máximo de cinco minutos y las consultas simultáneas se agrupan. Si ambos resolvedores fallan, se informa del error sin recurrir al DNS del sistema.

Aplica a inicio, directorio, búsquedas, fichas y listas de servidores consultadas por service/client.js. Las imágenes cargadas directamente por la interfaz y los reproductores externos siguen usando la red y el DNS del motor web de la TV. No es un proxy ni una VPN y no resuelve bloqueos por dirección IP o filtrado de conexiones HTTPS.

`npm run test:dns` verifica una consulta real del catálogo con dns.lookup deshabilitado únicamente dentro del proceso de prueba. No cambia el DNS del equipo. La compatibilidad TLS del firmware de la TV debe comprobarse en el dispositivo.

Referencia: https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/


## Reproducción protegida y diagnóstico (0.2.4)

Cada servidor abre en modo protegido, con sandbox que permite scripts, origen, formularios y presentación, pero sin popups ni navegación superior. También se retira el permiso de fullscreen del proveedor para que no oculte los controles de la app. El video sigue ocupando el área de reproducción de la TV. Esto no elimina publicidad dentro del iframe y algunos proveedores detectan/rechazan estas restricciones.

El botón Probar compatibilidad presenta una confirmación y reabre ese servidor sin sandbox. Este modo puede permitir anuncios que reemplacen la app: no garantiza conservar el botón Volver. Volver al modo protegido recrea el iframe con las restricciones. Cada nueva selección de servidor arranca protegida; no se guarda una excepción global.

YourUpload se comprueba previamente mediante una petición HTTPS limitada a enlaces exactos https://www.yourupload.com/embed/ID. Si responde 404 o 410 se muestra un mensaje con Elegir otro servidor, sin abrir el enlace roto. Si la comprobación falla por red se intenta igualmente el iframe, porque el comportamiento del servicio puede diferir del navegador del TV. Un HTTP 200 no acredita que el video esté disponible ni sea compatible. El enlace de Tokyo Ghoul 12 comprobado respondió 404. Otros casos de pantalla negra requieren probar el episodio y firmware concretos.

Las pruebas de DOM cubren protección, confirmación, cambio de modo, salida, error 404, apertura con HTTP 200 e ignorar respuestas tardías después de cerrar. La prueba definitiva de reproducción y anuncios sigue pendiente de la TV.


## YourUpload con reproductor de la app (0.2.5)

Para enlaces activos, el servicio lee el MP4 público de los metadatos og:video de YourUpload, sin ejecutar sus scripts. Solo admite fuentes HTTPS de vidcache.net y sus subdominios. El reproductor HTML5 local ofrece pausa, saltos de diez segundos y salida con Atrás o botón rojo. Probar reproductor web permite volver al iframe cuando sea necesario. Los errores de conexión, decodificación y fuente se muestran en pantalla; no se afirma compatibilidad por la extensión MP4.

El archivo comprobado exige Referer de YourUpload y redirige a otro servidor de vidcache.net. Por ello el servicio retransmite el flujo a través de un servidor HTTP ligado exclusivamente a 127.0.0.1, en un puerto asignado por el sistema. Cada URL local tiene un token aleatorio temporal; no se aceptan URLs de destino desde las peticiones entrantes. No se almacena el video completo: se transmite con soporte de Range y contrapresión. Las redirecciones están limitadas a tres y a fuentes MP4 HTTPS de vidcache.net. Se mantiene la validación TLS remota. Una suscripción Luna mantiene el servicio activo mientras se reproduce y se cancela al cerrar o cambiar de reproductor.

Verificado: fuente real accesible por retransmisión local con HTTP 206 y bytes parciales, y pruebas de controles, limpieza, redirecciones, referencias, tokens y destinos permitidos. Pendiente: decodificación, certificados y conexión loopback en la TV del usuario. El número 3.54.45 no se ha confirmado como versión de plataforma; se necesita el modelo completo para determinar el motor exacto. El DNS integrado del catálogo no se aplica todavía a los dominios externos de video.


## Pantalla completa, mando y VOE (0.2.6)

El botón Pantalla completa junto a pausa amplía el área del reproductor propio y oculta el encabezado. El primer Atrás reduce la pantalla, manteniendo el video; el segundo cierra el reproductor. Se reconocen también fullscreen y webkitfullscreen del navegador/video. En la TV se usa un estado CSS propio para conservar el control del mando; en PC se solicita además fullscreen del contenedor cuando está disponible.

La búsqueda permanece readonly al recorrerla. Solo OK o clic activan la edición y el teclado; al salir del campo se restaura readonly. El evento keyboardStateChange devuelve el foco al botón Buscar cuando se cierra el teclado. cursorStateChange recupera un botón navegable al desaparecer el puntero. Las flechas también recuperan foco si estaba en el video, un iframe u otro elemento fuera de la navegación. No se puede interceptar desde la app una tecla consumida por un iframe de otro origen; la recuperación depende en ese caso del evento del sistema.

VOE se integra experimentalmente con HLS en el reproductor propio: el servicio lee los datos JSON codificados de su página sin evaluar scripts. Se admite voe.sx y el espejo megankiddifference.com observado en la prueba, con identidad de video coincidente; la fuente debe ser HTTPS del CDN cloudwindow-route.com. No se usan enlaces de descarga marcados como no permitidos. La lista principal y variante HLS se comprobaron con HTTP 200. Debe verificarse decodificación en la TV. Si el navegador no dispone de HLS nativo se conserva el iframe; no se añadió una biblioteca de reproducción pesada.

Mega conserva su iframe: a diferencia de los enlaces MP4/HLS públicos, requiere descarga y descifrado del cliente. No se añadió una integración nativa de Mega en esta versión.


## Navegación entre episodios (0.2.7)

Siguiente y Episodios están disponibles en la página del episodio, en el encabezado de reproductores externos y junto a los controles del reproductor propio. Siguiente utiliza exclusivamente el enlace publicado en .episodes-nav de TioAnime; se desactiva si no existe. En 0.2.7 intentaba conservar el servidor y su modo; desde 0.2.8 se muestra siempre la selección del capítulo de destino. Si el proveedor no está en el siguiente capítulo se muestra su selector. Desde 0.2.8 cambiar de capítulo cierra la reproducción y la pantalla ampliada para permitir elegir servidor. Cambiar de episodio o abrir la lista detiene y libera el video anterior.

Cada tarjeta de Recientes dispone de Episodios para abrir la ficha y su lista completa, además de su acción de reanudar y la eliminación individual.

Netu se investigó con el embed de Tokyo Ghoul 12. La página revisada no entrega una fuente directa reproducible: la solicita mediante un flujo de validación interactiva con coordenadas, hash y estado de sesión; la URL HLS visible en el HTML corresponde a un ejemplo comentado antiguo. No se añadió una integración nativa de Netu ni se automatizaron esas validaciones. Se conserva su iframe y la elección de modo protegido/compatible.


## Anterior, selección de servidor y Okru (0.2.8)

Anterior y Siguiente usan únicamente los enlaces que publica TioAnime. Siempre cierran el video y abren la selección de servidores, sin reproducción automática. Los extremos se desactivan cuando no existe destino. En reproducción, Anterior/Episodios/Siguiente están solo abajo; se retiraron del encabezado. Los iframes disponen de su propia barra inferior de navegación. En la página de selección de servidor también están las tres acciones.

Opening +1:25 adelanta 85 segundos desde la posición actual y respeta la duración disponible. Es un salto manual del reproductor propio; no detecta dónde empieza el opening ni puede controlar el tiempo de un iframe externo.

Okru se integra a partir de los metadatos JSON públicos de sus embeds, sin ejecutar scripts. Selecciona una variante MP4 accesible (hasta HD preferentemente), ignora variantes marcadas disallowed y solo admite fuentes HTTPS del CDN okcdn.ru. Respeta los estados de video eliminado o restringido que publica el servidor. Se comprobó Naruto 12 (Okru 4829465938674) con HTTP 206, video/mp4 y 32 bytes parciales. Falta confirmar decodificación en la TV. Si no se obtiene una variante permitida se mantiene el iframe.

Amus y Mepu: los enlaces revisados en Naruto 1 devolvieron 404, también con Referer de TioAnime. StreamSB: el embed revisado no fue accesible desde este equipo. No se añadió soporte nativo no verificable para estas tres fuentes; conservan su iframe.


## Cronología del anime (0.2.9)

Las fichas muestran Cronología entre la sinopsis y los episodios cuando TioAnime publica esa sección. Se extraen exclusivamente las tarjetas de .w-history, respetando su orden, con portada, título y año. No se confunden con recomendaciones, ni se incluyen duplicados, el anime actual o enlaces externos. Al seleccionar una tarjeta se abre su ficha; Atrás restaura el foco en la tarjeta original. Si no hay cronología se oculta la sección. Se comprobó el vínculo real Naruto → Naruto Shippuden y pruebas de extracción, navegación y limpieza entre vistas.

## JKAnime como fuente alternativa (0.3.0)

Inicio y Directorio siguen siendo TioAnime. Al buscar aparece Buscar en con TioAnime seleccionado inicialmente y JKAnime como alternativa. Cambiar fuente conserva el texto y carga sus resultados dentro de la app. Las fichas de JKAnime muestran metadatos y episodios paginados; cambiar de episodio abre su selector de servidores. Los recientes conservan el origen, permiten reanudar y abrir Episodios, y mantienen los registros anteriores de TioAnime.

Desu y Magi se reproducen mediante el reproductor de la app: el servicio lee el enlace HLS público sin ejecutar scripts remotos, y retransmite listas, segmentos y claves admitidas mediante URLs temporales en 127.0.0.1. No descarga el episodio completo. El catálogo, las portadas de JKAnime y estos flujos de video resuelven cada dominio mediante Cloudflare DoH, manteniendo certificados y SNI. VOE, Okru y YourUpload gestionados por el servicio también usan ese resolvedor. No se permite usar el retransmisor como proxy de destinos arbitrarios.

Los proveedores externos conservan su iframe protegido y se identifican como Web externo · DNS de la TV: su red pertenece al navegador y no pasa por el resolvedor del servicio. Esto incluye Mega y los servidores sin adaptación nativa. Las portadas de TioAnime también siguen cargándose directamente. Por ello no se garantiza que todas las opciones funcionen en redes bloqueadas ni en todos los firmwares.

En PC, cuando no existe HLS nativo, se carga bajo demanda la versión light de hls.js 1.7.3 incluida en app/vendor, con su licencia Apache 2.0. En webOS se usa el reproductor nativo sin cargar esa biblioteca.

Prueba reproducible: `npm run test:jkanime`. Verifica búsqueda, ficha, dos páginas de episodios y portada; para Shingeki no Kyojin 1 comprueba Desu y Magi con lista HLS HTTP 200 y segmento MPEG-TS HTTP 206 de 1024 bytes. El DNS del sistema se deshabilita solo en el proceso de prueba. Esto verifica acceso a los flujos; la decodificación, sonido y controles se deben comprobar en la TV.

Prueba manual: buscar Shingeki, seleccionar JKAnime, abrir la primera temporada y el episodio 1, elegir Desu o Magi, comprobar pausa/pantalla completa/Atrás y Siguiente, volver a Recientes y abrir Episodios. Al regresar a Inicio o Directorio, la fuente sigue siendo TioAnime.

## Corrección de VOE (0.3.1)

VOE ahora redirige al espejo ashleyhardat.com. Se admite ese dominio observado además del espejo anterior, conservando el mismo identificador de video, TLS y DNS de Cloudflare. No se ejecutan los scripts de redirección ni se admiten destinos arbitrarios. La corrección se aplica al adaptador compartido por TioAnime y JKAnime.

`npm run test:voe` comprueba enlaces publicados en Dark Summoner to Dekiteiru 4 (TioAnime) y Shingeki no Kyojin 1 (JKAnime): lista principal y variante HLS HTTP 200, segmento MPEG-TS HTTP 206 de 1024 bytes, sin DNS del sistema. Las pruebas unitarias rechazan espejos desconocidos e identificadores distintos. La decodificación en la TV requiere comprobarse en el dispositivo.

## HiAnime y subtítulos (0.4.0)

HiAnime aparece únicamente como tercera fuente al buscar. TioAnime conserva Inicio, Directorio y la búsqueda inicial. Los resultados de HiAnime abren sus propias fichas y episodios; Recientes conserva el origen y el número real de episodio, separado de su identificador interno.

La fuente comprobada es https://hianime.at. El catálogo, las portadas admitidas, ZokoAnime y sus recursos se consultan por Cloudflare DoH. ZokoAnime ofrece SUB y DUB; SUB usa pistas WebVTT separadas del video. En Attack on Titan 1 se observaron inglés, español y portugués: los idiomas dependen del episodio y del proveedor. No se traducen ni se generan subtítulos.

El botón Subs recorre los idiomas y Desactivados con OK o clic. Se preselecciona español si existe; de lo contrario se usa la pista predeterminada. Las pistas se retransmiten por loopback con CORS, igual que el HLS. Para conservar compatibilidad con webOS antiguo, se muestran como texto seguro sobre el video, sincronizado con currentTime; se retira el formato específico de WebVTT. Cambiar idioma, servidor o episodio cancela la petición anterior y limpia el texto. La pantalla completa de la app conserva esa capa; el fullscreen propio del elemento de video puede depender del firmware.

HD-1 (MegaPlay) conserva el reproductor web protegido y el DNS de la TV; no se afirma reproducción nativa de ese servidor. Los dominios de video están limitados a los observados. Un cambio de CDN puede requerir actualizar el adaptador.

`npm run test:hianime` verifica búsqueda, ficha, 25 episodios, portada, navegación, lista HLS y variante HTTP 200, segmento MPEG-TS HTTP 206 y subtítulos Spanish WebVTT HTTP 200 para Attack on Titan 1, con DNS del sistema deshabilitado en el proceso. También se comprobó un segmento de la opción DUB. Las pruebas de DOM cubren el selector de fuente, recientes, elección de subtítulos, sincronización al buscar una posición, respuestas tardías y limpieza. Pendiente: decodificación y presentación visual en la LG del usuario.


## Luna 1 - Experimental

Ver [cambios, limitaciones y prueba en TV](docs/luna-1.md).


## Luna 2 - Experimental

Ver [iconos, servidores y salida de la barra de tiempo](docs/luna-2.md).
