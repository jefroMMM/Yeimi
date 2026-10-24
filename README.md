# Hotel Aurora

Proyecto universitario de reservas de hotel, completamente en español. Permite elegir habitación, fechas y huéspedes, calcular noches y total, confirmar una reserva con UUID y guardarla en SQLite. No requiere cuentas, servicios externos ni pagos. La interfaz usa azul oscuro, blanco y dorado.

Repositorio público: https://github.com/jefroMMM/Yeimi

## Requisitos e instalación

Node.js **22.23.2** (o una versión compatible >=22.13) y npm. SQLite viene incluido en Node mediante `node:sqlite`: no hace falta instalar un servidor de base de datos. Node 22 puede mostrar una advertencia de API experimental.

```sh
git clone https://github.com/jefroMMM/Yeimi.git
cd Yeimi
npm ci
npm run db:seed
npm start
```

Abrir http://127.0.0.1:4310. Para cerrar el servidor usar Ctrl+C. `db:seed` elimina las reservas de la base normal: usarlo solo para volver a los datos iniciales de esta demostración.

## Arquitectura

```text
Navegador: public/index.html + styles.css + app.js
             | fetch JSON
Express: server.js /api/rooms y /api/reservations
             | consultas preparadas + transacción
SQLite: data/hotel.sqlite (normal) o data/hotel-test.sqlite (pruebas)
```

El navegador calcula el resumen, pero el servidor vuelve a validar fechas reales, entrada desde hoy, salida posterior, capacidad y habitación disponible. Calcula el precio desde su propia tabla, sin confiar en un total enviado por el cliente. Las fechas son días sin hora y se comparan en UTC para evitar cambios por horario de verano.

Una transacción `BEGIN IMMEDIATE` comprueba disponibilidad e inserta la reserva. Hay además un trigger contra solapamientos. Dos reservas chocan si `entradaExistente < salidaNueva` y `salidaExistente > entradaNueva`. Se permite salir el mismo día en que llega otra reserva. La habitación 3 está fuera de servicio y no se puede reservar.

| Método y ruta | Función |
| --- | --- |
| GET /api/health | Estado y modo normal/test |
| GET /api/rooms | Habitaciones, precios, capacidad y disponibilidad general |
| GET /api/rooms?checkIn=AAAA-MM-DD&checkOut=AAAA-MM-DD | Disponibilidad para un período |
| POST /api/reservations | Crear; cuerpo: roomId, checkIn, checkOut, guests; respuesta 201 con id, nights y total |
| GET /api/reservations | Consultar reservas persistidas |
| GET /api/reservations/:id | Consultar una reserva |
| POST /api/test/reset | Reiniciar datos; **solo existe con `--test`** |

Los errores devuelven JSON y códigos 400 (validación), 404 (no existe), 409 (sin disponibilidad) o 500 (error interno). Es una demostración local sin autenticación, no un servicio público de producción.

## Pruebas y comandos

```sh
npm run typecheck
npm run test:api
npm run db:seed:test
npm run test:e2e
npm run test:e2e:reverse
```

`test:e2e` inicia la aplicación en el puerto 4311, espera `/api/health`, ejecuta Cypress headless y cierra el servidor. `test:e2e:reverse` hace lo mismo con los archivos 03, 02, 01. No tener otro servidor usando 4311 al ejecutarlos. `test:api` también necesita ese puerto libre y prueba, entre otras cosas, persistencia después de reiniciar el proceso.

Para ver Cypress interactivamente, usar dos terminales:

```sh
# Terminal 1
npm run start:test
# Terminal 2
npm run cy:open
```

Con el servidor de pruebas ya abierto: `npm run cy:run` y `npm run cy:reverse`. La baseUrl es http://127.0.0.1:4311, el navegador headless es Electron y las pruebas están en TypeScript. No se necesita Cypress Cloud.

### Tres recorridos

1. **Reserva exitosa:** reinicia datos, selecciona habitación 1, toma fechas de hoy +30 y +33 días, selecciona dos huéspedes y verifica tres noches por USD 255. Confirma, verifica un UUID y consulta la API para comparar todos los campos persistidos.
2. **Validación:** intenta confirmar sin fechas y después con fechas invertidas. Verifica los mensajes, observa con un spy que no hubo POST de creación y consulta que SQLite sigue sin reservas.
3. **Fallo y recuperación:** llena el formulario, intercepta el primer POST con `times: 1` y devuelve HTTP 500. Comprueba método, URL, cuerpo y respuesta mediante el alias `failure`. Verifica error, conservación de los datos y ausencia de registros. Reintenta, recibe 201 de Express y consulta la reserva real.

### Reinicio e independencia

Cada prueba usa `beforeEach(reset)`, verifica el modo `test`, llama POST `/api/test/reset` y después abre la aplicación. El seed reemplaza habitaciones y elimina reservas dentro de una transacción. El endpoint no se registra en modo normal; el nombre del archivo SQLite se elige según el argumento `--test`, sin rutas arbitrarias. El script de orden inverso ejecuta cada archivo por separado para garantizar el orden.

### Cómo evitamos flakiness

- Selectores `data-cy`, independientes del texto y del CSS.
- Esperas por alias (`cy.wait('@rooms')`, `@create`, `@failure`, `@retry`) y aserciones que Cypress reintenta. Ningún `cy.wait` usa milisegundos.
- Datos propios antes de cada prueba, sin depender de pruebas anteriores.
- Fechas futuras relativas al día actual, sin fecha fija que pueda caducar.
- Sin fuentes, imágenes, API o credenciales externas en la aplicación.
- El reintento del 500 usa la API real; no se simula la persistencia.

## GitHub Actions

El workflow `.github/workflows/e2e.yml` corre con push y pull request. Instala mediante `npm ci`, comprueba TypeScript y API, prepara SQLite, ejecuta los recorridos en ambos órdenes y publica el resumen JSON. Capturas, videos y registros se conservan 14 días como artifact, incluso cuando hay fallos. Cada ejecución comienza en una máquina limpia.

El enlace a una ejecución real y su conclusión están en `entrega/enlaces.json` y en el PDF. No debe confundirse un resultado local con una ejecución de Actions. Los informes JSON originales se conservan en `entrega/evidencias/`.

## Componentes reales y simulados

Son reales: interfaz, cálculos, Express, validaciones, consultas, SQLite y UUID. Solo se simula **una respuesta HTTP 500** del recorrido 3 desde Cypress. Ese primer intento no llega a Express. El segundo sí se guarda realmente. Las capturas del error indican explícitamente que es simulado.

## Comparación breve

| Herramienta | Uso y diferencia |
| --- | --- |
| Cypress | Pruebas E2E reproducibles en JS/TS, runner visual y control de red con `cy.intercept`. Elegido por la rúbrica. |
| Playwright | Pruebas con Chromium, Firefox y WebKit, contextos de navegador y esperas automáticas. Útil para ampliar cobertura entre navegadores. |
| Agent Browser (`agent-browser`) | CLI de automatización orientada a agentes de IA; usa referencias del árbol de accesibilidad. Útil para exploración guiada, pero una exploración no reemplaza una suite determinista con aserciones. |

Fuentes oficiales: [Cypress intercept](https://docs.cypress.io/api/commands/intercept), [capturas y videos](https://docs.cypress.io/app/guides/screenshots-and-videos), [Playwright](https://playwright.dev/docs/intro), [Agent Browser](https://agent-browser.dev/).

## Entrega y actualización del PDF

`entrega/Hotel_Aurora.pdf` reúne capturas reales, resultados, enlaces y explicación. `entrega/guion_video.md` sirve para grabar unos 2:45. El video demostrativo se debe grabar y subir manualmente; los videos automáticos de Cypress son evidencia adicional y no sustituyen la explicación del estudiante.

Para actualizar el enlace del video, editar `video_url` en `entrega/enlaces.json`. Para regenerar el PDF:

```sh
python -m pip install -r entrega/requirements.txt
python entrega/generar_pdf.py
```

Las capturas originales de Cypress se generan en `cypress/screenshots/`; se copian las seleccionadas a `entrega/evidencias/`. Las bases, dependencias y videos temporales no se suben al repositorio.

## Uso de inteligencia artificial

Se utilizó ChatGPT y Codex como apoyo para diseñar la aplicación, desarrollar código, preparar pruebas, revisar resultados y redactar documentación. El estudiante debe comprender y poder explicar la solución, revisar la entrega y grabar su demostración. No se inventaron capturas, identificadores, resultados de pruebas ni enlaces de ejecuciones.
