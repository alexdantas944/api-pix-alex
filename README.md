# API PIX Alex Dantas — v2.0

API Node.js + Express para gerar PIX Copia e Cola e QR Code.

## Recursos

- `/` — informações da API
- `/health` — health check leve para o Render
- `/ready` — readiness
- `/api/pix` — geração do PIX
- `/api/pix/validate` — validação do CRC16
- CRC16-CCITT
- CORS
- logs estruturados
- tratamento de erros
- graceful shutdown
- `0.0.0.0` + `PORT` para Render
- configuração por variáveis de ambiente
- sem banco de dados
- QR Code via QuickChart

## Configuração padrão

- Beneficiário: ALEX DA SILVA DANTAS
- Cidade: FORTALEZA
- Chave PIX: 07131508403

Para produção, recomenda-se configurar `PIX_KEY` no Environment do Render em vez de depender do valor padrão do código.

## Rodar localmente

```bash
npm install
npm start
```

## Testar

```text
http://localhost:10000/health
```

```text
http://localhost:10000/api/pix?valor=10.00&txid=PEDIDO123
```

## Validar o payload

Copie o valor retornado em `payload_pix`:

```text
/api/pix/validate?payload=SEU_PAYLOAD_AQUI
```

## Render

Se usar `render.yaml`, crie um Blueprint a partir do repositório.

Se configurar manualmente:

Build Command:
```text
npm install
```

Start Command:
```text
npm start
```

Health Check Path:
```text
/health
```

Environment Variables:

```text
PIX_KEY=07131508403
PIX_NAME=ALEX DA SILVA DANTAS
PIX_CITY=FORTALEZA
CORS_ORIGIN=*
```

## Importante sobre o Free

Nenhum código Node consegue garantir que uma instância Free do Render permaneça acordada. O Render informa que serviços Web Free entram em spin-down após 15 minutos sem tráfego recebido e acordam com a próxima requisição.

O endpoint `/health` existe para health checks e recuperação/monitoramento da instância, não como mecanismo de bypass do spin-down.

Para uma API PIX de produção que precise permanecer ativa, use um plano pago.

## Segurança

Esta API não autentica o endpoint de geração. Se ela for consumida publicamente por um aplicativo, considere adicionar autenticação/API key e rate limiting antes de colocá-la em produção.

## Estrutura

```text
api-pix-alex/
├── server.js
├── package.json
├── render.yaml
├── README.md
└── .gitignore
```
