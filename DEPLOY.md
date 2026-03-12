# Deploy (Render)

Este projeto pode ser publicado como **Web Service** no Render usando o arquivo `render.yaml`.

## 1) Pré-requisitos
- Repositório com este código no GitHub/GitLab.
- Banco MySQL acessível publicamente.

## 2) Variáveis obrigatórias no Render
Defina no serviço:
- `DB_HOST`
- `DB_PORT` (ex.: `3306`)
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `JWT_SECRET`

Variáveis opcionais úteis:
- `API_PORT` (Render usa `PORT` automaticamente)
- `JWT_EXPIRES_IN` (padrão `7d`)
- `API_CORS_ORIGIN` (ex.: `https://seu-frontend.onrender.com`)
- `CORPORATE_EMAIL_DOMAIN` (padrão `okta7.com.br`)

## 3) Aplicar schema
Rode uma vez após configurar o banco:

```bash
npm run apply-schema
```

## 4) Subir serviço
- No Render, use **New + Blueprint** e selecione o repositório.
- O Render detectará `render.yaml` e criará o serviço.
- Health check: `/api/health`.
