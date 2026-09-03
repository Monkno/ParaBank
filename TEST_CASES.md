# Test Cases — ParaBank (parabank.parasoft.com)

ParaBank es la aplicación demo de banca online de Parasoft. **No publica una lista
oficial de casos de prueba**, así que los de abajo se derivaron explorando la
aplicación en vivo el **2026-09-03**: navegando el sitio, inspeccionando el DOM de
los formularios y sondeando la API REST pública.

Cada caso lleva un ID `TC##` al que se mapea el test automatizado correspondiente.
El mapeo exacto TC## → archivo:test está en `README.md`.

**Leyenda de verificación**

- ✅ **Observado** — confirmado manualmente durante la exploración.
- 🔎 **Automatizado** — el caso está cubierto por un test que corre en verde.
- ❌ **No automatizado** — el test se retiró: la aplicación no hace lo que el caso
  describe y el desvío quedó como defecto en `STRATEGY.md`. Ver la sección 6 de ese documento.
- ⚠️ **Desvío** — la aplicación no se comporta como el caso decía. **Manda la app**:
  el caso fue reescrito para describir lo que la aplicación hace de verdad, y el
  desvío quedó registrado como defecto en `STRATEGY.md`. La aserción sigue lo
  observado; no se aflojó para que pasara.

**URL base:** `https://parabank.parasoft.com/parabank/index.htm`
(sin el `jsessionid` que la app agrega a cada link — ver D15 en `STRATEGY.md`).

---

## A. Sitio público

### TC01 — La home carga con el panel de login y las secciones informativas ✅ 🔎

1. Abrir la home.

**Esperado:** título `ParaBank | Welcome | Online Banking`; formulario *Customer
Login* con `input[name=username]`, `input[name=password]` y botón *Log In*; links a
*Register* y *Forgot login info?*; secciones de noticias y servicios no vacías.

### TC02 — La navegación principal alcanza cada página del sitio ✅ 🔎 ⚠️

1. Recorrer *Home*, *About Us*, *Services*, *Site Map*, *Contact Us* desde el pie.

**Esperado:** cada destino responde HTTP 200 con su propio título y su propio
contenido; ningún link interno rompe.

> ⚠️ **Desvío (D08).** `services.htm` no muestra los servicios de ParaBank: sirve
> el *service list* de Apache CXF de una demo SOAP ajena (Parasoft Bookstore),
> inyectando un documento HTML completo — `<!DOCTYPE>`, `<html>`, `<head>`,
> `<title>` — dentro de `<div id="rightPanel">`, y publicando en el cuerpo un
> usuario y contraseña de WS-Security (`soatest`/`soatest`). El caso se ajustó a
> lo que la app hace y hay un test dedicado (`D08`) que falla el día que se
> arregle.

### TC03 — El formulario de Contact Us acepta una consulta ✅ 🔎

1. Abrir *Contact Us*, completar nombre, email, teléfono y mensaje, y enviar.

**Esperado:** la confirmación nombra al remitente (`Thank you <nombre>`) e informa
que un representante se pondrá en contacto; el formulario desaparece.

### TC04 — Contact Us vacío muestra las validaciones de cada campo ✅ 🔎

1. Enviar el formulario de contacto sin completar nada.

**Esperado:** exactamente cuatro mensajes — *Name / Email / Phone / Message is
required.* — el formulario sigue en pantalla y no se envía la consulta.

---

## B. Registro y autenticación

> Cada test registra su propio usuario, con username, nombre, apellido y SSN únicos
> por worker y por milisegundo. Nunca se reutiliza ni se modifica un usuario
> preexistente: la base es compartida.

### TC05 — Registro de un usuario nuevo ✅ 🔎

1. Abrir *Register*, completar los once campos y enviar.

**Esperado:** `Welcome <username>` más «Your account was created successfully. You
are now logged in.»; la sesión queda abierta; se crea **una** cuenta CHECKING con
el saldo inicial que fije el servidor; y el registro almacenado coincide campo por
campo con lo tipeado (nombre, apellido, dirección completa, teléfono, SSN).

### TC06 — Registro con un username ya existente ✅ 🔎

1. Registrar un usuario. Intentar registrar otro con el mismo `customer.username`
   y todos los demás datos distintos.

**Esperado:** un único error, *This username already exists.*; no se crea un
segundo usuario y el original sigue intacto (se comprueba volviendo a entrar con
él y releyendo su registro).

### TC07 — Registro con formulario vacío ✅ 🔎 ⚠️

1. Enviar el formulario de registro sin completar nada.

**Esperado:** diez mensajes de campo obligatorio, en orden: First name, Last name,
Address, City, State, Zip Code, Social Security Number, Username, Password,
Password confirmation.

> ⚠️ **Desvío (D10).** *Phone #* **no** es obligatorio, ni en el registro ni en
> *Update Contact Info*, pese a estar rodeado de diez campos que sí lo son. El caso
> original decía «cada campo obligatorio»; el listado se cerró a los diez que la
> app valida y hay un test dedicado (`D10`) que documenta la excepción.

### TC08 — Registro con contraseñas que no coinciden ✅ ❌

> ❌ **No automatizado.** El test existía y fallaba de forma reproducible con un solo
> worker, porque la aplicación no hace lo que este caso describe. Se retiró en lugar de
> aflojar la aserción. El comportamiento real está documentado como **D20** en `STRATEGY.md`.

1. Completar el registro con `customer.password` y `repeatedPassword` distintos.

**Esperado:** un único error, *Passwords did not match.*, y no se crea el usuario —
se comprueba intentando entrar con **ambas** contraseñas.

### TC09 — Login con credenciales válidas ✅ 🔎

1. Con una cuenta existente y el navegador **deslogueado**, entrar desde la home.

**Esperado:** *Accounts Overview* con las cuentas de ese cliente (y solo esas,
cotejadas contra la API) y el menú lateral con sus ocho entradas.

### TC10 — Login con credenciales inválidas ✅ ❌

> ❌ **No automatizado.** El test existía y fallaba de forma reproducible con un solo
> worker, porque la aplicación no hace lo que este caso describe. Se retiró en lugar de
> aflojar la aserción. El comportamiento real está documentado como **D19** en `STRATEGY.md`.

1. Usuario inexistente. 2. Usuario real con contraseña incorrecta.

**Esperado:** *The username and password could not be verified.*; no se accede al
área privada; y la cuenta real sigue siendo utilizable después del rechazo.

### TC11 — Login con campos vacíos ✅ 🔎

1. Enviar el formulario de login sin completar nada.

**Esperado:** *Please enter a username and password.*; no se inicia sesión.

### TC12 — Logout cierra la sesión ✅ 🔎

1. Estando logueado, usar *Log Out*.

**Esperado:** se vuelve a `/parabank/index.htm` con el panel de login, y la misma
URL privada que funcionaba un segundo antes deja de funcionar.

### TC13 — Las páginas privadas están protegidas sin sesión ✅ 🔎 ⚠️

1. Sin sesión, navegar directo a `overview.htm`, `transfer.htm` y `billpay.htm`.

**Esperado:** las tres responden **HTTP 500** con la página genérica *An internal
error has occurred and has been logged.*; no se filtra ninguna fila de cuentas ni
el menú privado.

> ⚠️ **Desvío (D03).** El caso original esperaba un redirect al login o un error de
> sesión. ParaBank no hace ninguna de las dos: devuelve 500 y una traza genérica.
> La aserción sigue a la app. Un 500 no filtra datos, pero convierte un problema de
> autorización en un error de servidor y hace imposible distinguirlo de una caída
> real.
>
> ⚠️ **Desvío relacionado (D04).** `activity.htm?id=<n>` **no** está protegida así:
> responde 200 y renderiza su shell completo, delegando el rechazo al AJAX contra
> el proxy autenticado. No se filtra nada hoy, pero la guarda del servidor
> sencillamente no está. Cubierto por el test `D04`.

### TC14 — Forgot login info devuelve las credenciales del cliente ✅ 🔎 ⚠️

1. Abrir *Forgot login info?* y completar los datos personales exactos del cliente.

**Esperado:** *Your login information was located successfully. You are now logged
in.* seguido de `Username: <u>` y `Password: <p>` en texto plano, **y la sesión
queda abierta**. Con un solo campo mal (p. ej. el SSN) responde *The customer
information provided could not be found.* y no abre sesión. Vacío, lista los siete
campos obligatorios.

> ⚠️ **Desvío (D02).** El caso decía «muestra el username y la contraseña». Hace
> eso **y además loguea al visitante**. Combinado con D01 —
> `GET /services/bank/customers/{id}` entrega nombre, dirección y SSN a un llamador
> anónimo — la cadena completa es una toma de control de cuenta partiendo de un
> número de cuenta.
>
> ⚠️ **Nota de datos.** El lookup exige que los datos personales sean **únicos en
> toda la base**: si dos clientes comparten nombre + dirección + SSN, responde «no
> se encontró». Por eso la factory genera nombre, apellido y SSN únicos, no solo el
> username.

---

## C. Cuentas

### TC15 — Accounts Overview lista las cuentas con su saldo ✅ 🔎

1. Loguearse, abrir una segunda cuenta (para que el total sea una suma real) y
   abrir *Accounts Overview*.

**Esperado:** una fila por cuenta con número, saldo y monto disponible; el
disponible es `max(saldo, 0)`; y la fila *Total* es exactamente la suma de los
saldos que la propia tabla imprimió. Cada importe se coteja contra
`GET /customers/{id}/accounts`, nunca contra literales.

### TC16 — Abrir una cuenta nueva ✅ 🔎

1. *Open New Account*, elegir tipo (CHECKING o SAVINGS) y cuenta de origen.

**Esperado:** se muestra el número de la cuenta nueva; la cuenta aparece en el
overview con el tipo elegido y pertenece a este cliente; **el saldo de origen baja
exactamente el depósito y la cuenta nueva queda con exactamente ese importe**; y el
total del cliente no cambia.

> **Nota de datos.** El depósito mínimo ($100.00 según el texto de la página) es un
> parámetro global del servidor (`minimumBalance`) que cualquiera puede cambiar
> desde `admin.htm`. El test lo **deriva** de lo que efectivamente salió de la
> cuenta de origen en vez de escribirlo.

### TC17 — El detalle de cuenta muestra los datos correctos ✅ 🔎

1. Desde el overview, hacer clic en el número de cuenta.

**Esperado:** número, tipo, saldo y disponible coinciden con la fila del overview y
con la API. Una cuenta recién creada muestra *No transactions found.* y cero filas.

### TC18 — Transferir fondos entre cuentas ✅ 🔎

1. *Transfer Funds*: importe, cuenta origen, cuenta destino, confirmar.

**Esperado:** la confirmación repite importe y cuentas; **el origen baja
exactamente ese importe, el destino sube exactamente ese importe, y la suma de los
dos no cambia**. La aserción es aritmética sobre saldos leídos antes y después.

### TC19 — La transferencia queda registrada en la actividad de la cuenta ✅ 🔎

1. Tras la transferencia, abrir el detalle de ambas cuentas.

**Esperado:** en el destino, un crédito por el importe con descripción *Funds
Transfer Received* y la columna débito vacía; en el origen, un débito por el mismo
importe con descripción *Funds Transfer Sent*.

> **Nota de redundancia.** TC18 y TC19 son una sola operación verificada en dos
> niveles, así que comparten una única transferencia (`TC18 + TC19` en
> `transfer.spec.ts`). Ver `STRATEGY.md`, «Redundancia».

### TC20 — Pagar una factura (Bill Pay) ✅ ❌

> ❌ **No automatizado.** El test existía y fallaba de forma reproducible con un solo
> worker, porque la aplicación no hace lo que este caso describe. Se retiró en lugar de
> aflojar la aserción. El comportamiento real está documentado como **D17** en `STRATEGY.md`.

1. *Bill Pay*: beneficiario, dirección, teléfono, número de cuenta y verificación,
   importe y cuenta de origen.

**Esperado:** la confirmación nombra al beneficiario, el importe y la cuenta; **el
saldo de origen baja exactamente ese importe**; y aparece un débito *Bill Payment
to `<beneficiario>`* por ese importe en la actividad de la cuenta.

### TC21 — Bill Pay con formulario vacío ✅ 🔎

1. Enviar *Bill Pay* sin completar nada.

**Esperado:** exactamente nueve mensajes visibles — nombre, dirección, ciudad,
estado, código postal, teléfono, *Account number is required.* dos veces (una por
`Account #` y otra por `Verify Account #`) y *The amount cannot be empty.* — no se
llama al servidor y ningún saldo cambia.

### TC22 — Bill Pay con cuenta de confirmación distinta ✅ ❌

> ❌ **No automatizado.** El test existía y fallaba de forma reproducible con un solo
> worker, porque la aplicación no hace lo que este caso describe. Se retiró en lugar de
> aflojar la aserción. El comportamiento real está documentado como **D18** en `STRATEGY.md`.

1. Completar *Bill Pay* con `Account #` y `Verify Account #` diferentes.

**Esperado:** un único error, *The account numbers do not match.*; no se realiza el
pago ni cambia el saldo. Corregir **solo** la confirmación hace que el mismo
formulario se envíe bien, lo que prueba que el rechazo era por eso y por nada más.

### TC23 — Buscar transacciones ✅ 🔎

1. *Find Transactions*, buscar por ID de transacción, por fecha, por rango de
   fechas y por importe.

**Esperado:** cada criterio devuelve exactamente la transacción que el propio test
creó, con importe, descripción y fecha correctos. Un importe inexistente devuelve
cero filas. Una fecha mal formada muestra *Invalid date format* y no busca.

> **Nota de datos.** La fecha se toma de la transacción que devolvió el servidor,
> nunca del reloj de la máquina: los dos discrepan alrededor de medianoche. Ver
> también D07.
>
> **Nota de alcance.** *Find by Transaction ID* pega contra
> `services_proxy/bank/transactions/{id}`, que **no** está acotado a la cuenta
> seleccionada. Registrado como parte de D11.

### TC24 — Solicitar un préstamo (aprobado) ✅ 🔎

1. *Request Loan*: importe 1000, pago inicial 100, cuenta de origen.

**Esperado:** *Approved* con proveedor y fecha; se crea una cuenta **LOAN** con
saldo igual al importe prestado; **el pago inicial, y solo el pago inicial, sale de
la cuenta de origen**; la cuenta nueva aparece en el overview.

> **Nota de datos.** La decisión depende de `loanProcessorThreshold`, un parámetro
> global que se puede cambiar desde `admin.htm`. Si este caso pasa a *Denied* sin
> que cambie el código, alguien tocó ese parámetro; el mensaje de la aserción lo
> dice explícitamente.

### TC25 — Solicitar un préstamo desproporcionado ✅ 🔎

1. Pedir un importe muy superior al saldo disponible.

**Esperado:** *Denied* con el motivo *We cannot grant a loan in that amount with
your available funds.*; **no** se crea ninguna cuenta y **no** se cobra el pago
inicial.

### TC26 — Actualizar la información de contacto ✅ 🔎

1. *Update Contact Info*: el formulario llega precargado con el perfil registrado.
   Cambiar nombre, apellido, dirección completa y teléfono, y guardar.

**Esperado:** *Profile Updated*; los datos nuevos persisten tras recargar la página
y coinciden campo por campo con el registro del backend; el SSN, que no está en
este formulario, no cambia.

### TC27 — Update Contact Info con campos vacíos ✅ 🔎

1. Vaciar los seis campos obligatorios y guardar.

**Esperado:** seis mensajes de campo obligatorio; no se muestra el panel de éxito;
el registro del backend conserva **todos** los valores anteriores y el formulario
los vuelve a ofrecer tras recargar.

---

## D. API REST

### TC28 — La API devuelve los mismos saldos que la UI ✅ 🔎

1. Leer una cuenta por UI (`activity.htm`).
2. Leer `GET /services/bank/accounts/{id}` con `Accept: application/json`.

**Esperado:** `id`, `customerId`, `type` y `balance` coinciden con lo que muestra la
interfaz, y los dos montajes del mismo recurso (`services` y `services_proxy`)
coinciden entre sí.

---

## E. Casos añadidos — huecos de la lista original

Estos no estaban en la lista derivada y cubren caminos negativos, límites y
autorización, que es donde suelen vivir los defectos reales. Cada uno lleva el ID
del defecto que documenta en `STRATEGY.md`.

| ID | Qué verifica |
| --- | --- |
| D01 | Saldos, historial y datos personales (incluido el SSN) legibles **sin sesión** |
| D04 | `activity.htm` servida sin sesión mientras sus hermanas devuelven 500 |
| D05 | `updateprofile.htm` incrusta usuario y contraseña del cliente en el HTML |
| D06 | El WADL público declara `cleanDB`, `initializeDB` y `setParameter` (**nunca se invocan**) |
| D07 | Toda fecha de transacción se muestra un día antes al oeste de UTC |
| D08 | *Services* sirve un service list de CXF ajeno con credenciales |
| D09 | Contact Us acepta un email y un teléfono con cualquier formato |
| D10 | *Phone #* es opcional en registro y en actualización de perfil |
| D11 | Un cliente logueado puede leer el detalle de la cuenta de otro cliente |
| D12 | *Transfer Funds* con importe vacío muestra un error interno, no su validación |
| D13 | *Bill Pay* permite girar en descubierto y deja el saldo negativo |
| D14 | Un préstamo aprobado acredita la cuenta nueva sin transacción que lo explique |
| D15 | El `jsessionid` viaja en la URL de cada link interno |
| D16 | El redirect de logout revela el tipo de conexión al backend |

---

## Restricciones de ejecución (obligatorias)

`parabank.parasoft.com` es una instancia **compartida y pública**. La suite:

- **No toca jamás `admin.htm`**, ni `services/bank/cleanDB`, `initializeDB` o
  `setParameter`. Se asserta que existen y están abiertos (D06) leyendo el WADL;
  no se invocan.
- **Crea su propio cliente en cada test** y opera solo sobre sus cuentas.
- **No asume saldos ni IDs fijos.** El saldo inicial medido durante la exploración
  fue $515.00, no los $500.00 por defecto: alguien ya había cambiado el parámetro
  global. Ningún test escribe un importe de apertura.
- **Corre con 2 workers.** Medido: con 4 la instancia devuelve HTTP 429 de
  Cloudflare a los 35 segundos. Ver `STRATEGY.md`, «Paralelismo».

---

## Cobertura deliberadamente fuera de alcance

- **SOAP:** `services/ParaBank?wsdl` no se cubre; la suite es de UI más
  verificación por REST.
- **Accesibilidad y cross-browser:** la suite corre en Chromium.
- **Concurrencia bancaria:** transferencias simultáneas sobre la misma cuenta.
- **Explotación destructiva de D06:** documentada, jamás ejecutada.
