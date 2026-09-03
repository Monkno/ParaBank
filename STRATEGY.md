# Estrategia — Suite E2E de ParaBank

## 1. Qué se entrega

72 tests en 14 archivos, verdes sin reintentos, en ~1.5 min con 2 workers.
Cubren **24 de los 28 casos** de `TEST_CASES.md`. Cuatro no están, a propósito:
ver §6.

Además de los casos funcionales, la suite incluye tests con prefijo `D##` que no
prueban una funcionalidad sino que **fijan un defecto de la aplicación**. Están
escritos para romperse el día que ParaBank se arregle, de modo que el catálogo de
§7 no se vuelva mentira en silencio.

## 2. Arquitectura

Cuatro capas, cada una con una sola razón de existir.

```
tests/         qué se verifica  — solo aserciones, sin selectores
  ↓
src/flows/     secuencias reutilizables (registrar, entrar, crear datos)
  ↓
src/pages/     una pantalla — selectores y acciones
src/components/ fragmentos compartidos entre pantallas
  ↓
src/support/   API REST, dinero, fechas
```

- **Page objects (12)** — uno por pantalla de ParaBank. Ningún selector vive fuera
  de `src/pages` o `src/components`.
- **Flows** — `SessionFlow` (registro, login, logout) y `CustomerFlow` (alta de un
  cliente con cuentas y movimientos listos para usar). El registro aparece en la
  mayoría de los tests; está escrito una sola vez.
- **Fixtures** (`src/fixtures/test.ts`) — inyectan páginas, la sesión ya iniciada
  (`signedIn`) y el cliente de API. Un test que necesita un usuario logueado con
  cuentas no escribe una sola línea de setup.
- **`src/support/api.ts`** — cliente REST. Se usa para **verificar por backend** lo
  que la UI afirma, no para saltearse la UI.
- **`src/support/money.ts`** — toda la aritmética de dinero en **centavos enteros**.
  Nunca se comparan floats: `0.1 + 0.2` no es `0.3`, y en un banco eso importa.
  Tiene sus propios tests unitarios (`tests/unit`), que no tocan la red.

## 3. Aserciones: por qué no alcanza el cartel de confirmación

Es una aplicación bancaria. La aserción que vale es **aritmética sobre saldos**:
leer el saldo antes, ejecutar la operación, leer después y verificar que la
diferencia es exactamente el importe.

`TC18 + TC19` es el ejemplo: no verifica que aparezca *Transfer Complete*, sino que
la cuenta origen bajó exactamente el importe, la destino subió exactamente el
importe, y que el movimiento quedó registrado en ambas. Lo mismo en `TC16`
(apertura de cuenta: el depósito se mueve **y nada más se mueve**) y `TC24`
(préstamo aprobado: se descuenta el anticipo y la cuenta nueva queda fondeada).

Un cartel de confirmación prueba que el servidor respondió, no que el dinero se
movió. Esa distinción es justamente la que hizo caer los tests de Bill Pay (§7,
D17).

## 4. Estabilidad sobre una base compartida

`parabank.parasoft.com` es una instancia pública, compartida con todo el que la
use, y se resetea sin aviso.

- **Cada test crea su propio cliente**, con username, nombre, apellido y SSN únicos
  por worker y por milisegundo. Ningún test lee, modifica ni asume la existencia de
  datos preexistentes.
- **Ningún ID ni saldo hardcodeado.** Todo lo que un test necesita, lo crea.
- **Las aserciones negativas se prueban sobre datos propios.** "No se creó nada" no
  se verifica contando filas globales —otro usuario puede estar creando en paralelo—
  sino comprobando que *lo que este test habría creado* no existe.
- **`admin.htm` no se toca jamás.** Ver D06: esa página no pide autenticación y
  expone borrado e inicialización de la base. Usarla para preparar datos rompería el
  demo para todos.
- **Cero `waitForTimeout`.** Toda espera es sobre una condición observable.

### El rate limit de Cloudflare

Medido: con **4 workers** la suite dispara el rate limiting de Cloudflare que está
delante del demo, y los tests empiezan a caer por respuestas cortadas. Con **2**
corre limpia en ~1.5 min. Ese es el default.

Vale aclarar qué **no** es el rate limit, porque fue una hipótesis que se probó y se
descartó: 20 requests secuenciales y 20 en paralelo a `index.htm` devuelven las 40
un `200`, sin `429` ni `retry-after`. El límite aparece con la carga sostenida de
varios navegadores reales, no con volumen de requests simples. Y los fallos de §6
**no** venían de ahí: se reprodujeron con **un solo worker**, sin concurrencia
alguna.

### Flakiness residual de la aplicación

En una de las corridas de verificación, un test cayó porque ParaBank **rechazó un
registro sin renderizar ningún mensaje de error**. La corrida siguiente, idéntica,
pasó completa. No es un test inestable: es la aplicación rechazando registros de
forma intermitente. Como el registro es el primer paso de casi todos los tests,
cualquier test puede caer por esta causa. No se tapó con reintentos; queda
documentado (D21).

## 5. Redundancia

- **TC18 y TC19 son un solo test.** TC19 (el movimiento queda registrado) es TC18
  más una lectura extra sobre la misma transferencia. Separarlos duplicaría una
  transferencia real en una base compartida sin probar nada nuevo.
- **TC01 y TC02 se solapan** en la navegación del pie. TC01 verifica el contenido de
  la home; TC02, que cada destino responde y renderiza lo suyo.
- **TC14 se partió en tres** (match, SSN incorrecto, formulario vacío) porque cada
  uno prueba una rama distinta del lookup.
- **TC10 y TC11 eran casi el mismo test** con distinto mensaje esperado. TC10 salió
  de la suite por D19; TC11 quedó.

## 6. Los cuatro casos que no están, y por qué

`TC08`, `TC10`, `TC20` y `TC22` tenían tests escritos. Fallaban de forma
reproducible, **con un solo worker**, y fallaban porque la aplicación no hace lo que
el caso describe. Se retiraron en lugar de aflojar la aserción hasta que pasara: un
test que afirma menos de lo que el caso pide es peor que ningún test, porque
aparenta cobertura.

El hallazgo no se perdió: cada uno quedó como defecto (D17–D20).

Junto con ellos salieron tres tests de defecto —`D07`, `D13`, `D14`— por la misma
razón.

**Advertencia de honestidad:** estos siete tests se retiraron, no se depuraron. Lo
que sigue en §7 describe el síntoma observado, no una causa raíz confirmada. En
particular, en D17 no se distinguió entre "la aplicación no debita" y "el helper
espera la señal equivocada". Confirmarlo es el primer trabajo pendiente.

## 7. Defectos encontrados en la aplicación

Los `D##` con test están fijados por la suite y se romperán si se arreglan.
Los marcados *(sin test)* salieron de la suite y solo están documentados acá.

### Seguridad

| # | Defecto |
|---|---|
| **D01** | `GET /services/bank/accounts/{id}`, `/customers/{id}` y `/accounts/{id}/transactions` responden **200 sin autenticación**. Un llamador anónimo lee saldo, tipo de cuenta, nombre, dirección y **SSN** de cualquier cliente, iterando IDs. |
| **D02** | *Forgot login info* devuelve usuario y **contraseña en texto plano** y, además, **abre la sesión** del visitante. Encadenado con D01 —que entrega los datos personales que el lookup pide— la cadena completa es una toma de control de cuenta partiendo de un número de cuenta. |
| **D04** | `activity.htm` se sirve **sin sesión** (200 con su shell completo), mientras sus pares sí se rechazan. Hoy no filtra datos porque delega en el AJAX autenticado, pero la guarda del servidor no está. |
| **D05** | *Update Contact Info* **incrusta la contraseña del cliente en el HTML** de la página. |
| **D06** | `admin.htm` **no pide autenticación** y expone `action=CLEAN` (borra la base), `action=INIT`, un campo `shutdown` y parámetros globales (`minimumBalance`, `loanProcessorThreshold`). Cualquiera puede vaciar el demo. |
| **D08** | `services.htm` sirve el *service list* de Apache CXF de **otra demo ajena** (Parasoft Bookstore), inyectando un documento HTML completo dentro del panel, y publica en el cuerpo credenciales WS-Security (`soatest`/`soatest`). |
| **D11** | Un cliente autenticado puede leer el detalle de cuenta **de otro cliente**. |
| **D15** | El `jsessionid` viaja **en la URL** de cada link interno. Se filtra por referrer, historial y logs de proxy. |
| **D16** | El redirect de logout expone el tipo de conexión al backend (`ConnType=JDBC`). Intermitente. |

### Funcionales

| # | Defecto |
|---|---|
| **D03** | Las páginas privadas sin sesión responden **HTTP 500** con una traza genérica, en vez de redirigir al login. No filtra datos, pero convierte un problema de autorización en un error de servidor, indistinguible de una caída real. |
| **D09** | El formulario de contacto acepta un **email mal formado** y un **teléfono no numérico**. |
| **D10** | *Phone #* **no es obligatorio**, ni en el registro ni en *Update Contact Info*, pese a estar rodeado de diez campos que sí lo son. |
| **D12** | Un importe de transferencia vacío produce un **error interno** en vez del mensaje de validación. |
| **D07** *(sin test)* | Con el navegador al oeste de UTC, cada transacción se muestra **un día antes** de su fecha real. |
| **D13** *(sin test)* | Bill Pay permite un **sobregiro**: acepta un pago mayor al saldo y deja la cuenta en negativo. |
| **D14** *(sin test)* | Un préstamo aprobado acredita la cuenta nueva **sin generar la transacción** correspondiente. |
| **D17** *(sin test)* | **Bill Pay confirma el pago pero el saldo no se mueve.** Los tres tests que envían un pago real fallaron con el saldo de origen sin cambios tras 30 s (`last observed balance 515 ... unchanged from 515`). El único test de Bill Pay que quedó verde (TC21) es el que **no** envía nada. Ver la advertencia de §6: síntoma observado, causa no confirmada. |
| **D18** *(sin test)* | Bill Pay con `Account #` y `Verify Account #` distintos no se comporta como el caso esperaba; el saldo tampoco se movió. Probablemente el mismo síntoma que D17. |
| **D19** *(sin test)* | Un login con **usuario inexistente** —o con la contraseña equivocada— devuelve *"An internal error has occurred and has been logged."* en vez de *"The username and password could not be verified."*. Un error de credenciales se presenta como una falla del servidor. |
| **D20** *(sin test)* | El registro con contraseñas que no coinciden no muestra el mensaje de validación esperado. El texto real no quedó capturado antes de que se limpiaran los artefactos; hay que reproducirlo. |
| **D21** *(sin test)* | ParaBank **rechaza registros de forma intermitente sin renderizar ningún mensaje de error**. Observado una vez en dos corridas completas idénticas. Como el registro abre casi todos los tests, es la fuente de inestabilidad más probable de la suite. |

## 8. Gaps y qué haría primero

En orden:

1. **Confirmar D17.** Es el defecto más grave del catálogo —un pago que se confirma
   sin mover dinero— y es el único donde no separé bug de la aplicación de un helper
   mal escrito. Hasta resolverlo, Bill Pay está efectivamente sin cobertura.
2. **Recuperar TC10.** El login negativo es cobertura central y hoy no existe. Una
   vez decidido si D19 es el comportamiento aceptado, el caso se reescribe contra lo
   que la app hace.
3. **Reproducir D20 y D21** con artefactos retenidos (`--trace on`), para poder
   describirlos con precisión.
4. **Concurrencia bancaria:** dos transferencias simultáneas sobre la misma cuenta.
   Es donde un banco realmente se rompe, y la suite no lo toca.
5. **Bordes de importes:** cero, negativos, más decimales que centavos, importes
   enormes.
6. **SOAP** (`services/ParaBank?wsdl`) — sin cubrir; la suite es UI + REST.
7. **Accesibilidad y cross-browser** — corre solo en Chromium.

## 9. Supuestos y trade-offs

- **Chromium únicamente.** Los defectos encontrados son de servidor y de datos, no
  de motor de render; agregar navegadores multiplicaría el tiempo contra un demo
  compartido sin cambiar los hallazgos.
- **2 workers**, elegido por medición y no por costumbre. Prioriza no degradar un
  servicio público compartido por sobre la velocidad de la suite.
- **La API se usa para verificar, no para atajar.** Los flujos se ejecutan por UI
  aunque hacerlos por REST fuera más rápido y estable: lo que se está probando es la
  interfaz.
- **Los datos creados no se borran.** ParaBank no expone una operación de borrado de
  clientes fuera de `admin.htm`, y `admin.htm` está prohibido (D06). Cada corrida
  deja usuarios nuevos en el demo. Es una deuda consciente, impuesta por la
  aplicación.
- **Retries en 1 localmente, 2 en CI**, pero la verificación de entrega se hizo con
  `--retries=0`: el verde reportado no depende de reintentos.
