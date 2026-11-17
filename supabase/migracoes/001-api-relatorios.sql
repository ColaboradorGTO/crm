-- Sábado Premiado · API de relatórios por chave
-- Migração 001. Rodada por infra/aplicar-migracoes.sh depois de schema.sql e lojas-gto.sql. Idempotente.
--
-- Para que serve: puxar os dados da campanha de forma fácil para relatórios do Grupo GTO, da diretoria e de cada
-- influencer (Looker Studio, Power BI, Google Sheets, Excel, scripts). Só LEITURA. Não dá acesso ao CRM nem muda dados.
--
-- Como funciona: cada pessoa ou sistema recebe uma CHAVE (texto longo, começa com "sp_"). A chave é criada no CRM
-- (ou pela função adm_criar_chave_api) e aparece UMA vez só. O banco guarda apenas o hash (SHA-256), nunca a chave.
--
-- Escopos:
--   grupo      todas as bandeiras, tudo (inclui nome, CPF mascarado e WhatsApp dos clientes para uso interno)
--   diretoria  todas as bandeiras, só números e rankings (sem dados pessoais de cliente)
--   influencer só a própria influencer (a chave nasce presa a uma influencer), só números, sem dados pessoais
-- Uma chave pode ser presa a uma bandeira (tesoura | magazine | free): ela só enxerga aquela bandeira.

create table if not exists api_chaves (
  id serial primary key,
  nome text not null,                                   -- quem usa (ex.: "Diretoria GTO", "Ana Souza")
  escopo text not null check (escopo in ('grupo', 'diretoria', 'influencer')),
  influencer_id int references influencers(id),         -- obrigatório no escopo influencer
  bandeira text check (bandeira in ('tesoura', 'magazine', 'free')),  -- null = todas
  hash text not null unique,                            -- SHA-256 da chave
  inicio text not null,                                 -- primeiros caracteres, só para reconhecer na lista
  ativa boolean not null default true,
  expira_em date,                                       -- null = não expira
  criada_em timestamptz not null default now(),
  ultimo_uso timestamptz,
  usos bigint not null default 0,
  check (escopo <> 'influencer' or influencer_id is not null)
);
alter table api_chaves enable row level security;

-- ---------- gerenciamento (só com a senha do CRM) ----------
-- Devolve a chave completa UMA vez. Copie e entregue na hora; depois não dá para ver de novo (só revogar e criar outra).
create or replace function adm_criar_chave_api(p_pin text, p_nome text, p_escopo text, p_influencer int default null,
                                               p_bandeira text default null, p_expira_em date default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare k text;
begin
  perform exige_adm(p_pin);
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome de quem vai usar a chave.'; end if;
  if p_escopo not in ('grupo', 'diretoria', 'influencer') then raise exception 'Escopo inválido (grupo, diretoria ou influencer).'; end if;
  if p_escopo = 'influencer' and not exists (select 1 from influencers where id = p_influencer) then
    raise exception 'Escolha a influencer da chave.'; end if;
  k := 'sp_' || encode(gen_random_bytes(24), 'hex');
  insert into api_chaves (nome, escopo, influencer_id, bandeira, hash, inicio, expira_em)
  values (trim(p_nome), p_escopo, case when p_escopo = 'influencer' then p_influencer end, nullif(p_bandeira, ''),
          encode(digest(k, 'sha256'), 'hex'), left(k, 7), p_expira_em);
  return jsonb_build_object('chave', k, 'aviso', 'Guarde esta chave agora. Ela não será mostrada de novo.');
end $$;

create or replace function adm_chaves_api(p_pin text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform exige_adm(p_pin);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'nome', a.nome, 'escopo', a.escopo, 'influencer', i.nome, 'bandeira', a.bandeira, 'inicio', a.inicio || '…',
      'ativa', a.ativa, 'expira_em', a.expira_em, 'criada_em', a.criada_em, 'ultimo_uso', a.ultimo_uso, 'usos', a.usos) order by a.id)
    from api_chaves a left join influencers i on i.id = a.influencer_id), '[]'::jsonb);
end $$;

create or replace function adm_revogar_chave_api(p_pin text, p_id int) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform exige_adm(p_pin);
  update api_chaves set ativa = false where id = p_id;
  return found;
end $$;

-- ---------- leitura (com a chave) ----------
-- A chave vem no argumento p_chave OU no cabeçalho HTTP "X-API-Key" (melhor: não fica gravada no endereço nem nos logs).
-- p_tipo:
--   resumo       totais da campanha + por bandeira + por sábado
--   influencers  uma linha por influencer: cadastros, cupons usados, taxa de uso, valor vendido com cupom, novos clientes
--   lojas        uma linha por loja: cadastros, cupons usados, valor
--   diario       série por dia (cadastros e cupons usados)
--   cadastros    uma linha por cupom (detalhe). Escopo grupo traz nome, CPF mascarado e WhatsApp; os demais, só dados da venda
--   comparativo  campanha de fim de ano x Sábado Premiado: totais e por influencer (totais e por influencer; sem dados por pessoa)
-- p_sabado: id do sábado (null = campanha toda). p_bandeira: filtro opcional (respeita a bandeira presa à chave).
-- p_de / p_ate: período por data do cadastro (null = sem limite).
create or replace function api_relatorio(p_tipo text, p_chave text default null, p_sabado int default null,
                                         p_bandeira text default null, p_de date default null, p_ate date default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  ch api_chaves;
  k text := coalesce(nullif(p_chave, ''), nullif((current_setting('request.headers', true)::jsonb)->>'x-api-key', ''));
  band text;
  inf int;
  tz text := 'America/Sao_Paulo';
  r jsonb;
begin
  if k is null then raise exception 'Chave de API não informada (cabeçalho X-API-Key).'; end if;
  select * into ch from api_chaves
   where hash = encode(digest(k, 'sha256'), 'hex') and ativa and (expira_em is null or expira_em >= hoje_sp());
  if not found then raise exception 'Chave de API inválida, revogada ou vencida.'; end if;
  update api_chaves set ultimo_uso = now(), usos = usos + 1 where id = ch.id;

  band := coalesce(ch.bandeira, nullif(p_bandeira, ''));
  if ch.bandeira is not null and nullif(p_bandeira, '') is not null and p_bandeira <> ch.bandeira then
    raise exception 'Esta chave só enxerga a bandeira %.', ch.bandeira; end if;
  inf := case when ch.escopo = 'influencer' then ch.influencer_id end;

  -- base filtrada: tudo que o escopo da chave pode ver
  create temp table if not exists _rel (like cadastros including all) on commit drop;
  delete from _rel;
  insert into _rel select c.* from cadastros c
   where (p_sabado is null or c.sabado_id = p_sabado)
     and (band is null or c.bandeira = band)
     and (inf is null or c.influencer_id = inf)
     and (p_de is null or (c.criado_em at time zone tz)::date >= p_de)
     and (p_ate is null or (c.criado_em at time zone tz)::date <= p_ate);

  if p_tipo = 'resumo' then
    r := jsonb_build_object(
      'gerado_em', to_char(now() at time zone tz, 'YYYY-MM-DD HH24:MI:SS'),
      'cadastros', (select count(*) from _rel),
      'cupons_usados', (select count(*) from _rel where status = 'usado'),
      'taxa_uso', (select round(100.0 * count(*) filter (where status = 'usado') / nullif(count(*), 0), 1) from _rel),
      'valor_vendido_com_cupom', (select coalesce(sum(valor), 0) from _rel where status = 'usado'),
      'ticket_medio', (select round(avg(valor), 2) from _rel where status = 'usado' and valor is not null),
      'por_bandeira', coalesce((select jsonb_agg(jsonb_build_object('bandeira', bandeira, 'cadastros', n, 'usados', u, 'valor', v) order by bandeira)
          from (select bandeira, count(*) n, count(*) filter (where status = 'usado') u,
                       coalesce(sum(valor) filter (where status = 'usado'), 0) v from _rel group by bandeira) x), '[]'),
      'por_sabado', coalesce((select jsonb_agg(jsonb_build_object('sabado_id', s.id, 'n', s.n, 'data', s.data, 'label', s.label,
          'meta', s.meta, 'cadastros', x.n, 'usados', x.u, 'valor', x.v) order by s.n)
          from sabados s left join lateral (select count(*) n, count(*) filter (where status = 'usado') u,
               coalesce(sum(valor) filter (where status = 'usado'), 0) v from _rel where sabado_id = s.id) x on true), '[]'));

  elsif p_tipo = 'influencers' then
    r := coalesce((select jsonb_agg(jsonb_build_object(
        'influencer_id', i.id, 'nome', i.nome, 'instagram', i.instagram, 'prefixo', i.prefixo, 'bandeira', l.bandeira, 'loja', l.nome,
        'etapa', i.etapa, 'lote', i.lote, 'meta', i.meta,
        'cadastros', coalesce(x.n, 0), 'cupons_usados', coalesce(x.u, 0),
        'taxa_uso', case when coalesce(x.n, 0) > 0 then round(100.0 * x.u / x.n, 1) end,
        'valor_vendido', coalesce(x.v, 0),
        'novos_clientes', case when exists (select 1 from base_cpfs) then x.novos end,
        'atingimento_meta', case when i.meta > 0 then round(100.0 * coalesce(x.u, 0) / i.meta, 1) end)
        order by coalesce(x.v, 0) desc, i.nome)
      from influencers i join lojas l on l.id = i.loja_id
      left join lateral (select count(*) n, count(*) filter (where status = 'usado') u, coalesce(sum(valor) filter (where status = 'usado'), 0) v,
              count(*) filter (where status = 'usado' and not exists (select 1 from base_cpfs b where b.cpf = c.cpf)) novos
              from _rel c where c.influencer_id = i.id) x on true
      where (inf is null or i.id = inf) and (band is null or l.bandeira = band)), '[]');

  elsif p_tipo = 'lojas' then
    r := coalesce((select jsonb_agg(jsonb_build_object('loja_id', l.id, 'loja', l.nome, 'cidade', l.cidade, 'bandeira', l.bandeira,
        'cadastros', coalesce(x.n, 0), 'cupons_usados', coalesce(x.u, 0), 'valor_vendido', coalesce(x.v, 0)) order by coalesce(x.v, 0) desc, l.nome)
      from lojas l left join lateral (select count(*) n, count(*) filter (where status = 'usado') u,
              coalesce(sum(valor) filter (where status = 'usado'), 0) v from _rel where loja_id = l.id) x on true
      where (band is null or l.bandeira = band) and (inf is null or l.id = (select loja_id from influencers where id = inf))), '[]');

  elsif p_tipo = 'diario' then
    r := coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'cadastros', em, 'cupons_usados', us, 'valor', v) order by dia) from (
        select dia, sum(em) em, sum(us) us, sum(v) v from (
          select (criado_em at time zone tz)::date dia, 1 em, 0 us, 0::numeric v from _rel
          union all
          select (usado_em at time zone tz)::date, 0, 1, coalesce(valor, 0) from _rel where usado_em is not null) x group by dia) y), '[]');

  elsif p_tipo = 'cadastros' then
    r := coalesce((select jsonb_agg(jsonb_build_object(
        'cupom', c.codigo, 'bandeira', c.bandeira, 'influencer', i.nome, 'loja', l.nome, 'sabado', s.data,
        'cadastro_em', to_char(c.criado_em at time zone tz, 'YYYY-MM-DD HH24:MI:SS'), 'status', c.status,
        'usado_em', to_char(c.usado_em at time zone tz, 'YYYY-MM-DD HH24:MI:SS'), 'valor', c.valor, 'origem', c.origem)
        || case when ch.escopo = 'grupo' then jsonb_build_object('nome', c.nome, 'cpf', mascara_cpf(c.cpf), 'whatsapp', c.whatsapp, 'bairro', c.bairro) else '{}'::jsonb end
        order by c.criado_em)
      from _rel c join influencers i on i.id = c.influencer_id join lojas l on l.id = c.loja_id join sabados s on s.id = c.sabado_id), '[]');

  elsif p_tipo = 'comparativo' then
    if ch.escopo = 'influencer' then raise exception 'O comparativo de fim de ano não está disponível para chave de influencer.'; end if;
    with lp as (
      select distinct on (c.cpf, c.bandeira) c.cpf, c.nome, c.influencer_id, c.status, c.valor valor_cupom, c.criado_em
      from _rel c order by c.cpf, c.bandeira, c.criado_em
    ), fa as (
      select cpf, count(*) notas, coalesce(sum(valor), 0) valor from fimdeano_notas where band is null or bandeira = band group by cpf
    ), j as (
      select lp.*, fa.notas fa_notas, fa.valor fa_valor from lp left join fa on fa.cpf = lp.cpf
    )
    select jsonb_build_object(
      'totais', jsonb_build_object('cadastros_lp', (select count(*) from lp), 'usaram_cupom', (select count(*) from lp where status = 'usado'),
         'cpfs_fim_de_ano', (select count(*) from fa), 'nos_dois', (select count(*) from j where fa_notas is not null),
         'valor_fim_de_ano_dos_que_estao_nos_dois', (select coalesce(sum(fa_valor), 0) from j)),
      'por_influencer', coalesce((select jsonb_agg(z order by (z->>'valor_fim_de_ano')::numeric desc) from (
          select jsonb_build_object('influencer', i.nome, 'cadastros', count(j.cpf), 'usaram_cupom', count(j.cpf) filter (where j.status = 'usado'),
            'nos_dois', count(j.fa_notas), 'valor_fim_de_ano', coalesce(sum(j.fa_valor), 0)) z
          from influencers i join j on j.influencer_id = i.id group by i.id) t), '[]'::jsonb))
    into r;

  else
    raise exception 'Tipo inválido. Use: resumo, influencers, lojas, diario, cadastros ou comparativo.';
  end if;

  return jsonb_build_object('tipo', p_tipo, 'escopo', ch.escopo, 'chave', ch.nome, 'filtros',
    jsonb_build_object('sabado', p_sabado, 'bandeira', band, 'de', p_de, 'ate', p_ate), 'dados', r);
end $$;

-- ---------- permissões ----------
revoke all on api_chaves from anon, authenticated;
revoke execute on function adm_criar_chave_api(text, text, text, int, text, date), adm_chaves_api(text), adm_revogar_chave_api(text, int),
  api_relatorio(text, text, int, text, date, date) from public;
grant execute on function adm_criar_chave_api(text, text, text, int, text, date), adm_chaves_api(text), adm_revogar_chave_api(text, int),
  api_relatorio(text, text, int, text, date, date) to anon;

notify pgrst, 'reload schema';
