# Sábado Premiado · instruções para o time de desenvolvimento

Campanha do Grupo GTO (Tesoura de Ouro, Magazine da Economia, Free Center). Cada influencer tem uma página; a cliente se cadastra com CPF e recebe um cupom ligado ao CPF; o atendente digita o cupom no PDV; a V4 acompanha tudo num CRM interno. Primeiro sábado: **28/11/2026**. Vídeo 1 das influencers sai em 21/11, então o ambiente precisa estar de pé e testado antes disso.

Este pacote está pronto para subir. O que falta é infra, integrações e as pendências da seção 8.

## 1. Arquitetura

- **Front**: site estático, JS puro sem build (`web/`). `montar.py` copia para `publicar/` aplicando `config.producao.js`.
- **Banco**: PostgreSQL 16. Tabelas fechadas por RLS sem política e sem GRANT para `anon`. O público só executa funções `security definer` (`lp_info`, `cadastrar`, `balcao_*`, `adm_*`, `backup_exportar`, `api_relatorio`). Toda regra de negócio está no banco.
- **API**: PostgREST em `/api/rpc/<função>`, atrás do nginx (mesmo domínio, sem CORS). Alternativa: Supabase (o front tem `api-supabase.js` para os dois modos).
- **Auth**: não há usuário. CRM e balcão usam PIN/senha conferido em função (`exige_adm`, hash bcrypt em `config`). Relatórios usam chave de API (seção 3).
- **Fuso**: tudo em `America/Sao_Paulo` (`hoje_sp()`, `timezone` do banco).

Modos do front (`config.js`): `demo` (dados no navegador, só apresentação), `servidor` (PostgREST próprio, `API_URL: "/api"`), `supabase`.

## 2. Subir o ambiente (recomendado: Docker no servidor da GTO)

```
cd infra && cp .env.exemplo .env      # trocar as duas senhas (openssl rand -hex 24)
# criar ../publicar/config.js de produção: copiar infra/config.producao.exemplo.js para config.producao.js
# na raiz, ajustar BASE_URL e rodar:  python3 montar.py
docker compose up -d                  # db + PostgREST + nginx, site na :8080
./verificar.sh https://DOMINIO        # smoke test (só leitura)
```

- O init do banco roda na ordem: `00-preparar.sh` (papéis, pgcrypto), `schema.sql`, `lojas-gto.sql` (101 lojas reais, PIN 1xxx/2xxx/3xxx) e `03-migracoes.sh` (aplica `supabase/migracoes/*.sql`).
- HTTPS: terminar TLS no proxy da GTO na frente da `:8080`. Se houver proxy, ativar `set_real_ip_from` no `nginx.conf`, senão o rate limit por IP enxerga só o proxy.
- Alternativas no guia da TI: PostgreSQL gerenciado da GTO (rodar `schema.sql`, `lojas-gto.sql` e `infra/aplicar-migracoes.sh`, mais `00-preparar-postgres.sql` antes) ou Supabase + Vercel (`MODO: "supabase"`, `ROTAS: "path"`).
- Rotas de produção (`ROTAS: "path"`): `/<slug>` página da influencer, `/crm/...` CRM, `/balcao`. O nginx já devolve `index.html` para todas.

**Checklist antes de abrir ao público**

1. Trocar o PIN do CRM (`update config set valor = crypt('SENHA_LONGA', gen_salt('bf',10)) where chave='admin_pin_hash';`). O padrão `1234` é só de homologação.
2. Desligar o modo teste (CRM › Configurações, ou `update config set valor='0' where chave='teste';`). Em modo teste o balcão aceita cupom fora do dia.
3. Trocar os PINs das lojas se forem expostos fora da operação.
4. Configurar o token de backup (fim do `schema.sql`) e instalar o `infra/backup-planilha.gs` na planilha Google da GTO (gatilho de 15 min).
5. Agendar `infra/backup-banco.sh` (dump do Postgres) e testar um restore.
6. Rodar `infra/verificar.sh`.

## 3. API de relatórios (nova)

Objetivo: puxar dados fácil para relatórios do Grupo GTO, da diretoria e de cada influencer (Looker Studio, Power BI, Sheets, scripts). Só leitura. Arquivo: `supabase/migracoes/001-api-relatorios.sql` (idempotente, testado em Postgres/PGlite com os três escopos).

**Chaves** (`api_chaves`): guardadas só como SHA-256, mostradas uma única vez na criação. A gestão é no CRM, menu **API e relatórios** (criar, ver último uso e número de consultas, revogar, exemplo de chamada). Por baixo são `adm_criar_chave_api`, `adm_chaves_api` e `adm_revogar_chave_api`, todas exigindo o PIN do CRM. Opcional: `expira_em` e travar a chave em uma bandeira.

| Escopo | Enxerga | Dados pessoais |
|---|---|---|
| `grupo` | tudo, todas as bandeiras | sim (CPF mascarado, nome, WhatsApp, bairro). Uso interno V4/GTO |
| `diretoria` | tudo, todas as bandeiras | não, só números e rankings |
| `influencer` | só a própria (chave presa à influencer) | não. Sem acesso ao comparativo |

Criar uma chave sem a tela (opcional):

```
curl -s -X POST https://DOMINIO/api/rpc/adm_criar_chave_api -H 'Content-Type: application/json' \
  -d '{"p_pin":"SENHA_CRM","p_nome":"Diretoria GTO","p_escopo":"diretoria"}'
# influencer: acrescentar "p_influencer": <id>   bandeira: "p_bandeira": "tesoura"
```

Consultar (chave preferencialmente no cabeçalho `X-API-Key`, para não ir parar em log de URL):

```
curl -s -X POST https://DOMINIO/api/rpc/api_relatorio -H 'Content-Type: application/json' -H 'X-API-Key: sp_...' \
  -d '{"p_tipo":"influencers","p_sabado":1,"p_bandeira":"tesoura","p_de":"2026-11-21","p_ate":"2026-11-28"}'
```

Tipos (`p_tipo`): `resumo`, `influencers`, `lojas`, `diario`, `cadastros`, `comparativo`. Filtros opcionais: `p_sabado` (id), `p_bandeira`, `p_de`/`p_ate` (data do cadastro). A resposta vem em `{tipo, escopo, chave, filtros, dados}`.

Notas de implementação:
- É POST (a função grava `ultimo_uso`/`usos`, então o PostgREST não aceita GET). Looker Studio, Sheets e Power BI chamam via Apps Script, conector JSON/Web ou um job que grava numa planilha/BigQuery.
- O nginx já aplica limite de 3 req/s por IP em `api_*` (mesma zona do CRM). Para BI pesado, ajustar ou liberar o IP do servidor de relatórios.
- Se a TI preferir um serviço próprio de relatórios, o caminho é uma role read-only (`GRANT SELECT` nas tabelas) com um ETL para o warehouse. A API por função cobre o caso comum sem abrir tabela.
- Pendente de produto: relatório por vendedor depois da integração do PDV.

## 4. Atualizações depois do go-live

Dois caminhos, escolhidos de propósito para não existir uma porta que publique código em produção pela rede.

**A. Conteúdo, por API, sem deploy (V4 faz sozinha).** Nome da campanha, regras, texto LGPD, cores, logos por URL e termos do sorteio de cada bandeira (`CAMPANHA`, `REGRAS`, `LGPD`, `BANDEIRAS`) ficam salvos no banco. O site lê `config_publica` ao abrir (`web/config-remota.js`, cache de 30 s no nginx) e mistura sobre o `config.js`; se a chamada falhar, vale o `config.js`. Gravar exige o PIN do CRM:

```
curl -s -X POST https://DOMINIO/api/rpc/adm_salvar_config_publica -H 'Content-Type: application/json' \
  -d '{"p_pin":"SENHA_CRM","p":{"BANDEIRAS":{"magazine":{"TERMOS":"..."}}}}'
```

A função só aceita essas quatro chaves de topo (nunca `API_URL`, chaves ou código). O topo é substituído por chave: ao gravar `BANDEIRAS`, envie o objeto completo das bandeiras que quer manter alterado; o front ainda completa o que faltar com o `config.js`.

**B. Código e regra de negócio, por pacote versionado (time Tek publica).** A V4 manda um zip novo (`./empacotar.sh`, número em `VERSAO`, mudanças em `CHANGELOG.md`). O time aplica assim:

1. Substituir `web/` e `infra/` pelos arquivos novos e rodar `python3 montar.py` (o site estático é só copiar `publicar/`).
2. Aplicar migração de banco nova, se houver: `./infra/aplicar-migracoes.sh` (Docker: `docker compose exec -T db bash /docker-entrypoint-initdb.d/03-migracoes.sh`). Cada arquivo roda uma vez, em transação, registrado em `migracoes_aplicadas`. Migração aplicada nunca é editada; mudança nova vira arquivo novo.
3. Se mudou `nginx.conf`, `docker compose exec site nginx -t && docker compose exec site nginx -s reload`.
4. `./infra/verificar.sh https://DOMINIO`.

Mudança de banco é sempre aditiva e idempotente (`create or replace`, `add column if not exists`), então dá para aplicar sem janela de manutenção. Pedimos que o time mantenha o repositório do código num git da GTO/Tek e trate cada zip como um commit, para ter histórico e rollback.

## 5. Mapa do código

| Caminho | O que é |
|---|---|
| `web/app.js` (~120 KB) | Todas as telas: página da influencer, balcão, CRM (visão, influencers, clientes, lojas, sábados, base, caixa/PDV, comparativo) |
| `web/api-supabase.js` | Cliente das funções (modos `servidor` e `supabase`): retry, fila offline do balcão, envio em blocos |
| `web/api-demo.js` | Mesma API em memória, só demo. **Não vai para produção** (não é carregada em `servidor`) |
| `web/config.js` | Marcas, cores, termos do sorteio, LGPD, regras. `logos.js` tem as logos em base64 |
| `supabase/schema.sql` | Tabelas, regras e permissões. Mesmas regras de `api-demo.js` |
| `supabase/migracoes/` | Mudanças de banco versionadas e numeradas (001 API de relatórios, 002 config remota). `infra/aplicar-migracoes.sh` aplica só as novas |
| `supabase/lojas-gto.sql` | 101 lojas (extraídas por `extrair-lojas.py`) |
| `infra/` | docker-compose, nginx (cache de 5 s em `lp_info`, rate limits), backups, `verificar.sh`, `docker-compose.homologacao.yml` |
| `testes/` | e2e, carga (3.000 e 25.000 cadastros), soak. **Só em homologação**, criam milhares de cadastros falsos (`TESTE_EM_HOMOLOGACAO=sim`). Ver `testes/README.md` |
| `montar.py` | Gera `artefato/` (demo) e `publicar/` (produção) |

Regras principais (todas no banco): um cupom por CPF por sábado em cada bandeira; numeração sequencial por influencer (trava a linha da influencer); se houver tokens importados, cada cadastro recebe o próximo token livre da influencer (`for update skip locked`), senão `PREFIXO + número`; CPF validado no servidor; balcão recusa cupom usado, de outra loja ou fora do dia; `cadastrar` é idempotente por CPF (repetir devolve o mesmo cupom).

## 6. Integrações que faltam

1. **PDV (Juliano, TI GTO)**: cadastrar no PDV os tokens/cupons e devolver as vendas com cupom. Entrada: CRM › Caixa (PDV) importa tokens (`adm_importar_tokens`); a baixa vem por `adm_importar_vendas` (arquivo do PDV, confere cadastro, CPF e nota). O ideal é trocar o CSV manual por um job que chame essa função.
2. **Rock CRM**: o plano atual não permite API nem importação. Depende do upgrade (subsidiado pela Credsystem). As funções de nota fiscal (`adm_importar_notas`, chave NFC-e de 44 dígitos) estão no banco, fora do fluxo atual. Com a API: webhook para uma função de borda que chame `adm_importar_notas`.
3. **Campanha de fim de ano**: hoje o CSV do sorteio entra em CRM › Comparativo (`adm_importar_fimdeano`). Automatizar quando houver origem.

## 7. Segurança e LGPD

- Nunca expor a chave `service_role` (Supabase) nem a senha do `authenticator` no front. O front só conhece `API_URL`/`SUPABASE_ANON`.
- CPF é dado pessoal: a API de relatórios mascara o CPF e só o escopo `grupo` vê nome e WhatsApp. O `backup_exportar` e o export do CRM trazem CPF completo; proteger a planilha de backup.
- Aceite LGPD gravado em `cadastros.aceite_em`. **O texto (`config.js › LGPD`, ou pela API de conteúdo da seção 4) precisa ser validado pelo jurídico da GTO** antes do ar.
- O nginx limita 20 req/s no cadastro e 3 req/s no que pede PIN/chave. Conferir o IP real se houver proxy.

## 8. Pendências conhecidas

- Domínio, servidor e banco (GTO fornece). Prazos combinados: escolha da opção 13/11, infra 17/11, testes 18 e 19/11.
- CNPJ de cada loja (campo `lojas.cnpj`, usado na validação de nota fiscal). Tesoura Paracatu (124) e Free Setor Garavelo (132) aparecem com o mesmo CNPJ na listagem: confirmar com a GTO.
- Logos oficiais da Magazine e da Free e termos do Natal Premiado e da Virada de Sorte (`config.js › BANDEIRAS`). Sem termos, o rodapé e o passo 4 não aparecem para a bandeira.
- Texto LGPD validado pelo jurídico.
- Como o vale físico é entregue define se o balcão precisa de mais um campo.

## 9. Contato

Dúvidas de regra de negócio e prazos: Jhonatan (V4). Dúvidas de PDV: Juliano (TI GTO). CRM/clube: José Diego (GTO).
