-- Sábado Premiado · preparo de um PostgreSQL próprio (fora do Supabase)
-- Rodar UMA vez, como superusuário, no banco criado para a ferramenta, ANTES de ../supabase/schema.sql.
-- Cria o que o Supabase já traz pronto: schema "extensions", pgcrypto e os papéis usados pela API (PostgREST).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

-- usuário que o PostgREST usa para conectar. Com Docker, a senha vem do arquivo .env (00-preparar.sh troca o texto abaixo). Instalação manual: trocar TROCAR_SENHA_AUTHENTICATOR.
do $$ begin create role authenticator login noinherit password 'TROCAR_SENHA_AUTHENTICATOR'; exception when duplicate_object then null; end $$;
grant anon to authenticator;

grant usage on schema public, extensions to anon;
