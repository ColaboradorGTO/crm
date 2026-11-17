# Sábado Premiado · como instalar e rodar no computador

Este guia explica como rodar o projeto no seu computador (Windows) para ver e testar as telas.
Para subir no servidor da GTO e ver o checklist antes de abrir ao público, use o [INSTRUCOES-TIME-TEK.md](INSTRUCOES-TIME-TEK.md).

O projeto é um site em JavaScript puro, sem `npm install` nem build. Ele roda de dois jeitos:

| Modo | O que é | Precisa de |
|---|---|---|
| **A. Demonstração** | Os dados ficam no navegador e não há banco. Serve para ver e testar as telas. Leva 1 minuto. | Node.js 18+ (ou Python 3) |
| **B. Completo** | Banco PostgreSQL + API (PostgREST) + site (nginx), igual ao servidor da GTO. | Python 3 e Docker Desktop |
| **C. Na internet (Vercel + Supabase)** | Site publicado na Vercel e banco no Supabase. É a "opção C" do [LEIA-ME.md](LEIA-ME.md). | Python 3, Node.js, contas na Vercel e no Supabase |

---

## A. Rodar em modo demonstração (mais rápido)

1. Abra o terminal na pasta do projeto:
   ```powershell
   cd C:\sabado-premiado-v1.1.0
   ```
2. Suba um servidor simples apontando para a pasta `web`:
   ```powershell
   npx serve web -l 8080
   ```
   Se ele perguntar se pode instalar o pacote `serve`, responda `y`.

   Sem Node, dá para usar o Python: `python -m http.server 8080 --directory web`
3. Abra no navegador:
   - CRM: http://localhost:8080/#visao (PIN **1234**)
   - Balcão: http://localhost:8080/#balcao (PIN das lojas: 1001, 1002…)
   - Página de uma influencer: http://localhost:8080/#lp-ana

Nesse modo tudo fica gravado só no navegador. Os links usam `#` porque o [web/config.js](web/config.js) vem com `MODO: "demo"` e `ROTAS: "hash"`.

---

## B. Rodar completo (banco + API + site) com Docker

### 1. Instalar o que falta

- **Python 3**: baixe em https://www.python.org/downloads/ e marque **"Add python.exe to PATH"** na instalação.
- **Docker Desktop**: baixe em https://www.docker.com/products/docker-desktop/. Ele pede o WSL 2; aceite e reinicie o computador se for pedido. Depois abra o Docker Desktop e espere ele ficar "running".

Feche e abra o terminal (ou o VS Code) e confira:

```powershell
python --version
docker --version
```

> **"Python não foi encontrado; executar sem argumentos para instalar do Microsoft Store…"**
> O Windows está chamando um atalho da Microsoft Store em vez do Python instalado. Use o launcher `py` no lugar de `python`
> em todos os comandos deste guia (ex.: `py montar.py`). Outra saída é desligar os atalhos `python.exe` e `python3.exe` em
> Configurações › Aplicativos › Configurações avançadas do aplicativo › Aliases de execução do aplicativo.

### 2. Criar a configuração de produção local

```powershell
cd C:\sabado-premiado-v1.1.0
copy infra\config.producao.exemplo.js config.producao.js
```

Abra o `config.producao.js` e troque `BASE_URL` por `"http://localhost:8080"`.
Mantenha `MODO: "servidor"`, `ROTAS: "path"` e `API_URL: "/api"`.

### 3. Gerar a pasta `publicar/`

```powershell
python montar.py
```

Confira se apareceu a mensagem **"config.js de produção aplicado"**.

### 4. Criar as senhas do banco

```powershell
cd infra
copy .env.exemplo .env
```

Gere duas senhas, rodando o comando abaixo duas vezes:

```powershell
-join ((1..24) | % { '{0:x2}' -f (Get-Random -Max 256) })
```

Coloque uma em `POSTGRES_PASSWORD` e a outra em `AUTHENTICATOR_PASSWORD` dentro do `infra\.env`.
Use só letras e números, porque o script de preparação do banco recusa outros caracteres.
Não envie o `.env` por e-mail nem coloque em repositório.

### 5. Subir tudo

```powershell
docker compose up -d
docker compose ps
```

Na primeira vez ele baixa as imagens e cria o banco com o schema, as 101 lojas reais e as migrações.
Espere os três serviços (`db`, `api`, `site`) ficarem "running" ou "healthy".

### 6. Usar

- CRM: http://localhost:8080/crm (PIN **1234**)
- Balcão: http://localhost:8080/balcao (PIN das lojas no formato 1xxx, 2xxx ou 3xxx, vindos de [supabase/lojas-gto.sql](supabase/lojas-gto.sql))
- Página da influencer: `http://localhost:8080/<slug>`. Primeiro cadastre a influencer no CRM.

### Comandos úteis

Rode dentro da pasta `infra`:

```powershell
docker compose logs -f api     # ver erros da API
docker compose down            # parar
docker compose down -v         # parar e APAGAR o banco (recria do zero na próxima subida)
```

Depois de mexer em qualquer arquivo de `web/`, rode `python montar.py` de novo (na raiz do projeto) e recarregue a página.
O nginx lê a pasta `publicar/` direto, então não precisa reiniciar o Docker.

---

## C. Publicar na Vercel (banco no Supabase)

A Vercel hospeda só o site (arquivos estáticos). Ela não roda o PostgreSQL + PostgREST do modo B, por isso o banco fica no **Supabase**.
O front já tem o `MODO: "supabase"` em [web/api-supabase.js](web/api-supabase.js) e as rotas em [web/vercel.json](web/vercel.json).

O [INSTRUCOES-TIME-TEK.md](INSTRUCOES-TIME-TEK.md) recomenda o servidor da GTO. Confirme com a V4/GTO que a hospedagem escolhida é a Vercel antes de publicar.
 
### 1. Criar o banco no Supabase

1. Crie uma conta em https://supabase.com e um projeto novo, na **região São Paulo (sa-east-1)**. Guarde a senha do banco.
2. Vá em **SQL Editor** e rode, **nesta ordem**, colando cada arquivo inteiro:
   1. [supabase/schema.sql](supabase/schema.sql)
   2. [supabase/lojas-gto.sql](supabase/lojas-gto.sql) (as 101 lojas)
   3. [supabase/migracoes/001-api-relatorios.sql](supabase/migracoes/001-api-relatorios.sql) (menu "API e relatórios" do CRM)
   4. [supabase/migracoes/002-config-remota.sql](supabase/migracoes/002-config-remota.sql) (textos e cores editáveis sem novo deploy)

   Sem as migrações, essas duas partes do CRM não funcionam.
3. Troque o PIN do CRM por uma senha longa:
   ```sql
   update config set valor = extensions.crypt('SENHA_LONGA_AQUI', extensions.gen_salt('bf', 10)) where chave = 'admin_pin_hash';
   ```
   **Atenção:** se rodar o `schema.sql` de novo depois, o PIN volta para `1234`.

### 2. Pegar as chaves

Você precisa de duas informações:

- a **chave publishable** (`sb_publishable_...`): fica em **Project Settings › API Keys**;
- a **URL do projeto** (`https://<id-do-projeto>.supabase.co`): não aparece na tela de API Keys. Pegue por um destes caminhos:
  - **Project Settings › Data API**: campo **Project URL**;
  - botão **Connect** no topo do painel do projeto;
  - ou monte você mesmo: o id do projeto está em **Project Settings › General › Project ID** e também no endereço do navegador
    (`supabase.com/dashboard/project/<id-do-projeto>/...`). A URL fica `https://<id-do-projeto>.supabase.co`.

Prefira a publishable à `anon` antiga, porque o Supabase está descontinuando as chaves `anon` e `service_role` e a campanha vai até janeiro.
O site envia a chave nos cabeçalhos `apikey` e `Authorization` com o mesmo valor, e o Supabase aceita isso por compatibilidade.
Mesmo assim, confirme no primeiro teste.

**Nunca** use a chave `secret`/`service_role` no site.

### 3. Criar o `config.producao.js`

Na raiz do projeto:

```powershell
copy infra\config.producao.exemplo.js config.producao.js
```

O arquivo tem que ficar na **raiz** (`C:\sabado-premiado-v1.1.0\config.producao.js`), não dentro de `infra\`.
Se ficar em `infra\`, o `montar.py` não acha e gera o site em modo demonstração.

Edite estes campos:

```js
MODO: "supabase",
ROTAS: "path",
API_URL: "",                       // tem que ficar VAZIO, senão o site tenta o /api do nginx
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON: "sb_publishable_...",
BASE_URL: "https://seu-projeto.vercel.app",   // trocar pelo domínio final depois
```

O ponto que mais dá erro é o `API_URL`: no exemplo ele vem como `"/api"` e tem prioridade sobre o Supabase.

### 4. Gerar a pasta `publicar/`

```powershell
python montar.py
```

Confira se apareceu a mensagem **"config.js de produção aplicado"**.

### 5. Subir na Vercel

O jeito mais simples, sem Git, é pela CLI:

```powershell
cd publicar
npx vercel          # primeira vez: login e criação do projeto ("Other", sem build)
npx vercel --prod   # publica em produção
```

A Vercel devolve um endereço `https://<projeto>.vercel.app`.

Se preferir Git, crie um repositório, envie o projeto **com a pasta `publicar/` já gerada** e, na Vercel, use
**Root Directory = `publicar`**, Framework **Other** e sem comando de build.

### 6. Ajustar o endereço e testar

1. Coloque o endereço da Vercel (ou o domínio final) em `BASE_URL`, rode `python montar.py` de novo e publique outra vez.
   É com ele que o CRM monta os links e QR codes das influencers.
2. Teste:
   - `https://.../crm`: login com a senha nova;
   - `https://.../balcao`;
   - cadastre uma influencer e abra `https://.../<slug>`.

### 7. Antes de abrir ao público

- **Domínio da GTO:** em Vercel › Settings › Domains, adicione o domínio. A TI da GTO cria o CNAME no DNS.
  Depois atualize o `BASE_URL` e publique de novo.
- **Modo teste:** desligue em CRM › Configurações.
- **Cadastros:** lojas (com CNPJ) e influencers.
- **Plano do Supabase:** no plano grátis, o projeto **pausa depois de 7 dias sem uso** e tem limites menores. Para a campanha, considere o **Pro**.
- **Limite de tentativas:** no servidor da GTO, o nginx limita as tentativas de PIN e de cadastro.
  Na Vercel + Supabase esse limite **não existe**, por isso a senha do CRM precisa ser longa.

### Atualizar depois

Depois de qualquer mudança em `web/`, o ciclo é sempre o mesmo:

```powershell
python montar.py
cd publicar
npx vercel --prod
```

---

## Antes de ir para produção

Os valores acima (PIN 1234, modo teste ligado, HTTP sem certificado) são só para rodar no computador.
No servidor da GTO, siga o checklist da seção 2 do [INSTRUCOES-TIME-TEK.md](INSTRUCOES-TIME-TEK.md): trocar o PIN do CRM,
desligar o modo teste, configurar o HTTPS e os backups.
