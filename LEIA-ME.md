# Sábado Premiado · ferramenta de cupons (GTO)

Página por influencer, balcão da loja e o CRM da promo (só V4): menu lateral com Visão geral, Influencers
(quadro de etapas convidada → no ar, lista e ficha de cada uma com anotações), Clientes e cupons, Links e QR,
Lojas, Sábados, Base GTO e Configurações. Cliente se cadastra com CPF e recebe o cupom
PRIMEIRONOME + número (ANA001, ANA002…), ligado ao CPF. No sábado compra no caixa normal (o PDV não muda) e
mostra o cupom no balcão, que confere e entrega o vale.

Artefato de demonstração: https://claude.ai/artifact/1FA14MCArZFY1AvhZzrmd8
(PIN do CRM 1234; PIN das lojas 1001 a 1030). Sem capa: abre direto no CRM. Rotas no artefato: #visao, #influencers, #inf-ana, #lojas, #loja-1, #links, #clientes, #sabados, #base, #integracoes, #config, #balcao, #lp-ana. Hospedado: /crm/..., /crm/inf/ana, /crm/loja/1, /balcao, /ana

## Fluxo validado (12/11/2026)

Página da influencer → cadastro gera o cupom (ANA013, ligado ao CPF) → no caixa o atendente digita o cupom no PDV e o
desconto entra → a cliente cadastra a nota na campanha de fim de ano (sorteio) → CRM › Comparativo fim de ano cruza pelo
CPF quem está nos dois lugares e quanto gastou (total e depois do cadastro na página), por influencer, com exportação CSV.

Hospedagem: a GTO fornece subdomínio, servidor e banco. Guia para a TI: https://claude.ai/artifact/BZtaAs78FaCBCf6m4u26Ae
(fonte em `GRUPO GTO/4. Documentação.../13. Ação PDV Influencers/_build/guia-ti`).

## Pastas

| Caminho | O que é |
|---|---|
| `web/` | Código fonte: `app.js` (telas), `api-demo.js` (dados no navegador), `api-supabase.js` (banco real), `util.js`, `styles.css`, `config.js`, `logos.js`, `index.html`, `vercel.json` |
| `supabase/schema.sql` | Banco completo: tabelas fechadas e funções com as regras. Testado em Postgres (PGlite) em 11/11/2026 |
| `infra/` | Servidor próprio da GTO: `docker-compose.yml` (PostgreSQL 16 + PostgREST + nginx), `nginx.conf` (site + /api, limite de tentativas), `00-preparar-postgres.sql` (papéis e pgcrypto, roda antes do schema), `config.producao.exemplo.js` |
| `montar.py` | Gera `artefato/sabado-premiado.html` (demo) e `publicar/` (pasta para a Vercel) |
| `config.producao.js` | Não existe ainda. Criar ao subir (ver abaixo); sobrescreve o `config.js` em `publicar/` |

Depois de mexer em `web/`: `python3 montar.py` e republicar o artefato com o mesmo arquivo.

## Regras (iguais na demo e no banco)

- Prefixo = primeiro nome sem acento. Repetido: + inicial do sobrenome (ANAP), depois número (ANA2).
- Numeração sequencial por influencer, sem repetir (o banco trava a linha da influencer na emissão).
- Lote = quantos cupons a página distribui no sábado atual dela. Esgotou, a página avisa.
- Um cupom por CPF por sábado. CPF já cadastrado por outra influencer recebe o cupom que já tinha.
- Balcão recusa: cupom usado, de outra loja, fora do dia (exceto em modo teste). Exige nº do cupom fiscal.
- Cliente novo = CPF que usou o cupom e não está na base carregada em Admin › Clientes novos.
- Comissão estimada = fixo do sábado + R$ 5 por cliente novo, até R$ 1.250.
- Sem internet no balcão: a validação fica guardada no aparelho e sobe quando a conexão volta.

## Como subir no servidor da GTO (opção A do guia)

1. Copiar `infra/config.producao.exemplo.js` para `config.producao.js` com o domínio final (`MODO: "servidor"`, `API_URL: "/api"`).
2. `python3 montar.py` (gera `publicar/` com a config de produção) e mandar a pasta inteira para a TI.
3. TI troca as senhas em `infra/`, roda `docker compose up -d` em `infra/` e liga o HTTPS na porta 8080.
4. Trocar a senha do CRM (comando no guia). O login do CRM aceita senha longa.

## Como subir (Supabase + Vercel, opção C)

1. Criar projeto no Supabase (plano grátis, região São Paulo). SQL Editor: colar e rodar `supabase/schema.sql` inteiro.
2. Trocar o PIN do admin no SQL Editor:
   `update config set valor = extensions.crypt('NOVO_PIN', extensions.gen_salt('bf')) where chave = 'admin_pin_hash';`
3. Guardar URL e chave `anon` em `_Credenciais/supabase.env` (nunca a `service_role` no site).
4. Criar `config.producao.js` (cópia de `web/config.js`) com `MODO: "supabase"`, `ROTAS: "path"`, `SUPABASE_URL`, `SUPABASE_ANON` e `BASE_URL` (domínio final).
5. `python3 montar.py` e subir a pasta `publicar/` na Vercel (projeto estático). Links ficam `dominio/ana`, `dominio/admin`, `dominio/dash`, `dominio/balcao`.
6. Cadastrar lojas (com PIN) e influencers no admin (ou Importar lista). Desligar o modo teste antes de 28/11.

## Campanha de fim de ano e comparativo

Tabela `fimdeano_notas` (CPF, nome, nota, data, valor, loja; único por CPF + nota). Importação em CRM › Comparativo
(`adm_importar_fimdeano`, opção de substituir tudo quando o arquivo for o acumulado). `adm_comparativo` devolve totais,
linhas por influencer e por pessoa. Testado em PGlite em 12/11/2026 (inclusive anon bloqueado nas tabelas).

## Três bandeiras (12/11/2026)

Tesoura de Ouro, Magazine da Economia e Free Center. `lojas.bandeira` (tesoura | magazine | free); cadastros e notas do fim
de ano guardam a bandeira; um cupom por CPF por sábado EM CADA bandeira. CRM com seletor no menu: "Geral (grupo)" mostra
tudo e o quadro Por bandeira; cada bandeira filtra visão, clientes, lojas, links, comparativo e caixa (`adm_dados`,
`adm_cadastros`, `adm_comparativo` recebem `p_bandeira`). Importação do fim de ano pede de qual campanha é o arquivo.
Modo tokens vale por bandeira. Cores, logo, campanha e termos de cada bandeira em `config.js` › `BANDEIRAS`
(Magazine e Free ainda sem logo oficial: aparece o nome escrito; sem termos: rodapé e passo 4 não aparecem).

## Lojas reais

`supabase/lojas-gto.sql` (rodar depois do schema) e `lojas-gto.json`: 101 lojas da listagem da Caliane (13/10/2026,
`GRUPO GTO/.../1.Compartilhada/2026-10-13 - Listagem de Lojas - GTO (Caliane).doc`), extraídas por `supabase/extrair-lojas.py`
(converter o .doc com `textutil -convert txt`). 47 Tesoura, 25 Magazine, 29 Free; Outlet Família fora. PIN 1xxx/2xxx/3xxx.
A demo usa as mesmas lojas, com influencers e clientes de exemplo. Na listagem, Tesoura Paracatu (124) e Free Setor
Garavelo (132) têm o mesmo CNPJ: confirmar com a GTO.

## Tokens do PDV (decisão de 12/11/2026)

A TI cria os tokens no PDV e manda a lista; ela sobe em CRM › Caixa (PDV) marcando de quem é a lista (ou "Várias" com
token; influencer por linha). Todo token é de uma influencer (`tokens.influencer_id not null`). Com algum token importado,
`cadastrar` entrega o próximo token livre DAQUELA influencer (for update skip locked); sem tokens dela, a página diz que
acabou. Sem nenhum token no banco, volta a gerar PREFIXO + número. "Substituir" apaga só os livres das influencers da lista.
Faixa "Demonstração" do topo removida a pedido.

## Backup em planilha e termos

`backup_exportar(token)` devolve cadastros, notas do fim de ano e influencers (json, colunas em ordem). A planilha Google da
GTO roda `infra/backup-planilha.gs` (Apps Script, gatilho de 15 min, regrava as abas, nunca apaga com resposta vazia).
Token gravado com hash em `config.backup_token_hash` (comando no fim do schema e no guia). Termos do sorteio de fim de ano
ficam em `config.js` › `FIM_DE_ANO` e aparecem no rodapé da página e no passo 4 da tela do cupom.

## Rock e nota fiscal (fora do fluxo atual, funções mantidas)

A Rock controla o clube e a cliente participa escaneando o QR do cupom fiscal (NFC-e). A chave de 44 dígitos
da nota é o elo: traz o CNPJ da loja e o mês (AAMM). Regras (demo e banco): nota de outro CNPJ ou de outro mês é
recusada; cada nota vale para um cupom só (`cadastros.nfce_chave` único). O balcão aceita o QR da nota ou o número.
Hoje as notas da Rock entram por CSV em CRM › Integração Rock (`adm_importar_notas`: CPF; chave ou link do QR;
data; valor), que dá baixa no cupom com origem "rock". Com a API: uma Edge Function no Supabase recebe o webhook
da Rock e chama a mesma função. Cada loja precisa do CNPJ cadastrado.

## Pendências

- API da Rock (documentação, credencial, webhook de nota escaneada ou consulta por período, consulta de CPF do clube).
- CNPJ de cada loja participante.
- Domínio da GTO, lista real de lojas, endereços, horários e influencers.
- Texto LGPD validado pelo jurídico da GTO (está em `config.js`).
- Como o vale é entregue (impresso, numerado?) define se o balcão precisa de mais um campo.
