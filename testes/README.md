# Testes do Sábado Premiado

Para rodar em **homologação** (um ambiente igual ao de produção, com banco vazio) antes de ir ao ar. Eles gravam milhares de
cadastros falsos: **nunca rodar no banco de produção**. Cada teste recusa rodar sem `TESTE_EM_HOMOLOGACAO=sim`.

## Como rodar

```bash
# 1. subir a homologação (na pasta infra/)
docker compose -f docker-compose.yml -f docker-compose.homologacao.yml up -d

# 2. instalar e configurar (na pasta testes/)
npm install
export TESTE_EM_HOMOLOGACAO=sim
export DB_PASSWORD=...          # POSTGRES_PASSWORD do arquivo infra/.env
export ADMIN_PIN=1234           # senha do CRM (a de teste do schema; troque se já mudou)
export API_RPC=http://127.0.0.1:3000/rpc/

# 3. rodar
node carga.mjs 3000             # integridade com 3 mil cadastros em paralelo
node carga2.mjs 25000           # carga alta e casos de borda
node soak.mjs 180 150           # carga mista contínua de 3 minutos (150 cadastros/s)
node e2e.mjs                    # as telas reais (CRM, página, balcão) contra a API e o banco
node demo.mjs                   # a demonstração (artefato), sem banco

# 4. limpar a homologação
docker compose -f docker-compose.yml -f docker-compose.homologacao.yml down -v
```

Os testes que usam banco (`carga`, `carga2`, `soak`, `e2e`) esperam um banco **recém criado** (só schema e lojas): um deles
(`carga`, `e2e`) sobe tokens e deixa a bandeira em "modo token", o que atrapalha o seguinte. Para repetir um teste, recrie o banco:
`docker compose ... down -v` e suba de novo. O `./rodar-tudo.sh` faz isso sozinho entre os testes e roda a bateria inteira.

## O que cada um prova

| Teste | O que confere | Tempo |
|---|---|---|
| `carga.mjs` | 3 mil cadastros em paralelo: nenhum código repetido, nenhum lote estourado, numeração sem buracos, mesmo CPF em várias páginas ao mesmo tempo vira 1 cupom, mesmo token validado 30 vezes no balcão passa 1 vez, tabelas fechadas, injeção SQL, backup | 30 s |
| `carga2.mjs` | 25 mil cadastros (códigos acima de 999), 4 mil na mesma página, CPF sem zero à esquerda, tokens por sábado, token em qualquer grafia, balcão x importação nos mesmos cupons, fotos pesadas, 30 mil tokens, telas do CRM com a base cheia, lote esgotado | 2 min |
| `soak.mjs` | um sábado comprimido: cadastros e páginas em taxa constante, 20 telas do CRM, balcão, importação, backup e comparativo ao mesmo tempo; depois confere que todo cadastro confirmado está no banco | 3 min |
| `e2e.mjs` | pessoas simuladas nas telas reais: senha errada, importar influencers (loja ambígua), subir tokens de CSV do Excel, cadastro, queda do servidor com reenvio automático, balcão, vendas do PDV com acento, CPF sem zero e valor "189.90", fim de ano, foto, texto malicioso (XSS), limite de acessos (429) | 1 min |
| `demo.mjs` | a demonstração do artefato continua funcionando | 20 s |

## Queda de serviço (teste manual, durante o `soak.mjs`)

Em outro terminal, na pasta `infra/`:

```bash
docker compose restart api          # API fora por alguns segundos
docker compose restart db           # banco desligado e religado
docker compose kill -s KILL db && docker compose up -d db   # queda brusca, sem aviso
```

Esperado: o `soak.mjs` termina com todos os cadastros confirmados presentes no banco e nenhum duplicado. No celular da cliente, a página
mostra "Estamos com instabilidade…", guarda os dados no aparelho e reenvia sozinha quando o serviço volta.

## Resultado medido pela V4 em 13/11/2026

Máquina de desenvolvimento (Mac Intel muito ocupada, PostgreSQL 16, PostgREST 12, sem nginx na frente, sem cache): todos os testes
passaram. Carga alta: 25 mil cadastros a 400 a 500 por segundo, 18 mil cadastros e 18 mil páginas em 2 minutos de carga mista, zero erro
de servidor, zero cadastro confirmado perdido, inclusive derrubando a API e o banco (com `kill -9`) no meio. Em um servidor dedicado com o nginx
na frente (que guarda a página da influencer em cache por 5 s) o desempenho deve ser melhor. Confirmar na homologação.
