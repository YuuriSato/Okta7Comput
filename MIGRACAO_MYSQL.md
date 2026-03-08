# Migracao para MySQL + API

## Endpoints implementados

### Auth
- `POST /api/auth/register` -> `{ email, password }`
- `POST /api/auth/login` -> `{ email, password }`
- `GET /api/auth/me` -> Bearer token

### Email corporativo
- `GET /api/corporate-emails`
- `POST /api/corporate-emails` -> `{ email }`
- `DELETE /api/corporate-emails/:id` (soft delete: `active = 0`)

### Computadores
- `GET /api/computers`
- `POST /api/computers`
- `PUT /api/computers/:id`
- `DELETE /api/computers/:id`

## Regras principais
- Registro exige email no dominio corporativo (`CORPORATE_EMAIL_DOMAIN`).
- Se `AUTH_REQUIRE_PREAUTHORIZED_EMAIL=true`, o email precisa existir previamente em `corporate_emails`.
- Sessao via JWT Bearer token.
- Frontend bloqueia uso do sistema enquanto nao autenticado.

## Ordem recomendada
1. Configurar `.env`
2. Rodar `npm run apply-schema`
3. Subir API com `npm start`
4. Ajustar `window.APP_CONFIG.API_BASE_URL` no `index.html`
