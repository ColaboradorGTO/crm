-- Migração 002 · ajustes de conteúdo pela API, sem subir código novo.
-- A V4 troca textos e marcas da plataforma (nome da campanha, regras, LGPD, cores, termos do sorteio de cada bandeira)
-- com a senha do CRM. O site carrega isso ao abrir e mistura por cima do config.js (se a chamada falhar, vale o config.js).
-- Só aceita as chaves da lista abaixo: nunca código, nunca URL de API ou chave.

create or replace function config_publica() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select valor::jsonb from config where chave = 'config_publica'), '{}'::jsonb)
$$;

create or replace function adm_salvar_config_publica(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k text;
begin
  perform exige_adm(p_pin);
  if jsonb_typeof(p) <> 'object' then raise exception 'Envie um objeto JSON.'; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('CAMPANHA', 'REGRAS', 'LGPD', 'BANDEIRAS') then
      raise exception 'Chave % não pode ser alterada por aqui (permitidas: CAMPANHA, REGRAS, LGPD, BANDEIRAS).', k; end if;
  end loop;
  if length(p::text) > 200000 then raise exception 'Configuração grande demais.'; end if;
  -- guarda o que já existia e mistura só as chaves enviadas (envie BANDEIRAS inteiro para trocar tudo dentro dela)
  insert into config (chave, valor) values ('config_publica', (config_publica() || p)::text)
  on conflict (chave) do update set valor = excluded.valor;
  return config_publica();
end $$;

revoke execute on function config_publica(), adm_salvar_config_publica(text, jsonb) from public;
grant execute on function config_publica(), adm_salvar_config_publica(text, jsonb) to anon;
notify pgrst, 'reload schema';
