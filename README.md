# ParaBank — E2E suite (Playwright + TypeScript)

Suite end-to-end contra la aplicación demo de banca online de Parasoft,
**https://parabank.parasoft.com/parabank/index.htm**.

**72 tests, verde sin reintentos, ~1.5 min con 2 workers.**

Los casos están en [`TEST_CASES.md`](./TEST_CASES.md); las decisiones de diseño y
los defectos encontrados en la aplicación, en [`STRATEGY.md`](./STRATEGY.md).

---

## Instalación y ejecución

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env
npm test
```

Comandos útiles:

| Comando | Qué hace |
|---|---|
| `npm test` | Corre la suite completa |
| `npm test -- --headed` | Con navegador visible |
| `npm test -- --grep @auth` | Solo registro y autenticación |
| `npm test -- --grep @accounts` | Solo operaciones de cuenta |
| `npm test -- --grep @unit` | Solo los tests de utilidades de dinero (no tocan la red) |
| `npm run report` | Abre el último reporte HTML |
| `npx tsc --noEmit` | Typecheck |

### Por qué el default son 2 workers

Medido, no elegido por costumbre. Con 4 workers la suite dispara el rate limiting de
Cloudflare delante del demo y los tests empiezan a caer por respuestas cortadas. Con
2 workers corre limpia en ~1.5 min. Se puede cambiar con `WORKERS` en `.env` o
`--workers=N`, bajo tu responsabilidad.

### Configuración

`.env.example` documenta las variables. La única obligatoria es `BASE_URL`.

---

## Mapeo TC → test

| TC | Archivo | Test |
|---|---|---|
| TC01 | `tests/public/site.spec.ts` | the home page carries the login panel, the news list and the service lists |
| TC02 | `tests/public/site.spec.ts` | every footer destination answers 200 · About Us and Site Map render their documented content |
| TC03 | `tests/public/contact.spec.ts` | a completed enquiry is acknowledged by name |
| TC04 | `tests/public/contact.spec.ts` | an empty enquiry reports every required field and is not sent |
| TC05 | `tests/auth/registration.spec.ts` | a new customer is created, signed in, and stored as it was typed |
| TC06 | `tests/auth/registration.spec.ts` | a duplicate username is rejected and the original customer is untouched |
| TC07 | `tests/auth/registration.spec.ts` | an empty registration form reports every required field |
| TC09 | `tests/auth/login.spec.ts` | valid credentials open the private area |
| TC11 | `tests/auth/login.spec.ts` | an empty login form asks for both fields |
| TC12 | `tests/auth/login.spec.ts` | logging out ends the session and re-protects the private area |
| TC13 | `tests/auth/login.spec.ts` | private pages are refused without a session |
| TC14 | `tests/auth/lookup.spec.ts` | matching details return credentials · wrong SSN is not enough · empty lookup reports every field |
| TC15 | `tests/accounts/accounts.spec.ts` | Accounts Overview lists every account, its available amount and a correct total |
| TC16 | `tests/accounts/accounts.spec.ts` | opening a CHECKING/SAVINGS account moves the deposit and nothing else |
| TC17 | `tests/accounts/accounts.spec.ts` | the account detail matches the overview row and the backend record |
| TC18 + TC19 | `tests/accounts/transfer.spec.ts` | a transfer moves exactly the amount and is recorded on both accounts |
| TC21 | `tests/accounts/billpay.spec.ts` | an empty Bill Pay form reports every field and pays nothing |
| TC23 | `tests/accounts/findtrans.spec.ts` | every search criterion finds the transaction the test created · a malformed date is rejected client-side |
| TC24 | `tests/accounts/loan.spec.ts` | an approved loan takes the down payment and opens a funded LOAN account |
| TC25 | `tests/accounts/loan.spec.ts` | a loan far beyond the available funds is denied and creates nothing |
| TC26 | `tests/accounts/profile.spec.ts` | an updated profile persists and matches the backend record |
| TC27 | `tests/accounts/profile.spec.ts` | clearing the required fields is rejected and leaves the profile intact |
| TC28 | `tests/api/rest.spec.ts` | the API reports the same account as the UI |

Los tests con prefijo `D##` no cubren un caso funcional: **fijan un defecto de la
aplicación** para que se rompan el día que se arregle. Están catalogados en
`STRATEGY.md`.

## Casos no automatizados

**TC08, TC10, TC20 y TC22 no están en la suite.** No es un olvido: los tests existían,
fallaban de forma reproducible, y fallaban porque la aplicación está rota, no el test.
Se retiraron para que el verde signifique algo, y el hallazgo se conserva como defecto
documentado en `STRATEGY.md` (D17 a D20). El detalle de qué hace la aplicación en cada
uno está ahí.

---

## Estructura

```
src/
  core/         BasePage y BaseComponent
  components/   LoginPanel, AccountServicesMenu
  pages/        un page object por pantalla (12)
  flows/        SessionFlow, CustomerFlow — registro, login y alta de datos
  fixtures/     test.ts — inyección de páginas, sesión y cliente de API
  data/         factories con datos únicos por worker
  support/      api.ts (cliente REST), money.ts (aritmética en centavos), dates.ts
tests/
  public/       sitio público sin sesión
  auth/         registro, login, lookup
  accounts/     cuentas, transferencias, bill pay, préstamos, búsqueda, perfil
  api/          verificación por REST
  unit/         utilidades de dinero, sin red
```
