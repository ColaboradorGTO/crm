-- Sábado Premiado · banco no Supabase (Postgres)
-- Rodar inteiro no SQL Editor do projeto. Depois trocar o PIN do admin (fim do arquivo).
-- As tabelas ficam fechadas (RLS sem políticas): o site só fala com o banco pelas funções abaixo,
-- que conferem PIN e regras no servidor. Mesmas regras de web/api-demo.js.

create extension if not exists pgcrypto with schema extensions;

-- fuso do banco: datas sem fuso nos arquivos (do Excel, do PDV) são lidas como horário de Brasília.
-- Se o provedor não deixar mudar, o docker-compose já sobe o Postgres com TZ=America/Sao_Paulo.
do $$ begin
  execute format('alter database %I set timezone to %L', current_database(), 'America/Sao_Paulo');
exception when others then
  raise notice 'Não foi possível fixar o fuso do banco (%). Confira se o servidor usa America/Sao_Paulo.', sqlerrm;
end $$;
 
-- ---------- tabelas ----------
create table if not exists sabados (
  id serial primary key,
  n int not null,
  data date not null,
  label text default '',
  meta int not null default 50,
  fixo numeric not null default 1000
);

create table if not exists lojas (
  id serial primary key,
  nome text not null,
  cidade text default '',
  endereco text default '',
  horario text default '',
  pin text not null unique,
  cnpj text not null default '',
  bandeira text not null default 'tesoura' check (bandeira in ('tesoura', 'magazine', 'free'))
);

create table if not exists influencers (
  id serial primary key,
  nome text not null,
  slug text not null unique,
  prefixo text not null unique,
  instagram text default '',
  whatsapp text default '',
  loja_id int not null references lojas(id),
  sabado_id int not null references sabados(id),
  lote int not null default 100,
  meta int not null default 50,
  foto text default '',
  ativo boolean not null default true,
  seq int not null default 0,
  etapa text not null default 'convidada' check (etapa in ('convidada', 'contrato', 'kit', 'gravacao', 'aprovada', 'no_ar')),
  notas text not null default '',
  criado_em timestamptz not null default now()
);

create table if not exists cadastros (
  id bigserial primary key,
  codigo text not null unique,
  influencer_id int not null references influencers(id),
  sabado_id int not null references sabados(id),
  loja_id int not null references lojas(id),
  nome text not null,
  cpf text not null,
  whatsapp text default '',
  bairro text default '',
  aceite_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  status text not null default 'emitido' check (status in ('emitido', 'usado')),
  usado_em timestamptz,
  cupom_fiscal text,
  valor numeric,
  nfce_chave text unique,
  origem text not null default '',
  bandeira text not null default 'tesoura',
  unique (cpf, sabado_id, bandeira)   -- um cupom por CPF por sábado em cada bandeira
);
create index if not exists cadastros_inf on cadastros (influencer_id, sabado_id);
create index if not exists cadastros_loja on cadastros (loja_id, status);
create index if not exists cadastros_band on cadastros (bandeira, sabado_id);

-- tokens criados pela TI no PDV e importados no CRM. Com algum token importado, cada cadastro recebe o próximo token livre
-- da influencer (todo token é vinculado a uma influencer). Sem tokens, a ferramenta gera PREFIXO + número.
create table if not exists tokens (
  codigo text primary key,                       -- exatamente como a TI mandou
  influencer_id int not null references influencers(id),
  sabado_id int references sabados(id),          -- o lote vale para um sábado
  cadastro_id bigint unique references cadastros(id),
  importado_em timestamptz not null default now()
);
alter table tokens add column if not exists sabado_id int references sabados(id);
create index if not exists tokens_livres on tokens (influencer_id, sabado_id) where cadastro_id is null;
alter table tokens enable row level security;

-- compara códigos sem acento, pontuação ou caixa (o que o atendente digita x o que está gravado)
create or replace function norm_cod(t text) returns text language sql immutable as $$
  select upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g'))
$$;
create unique index if not exists tokens_norm on tokens (norm_cod(codigo));
create unique index if not exists cadastros_codigo_norm on cadastros (norm_cod(codigo));

create table if not exists base_cpfs (cpf text primary key);

create table if not exists config (chave text primary key, valor text not null);

alter table sabados enable row level security;
alter table lojas enable row level security;
alter table influencers enable row level security;
alter table cadastros enable row level security;
alter table base_cpfs enable row level security;
alter table config enable row level security;

-- ---------- auxiliares ----------
create or replace function cpf_valido(c text) returns boolean
language plpgsql immutable as $$
declare s int; d int; t int; i int;
begin
  c := regexp_replace(coalesce(c, ''), '\D', '', 'g');
  if length(c) <> 11 or c ~ '^(\d)\1{10}$' then return false; end if;
  for t in 9..10 loop
    s := 0;
    for i in 1..t loop s := s + substr(c, i, 1)::int * (t + 2 - i); end loop;
    d := ((s * 10) % 11) % 10;
    if d <> substr(c, t + 1, 1)::int then return false; end if;
  end loop;
  return true;
end $$;

-- só dígitos; CPF com 9 ou 10 dígitos ganha os zeros à esquerda que o Excel tirou (a validação dos dígitos confere depois)
create or replace function cpf_pad(t text) returns text language sql immutable as $$
  select case when length(regexp_replace(coalesce(t, ''), '\D', '', 'g')) between 9 and 10
              then lpad(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 11, '0')
              else regexp_replace(coalesce(t, ''), '\D', '', 'g') end
$$;

-- valor em reais vindo de arquivo: "R$ 1.234,56", "189,90", "189.90" ou 189.9. Texto que não é número vira nulo.
create or replace function valor_num(t text) returns numeric language plpgsql immutable as $$
declare v text := regexp_replace(coalesce(t, ''), '[^0-9,.\-]', '', 'g');
begin
  if v = '' then return null; end if;
  if position(',' in v) > 0 then v := replace(replace(v, '.', ''), ',', '.'); end if;
  return v::numeric;
exception when others then return null;
end $$;

create or replace function hoje_sp() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

create or replace function adm_ok(p_pin text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from config where chave = 'admin_pin_hash' and valor = crypt(p_pin, valor))
$$;

create or replace function exige_adm(p_pin text) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not adm_ok(p_pin) then raise exception 'Sessão expirada. Entre de novo.'; end if;
end $$;

create or replace function modo_teste() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select valor = '1' from config where chave = 'teste'), false)
$$;

-- modo tokens vale por bandeira: basta um token importado para alguma influencer da bandeira
drop function if exists tokens_ativos();
create index if not exists tokens_inf on tokens (influencer_id);
create or replace function tokens_ativos(p_band text) returns boolean
language sql stable security definer set search_path = public as $$
  -- parte das influencers da bandeira (poucas dezenas) e procura 1 token de cada pelo índice: custo fixo, mesmo com 100 mil tokens
  select exists (
    select 1 from influencers i join lojas l on l.id = i.loja_id
    where l.bandeira = p_band and exists (select 1 from tokens t where t.influencer_id = i.id))
$$;

drop function if exists tokens_livres(int);
create or replace function tokens_livres(p_inf int, p_sab int) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from tokens where cadastro_id is null and influencer_id = p_inf and sabado_id = p_sab
$$;

create or replace function mascara_cpf(c text) returns text language sql immutable as $$
  select '***.' || substr(c, 4, 3) || '.' || substr(c, 7, 3) || '-**'
$$;

-- cupom com os dados que o balcão e o admin mostram
create or replace function cupom_json(c cadastros) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'codigo', c.codigo, 'status', c.status, 'nome', c.nome, 'cpf_mascara', mascara_cpf(c.cpf),
    'influencer', i.nome, 'loja_id', c.loja_id, 'loja_nome', l.nome,
    'sabado_data', s.data, 'sabado_n', s.n, 'usado_em', c.usado_em,
    'cupom_fiscal', c.cupom_fiscal, 'valor', c.valor, 'nfce_chave', c.nfce_chave, 'origem', c.origem)
  from influencers i, lojas l, sabados s
  where i.id = c.influencer_id and l.id = c.loja_id and s.id = c.sabado_id
$$;

-- motivos para recusar o cupom no balcão
create or replace function cupom_checar(c cadastros, p_loja int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m text[] := '{}'; sd date; ln text; fora boolean;
begin
  select data into sd from sabados where id = c.sabado_id;
  if c.status = 'usado' then m := m || ('Cupom já usado em ' || to_char(c.usado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.'); end if;
  if c.loja_id <> p_loja then
    select nome into ln from lojas where id = c.loja_id;
    m := m || ('Cupom de outra loja: ' || ln || '.');
  end if;
  fora := sd <> hoje_sp();
  if fora and not modo_teste() then m := m || ('Cupom vale só no sábado ' || to_char(sd, 'DD/MM') || '.'); end if;
  return jsonb_build_object('valido', cardinality(m) = 0, 'motivos', to_jsonb(m),
    'aviso_teste', case when fora and modo_teste() then 'Modo teste: a data (' || to_char(sd, 'DD/MM') || ') não está sendo conferida.' else '' end);
end $$;

-- confere a chave da NFC-e (44 dígitos) contra a loja (CNPJ) e o mês do sábado; devolve o erro ou ''
create or replace function nota_erro(p_chave text, c cadastros) returns text
language plpgsql stable security definer set search_path = public as $$
declare l lojas; sd date; dono text;
begin
  select * into l from lojas where id = c.loja_id;
  select data into sd from sabados where id = c.sabado_id;
  if l.cnpj <> '' and substr(p_chave, 7, 14) <> l.cnpj then return 'A nota é de outro CNPJ, não da ' || l.nome || '.'; end if;
  if substr(p_chave, 3, 4) <> to_char(sd, 'YYMM') then return 'A nota é de outro mês.'; end if;
  select codigo into dono from cadastros where nfce_chave = p_chave and id <> c.id;
  if found then return 'Esta nota já foi usada no cupom ' || dono || '.'; end if;
  return '';
end $$;

-- ---------- página da influencer (público) ----------
create or replace function lp_info(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i influencers; e int; v_modo boolean; v_livres int;
begin
  select * into i from influencers where slug = lower(p_slug) and ativo;
  if not found then raise exception 'Página não encontrada.'; end if;
  select count(*) into e from cadastros where influencer_id = i.id and sabado_id = i.sabado_id;
  v_modo := tokens_ativos((select bandeira from lojas where id = i.loja_id));
  v_livres := case when v_modo then tokens_livres(i.id, i.sabado_id) else 0 end;
  return jsonb_build_object(
    'influencer', jsonb_build_object('nome', i.nome, 'slug', i.slug, 'prefixo', i.prefixo, 'instagram', i.instagram, 'foto', i.foto),
    'loja', (select jsonb_build_object('nome', nome, 'cidade', cidade, 'endereco', endereco, 'horario', horario, 'bandeira', bandeira) from lojas where id = i.loja_id),
    'sabado', (select jsonb_build_object('id', id, 'n', n, 'data', data, 'label', label) from sabados where id = i.sabado_id),
    'lote', i.lote, 'emitidos', e,
    'liberado', (not v_modo) or exists (select 1 from tokens where influencer_id = i.id and sabado_id = i.sabado_id),
    'disponiveis', case when v_modo then least(greatest(0, i.lote - e), v_livres) else greatest(0, i.lote - e) end);
end $$;

create or replace function cadastrar(p_slug text, p_nome text, p_cpf text, p_whatsapp text, p_bairro text, p_aceite boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i influencers; c cadastros; dono text; e int; v_tok text; v_band text; v_try int; v_modo boolean; v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if length(trim(coalesce(p_nome, ''))) < 3 then raise exception 'Informe o seu nome.'; end if;
  if not cpf_valido(v_cpf) then raise exception 'CPF inválido. Confira os números.'; end if;
  if length(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g')) < 10 then raise exception 'Informe um WhatsApp com DDD.'; end if;
  if not coalesce(p_aceite, false) then raise exception 'Para pegar o cupom, marque a autorização de uso dos dados.'; end if;

  -- saída rápida: se o lote já acabou, responde sem disputar a trava (o número de cadastros só cresce)
  select * into i from influencers where slug = lower(p_slug) and ativo;
  if not found then raise exception 'Página não encontrada.'; end if;
  select bandeira into v_band from lojas where id = i.loja_id;
  v_modo := tokens_ativos(v_band);
  if not exists (select 1 from cadastros where cpf = v_cpf and sabado_id = i.sabado_id and bandeira = v_band) then
    select count(*) into e from cadastros where influencer_id = i.id and sabado_id = i.sabado_id;
    if v_modo and not exists (select 1 from tokens where influencer_id = i.id and sabado_id = i.sabado_id) then
      raise exception 'Os cupons da % ainda não foram liberados. Fique de olho no perfil dela.', split_part(i.nome, ' ', 1);
    end if;
    if e >= i.lote or (v_modo and tokens_livres(i.id, i.sabado_id) = 0) then
      raise exception 'Os cupons da % para este sábado acabaram.', split_part(i.nome, ' ', 1);
    end if;
  end if;

  -- trava a influencer: a numeração sai em ordem e sem repetir
  select * into i from influencers where id = i.id and ativo for update;
  if not found then raise exception 'Página não encontrada.'; end if;

  select bandeira into v_band from lojas where id = i.loja_id;
  select * into c from cadastros where cpf = v_cpf and sabado_id = i.sabado_id and bandeira = v_band;
  if found then
    select nome into dono from influencers where id = c.influencer_id;
    return jsonb_build_object('codigo', c.codigo, 'ja_existia', true,
      'outra_influencer', case when c.influencer_id <> i.id then dono else '' end, 'influencer', dono,
      'loja', (select jsonb_build_object('nome', nome, 'endereco', endereco, 'horario', horario, 'bandeira', bandeira) from lojas where id = c.loja_id),
      'sabado', (select jsonb_build_object('n', n, 'data', data) from sabados where id = c.sabado_id));
  end if;

  select count(*) into e from cadastros where influencer_id = i.id and sabado_id = i.sabado_id;
  if e >= i.lote then raise exception 'Os cupons da % para este sábado acabaram.', split_part(i.nome, ' ', 1); end if;

  if v_modo then
    -- próximo token livre da influencer, na ordem em que a TI mandou
    select codigo into v_tok from tokens where cadastro_id is null and influencer_id = i.id and sabado_id = i.sabado_id
      order by importado_em, codigo limit 1 for update skip locked;
    if v_tok is null then raise exception 'Os cupons da % para este sábado acabaram.', split_part(i.nome, ' ', 1); end if;
  else
    -- código gerado: PREFIXO + número com 3 dígitos (ANA001); a partir de 1000 usa o número inteiro (ANA1000).
    -- pula números que já existam (como cupom ou como token da TI). OBS: lpad() corta o texto, não usar para passar de 3 dígitos.
    for v_try in 1..1000 loop
      update influencers set seq = seq + 1 where id = i.id returning * into i;
      v_tok := i.prefixo || case when i.seq < 1000 then lpad(i.seq::text, 3, '0') else i.seq::text end;
      exit when not exists (select 1 from cadastros where norm_cod(codigo) = norm_cod(v_tok))
            and not exists (select 1 from tokens where norm_cod(codigo) = norm_cod(v_tok));
      if v_try = 1000 then raise exception 'Não foi possível gerar um código livre. Avise a V4.'; end if;
    end loop;
  end if;
  begin
    insert into cadastros (codigo, influencer_id, sabado_id, loja_id, nome, cpf, whatsapp, bairro, bandeira)
    values (v_tok, i.id, i.sabado_id, i.loja_id, trim(p_nome), v_cpf,
            regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), trim(coalesce(p_bairro, '')), v_band)
    returning * into c;
  exception when unique_violation then
    -- o mesmo CPF entrou ao mesmo tempo por outra página da mesma bandeira: devolve o cupom que já existe
    select * into c from cadastros where cpf = v_cpf and sabado_id = i.sabado_id and bandeira = v_band;
    if not found then raise; end if;
    select nome into dono from influencers where id = c.influencer_id;
    return jsonb_build_object('codigo', c.codigo, 'ja_existia', true,
      'outra_influencer', case when c.influencer_id <> i.id then dono else '' end, 'influencer', dono,
      'loja', (select jsonb_build_object('nome', nome, 'endereco', endereco, 'horario', horario, 'bandeira', bandeira) from lojas where id = c.loja_id),
      'sabado', (select jsonb_build_object('n', n, 'data', data) from sabados where id = c.sabado_id));
  end;
  update tokens set cadastro_id = c.id where codigo = v_tok;

  return jsonb_build_object('codigo', c.codigo, 'ja_existia', false, 'outra_influencer', '', 'influencer', i.nome,
    'loja', (select jsonb_build_object('nome', nome, 'endereco', endereco, 'horario', horario, 'bandeira', bandeira) from lojas where id = c.loja_id),
    'sabado', (select jsonb_build_object('n', n, 'data', data) from sabados where id = c.sabado_id));
end $$;

-- ---------- balcão da loja ----------
create or replace function balcao_entrar(p_pin text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l lojas;
begin
  select * into l from lojas where pin = trim(p_pin);
  if not found then raise exception 'PIN da loja não encontrado.'; end if;
  return jsonb_build_object('loja', jsonb_build_object('id', l.id, 'nome', l.nome));
end $$;

create or replace function balcao_buscar(p_pin text, p_termo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l lojas; c cadastros; t text := upper(regexp_replace(coalesce(p_termo, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into l from lojas where pin = p_pin;
  if not found then raise exception 'Sessão da loja expirou. Entre de novo.'; end if;
  if t ~ '^\d{11}$' then
    select * into c from cadastros where cpf = t
      order by (loja_id = l.id) desc, (status = 'emitido') desc, criado_em desc limit 1;
    if not found then raise exception 'Nenhum cupom para este CPF.'; end if;
  else
    select * into c from cadastros where norm_cod(codigo) = t;
    if not found then raise exception 'Cupom não encontrado. Confira as letras e os números.'; end if;
  end if;
  return jsonb_build_object('cupom', cupom_json(c)) || cupom_checar(c, l.id);
end $$;

create or replace function balcao_validar(p_pin text, p_codigo text, p_cupom_fiscal text, p_valor numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l lojas; c cadastros; ch jsonb; motivo text; v_chave text := substring(coalesce(p_cupom_fiscal, '') from '\d{44}'); v_erro text;
begin
  select * into l from lojas where pin = p_pin;
  if not found then raise exception 'Sessão da loja expirou. Entre de novo.'; end if;
  select * into c from cadastros where norm_cod(codigo) = norm_cod(p_codigo) for update;
  if not found then raise exception 'Cupom não encontrado.'; end if;
  ch := cupom_checar(c, l.id);
  if not (ch->>'valido')::boolean then
    select string_agg(x, ' ') into motivo from jsonb_array_elements_text(ch->'motivos') x;
    raise exception '%', motivo;
  end if;
  if length(trim(coalesce(p_cupom_fiscal, ''))) = 0 then raise exception 'Leia o QR do cupom fiscal ou digite o número da nota.'; end if;
  if v_chave is not null then
    v_erro := nota_erro(v_chave, c);
    if v_erro <> '' then raise exception '%', v_erro; end if;
  end if;
  update cadastros set status = 'usado', usado_em = now(), origem = 'balcao', valor = p_valor, nfce_chave = v_chave,
    cupom_fiscal = case when v_chave is null then trim(p_cupom_fiscal) else 'NFC-e ' || substr(v_chave, 26, 9)::bigint end
  where id = c.id returning * into c;
  return jsonb_build_object('ok', true, 'cupom', cupom_json(c));
end $$;

create or replace function balcao_recentes(p_pin text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l lojas;
begin
  select * into l from lojas where pin = p_pin;
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(cupom_json(c) order by c.usado_em desc) from cadastros c
    where c.id in (select id from cadastros where loja_id = l.id and status = 'usado' order by usado_em desc limit 8)), '[]'::jsonb);
end $$;

-- ---------- admin e dash (PIN da V4) ----------
create or replace function adm_entrar(p_pin text) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
begin perform exige_adm(p_pin); return true; end $$;

drop function if exists adm_dados(text, int);
-- p_bandeira null = grupo inteiro; 'tesoura' | 'magazine' | 'free' = só aquela bandeira
create or replace function adm_dados(p_pin text, p_sabado int, p_bandeira text default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare tem_base boolean;
begin
  perform exige_adm(p_pin);
  tem_base := exists (select 1 from base_cpfs);
  return jsonb_build_object(
    'sabados', coalesce((select jsonb_agg(to_jsonb(s) order by s.n) from sabados s), '[]'),
    'lojas', coalesce((select jsonb_agg(to_jsonb(l) order by l.nome) from lojas l where p_bandeira is null or l.bandeira = p_bandeira), '[]'),
    'influencers', coalesce((select jsonb_agg((to_jsonb(i) - 'foto') || jsonb_build_object(
        'foto', case when i.foto like 'http%' then i.foto else '' end, 'tem_foto', i.foto <> '',
        'tokens_modo', tokens_ativos(lj.bandeira), 'tokens_livres', tokens_livres(i.id, i.sabado_id),
        'emitidos', (select count(*) from cadastros c where c.influencer_id = i.id and (p_sabado is null or c.sabado_id = p_sabado)),
        'usados', (select count(*) from cadastros c where c.influencer_id = i.id and c.status = 'usado' and (p_sabado is null or c.sabado_id = p_sabado)),
        'novos', case when tem_base then (select count(*) from cadastros c where c.influencer_id = i.id and c.status = 'usado' and (p_sabado is null or c.sabado_id = p_sabado) and not exists (select 1 from base_cpfs b where b.cpf = c.cpf)) end,
        'ultimo', (select max(criado_em) from cadastros c where c.influencer_id = i.id)
      ) order by i.nome) from influencers i join lojas lj on lj.id = i.loja_id where p_bandeira is null or lj.bandeira = p_bandeira), '[]'),
    'serie', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'emitidos', em, 'usados', us) order by dia) from (
        select dia, sum(em) em, sum(us) us from (
          select (criado_em at time zone 'America/Sao_Paulo')::date dia, 1 em, 0 us from cadastros where (p_sabado is null or sabado_id = p_sabado) and (p_bandeira is null or bandeira = p_bandeira)
          union all
          select (usado_em at time zone 'America/Sao_Paulo')::date, 0, 1 from cadastros where usado_em is not null and (p_sabado is null or sabado_id = p_sabado) and (p_bandeira is null or bandeira = p_bandeira)
        ) x group by dia) y), '[]'),
    'base_total', (select count(*) from base_cpfs),
    'teste', modo_teste());
end $$;

-- foto da influencer (pode ser uma imagem embutida grande): só quando a ficha abre
create or replace function adm_influencer_foto(p_pin text, p_id int) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform exige_adm(p_pin);
  return jsonb_build_object('foto', coalesce((select foto from influencers where id = p_id), ''));
end $$;

create or replace function adm_salvar_influencer(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare i influencers; v_pref text := upper(regexp_replace(coalesce(p->>'prefixo', ''), '[^A-Za-z0-9]', '', 'g')); v_id int := nullif(p->>'id', '')::int;
begin
  perform exige_adm(p_pin);
  if length(trim(coalesce(p->>'nome', ''))) = 0 then raise exception 'Informe o nome da influencer.'; end if;
  if v_pref = '' then raise exception 'Informe o prefixo do cupom.'; end if;
  if not exists (select 1 from lojas where id = nullif(p->>'loja_id', '')::int) then raise exception 'Escolha a loja.'; end if;
  if not exists (select 1 from sabados where id = nullif(p->>'sabado_id', '')::int) then raise exception 'Escolha o sábado.'; end if;
  if exists (select 1 from influencers where prefixo = v_pref and id is distinct from v_id) then raise exception 'O prefixo % já é de outra influencer.', v_pref; end if;
  if v_id is not null then
    select * into i from influencers where id = v_id;
    if i.prefixo <> v_pref and exists (select 1 from cadastros where influencer_id = v_id) then raise exception 'Não dá para trocar o prefixo de quem já tem cupons emitidos.'; end if;
    update influencers set nome = trim(p->>'nome'), prefixo = v_pref, slug = lower(v_pref), instagram = coalesce(p->>'instagram', ''),
      whatsapp = coalesce(p->>'whatsapp', ''), loja_id = nullif(p->>'loja_id', '')::int, sabado_id = nullif(p->>'sabado_id', '')::int,
      lote = greatest(1, coalesce(nullif(p->>'lote', '')::int, 100)), meta = greatest(1, coalesce(nullif(p->>'meta', '')::int, 50)),
      foto = coalesce(p->>'foto', foto), ativo = coalesce((p->>'ativo')::boolean, true),
      etapa = coalesce(nullif(p->>'etapa', ''), etapa), notas = coalesce(p->>'notas', notas)
    where id = v_id returning * into i;
  else
    insert into influencers (nome, prefixo, slug, instagram, whatsapp, loja_id, sabado_id, lote, meta, foto, ativo, etapa, notas)
    values (trim(p->>'nome'), v_pref, lower(v_pref), coalesce(p->>'instagram', ''), coalesce(p->>'whatsapp', ''),
      nullif(p->>'loja_id', '')::int, nullif(p->>'sabado_id', '')::int, greatest(1, coalesce(nullif(p->>'lote', '')::int, 100)),
      greatest(1, coalesce(nullif(p->>'meta', '')::int, 50)), coalesce(p->>'foto', ''), coalesce((p->>'ativo')::boolean, true),
      coalesce(nullif(p->>'etapa', ''), 'convidada'), coalesce(p->>'notas', ''))
    returning * into i;
  end if;
  return to_jsonb(i);
end $$;

create or replace function adm_salvar_loja(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare l lojas; v_id int := nullif(p->>'id', '')::int; v_pin text := trim(coalesce(p->>'pin', '')); v_cnpj text := regexp_replace(coalesce(p->>'cnpj', ''), '\D', '', 'g');
begin
  perform exige_adm(p_pin);
  if length(trim(coalesce(p->>'nome', ''))) = 0 then raise exception 'Informe o nome da loja.'; end if;
  if v_pin !~ '^\d{4,6}$' then raise exception 'O PIN da loja precisa ter de 4 a 6 números.'; end if;
  if exists (select 1 from lojas where pin = v_pin and id is distinct from v_id) then raise exception 'Esse PIN já é de outra loja.'; end if;
  if v_cnpj <> '' and length(v_cnpj) <> 14 then raise exception 'O CNPJ precisa ter 14 números.'; end if;
  if coalesce(p->>'bandeira', 'tesoura') not in ('tesoura', 'magazine', 'free') then raise exception 'Escolha a bandeira da loja.'; end if;
  if v_id is not null then
    update lojas set nome = trim(p->>'nome'), cidade = coalesce(p->>'cidade', ''), endereco = coalesce(p->>'endereco', ''), horario = coalesce(p->>'horario', ''), pin = v_pin, cnpj = v_cnpj,
      bandeira = coalesce(nullif(p->>'bandeira', ''), bandeira)
    where id = v_id returning * into l;
  else
    insert into lojas (nome, cidade, endereco, horario, pin, cnpj, bandeira) values (trim(p->>'nome'), coalesce(p->>'cidade', ''), coalesce(p->>'endereco', ''), coalesce(p->>'horario', ''), v_pin, v_cnpj, coalesce(nullif(p->>'bandeira', ''), 'tesoura'))
    returning * into l;
  end if;
  return to_jsonb(l);
end $$;

create or replace function adm_salvar_sabado(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s sabados;
begin
  perform exige_adm(p_pin);
  update sabados set data = (p->>'data')::date, label = coalesce(p->>'label', ''),
    meta = coalesce(nullif(p->>'meta', '')::int, meta), fixo = coalesce(nullif(p->>'fixo', '')::numeric, fixo)
  where id = (p->>'id')::int returning * into s;
  if not found then raise exception 'Sábado não encontrado.'; end if;
  return to_jsonb(s);
end $$;

drop function if exists adm_cadastros(text, text, int, int, text);
drop function if exists adm_cadastros(text, text, int, int, text, int);
create or replace function adm_cadastros(p_pin text, p_busca text, p_sabado int, p_influencer int, p_status text, p_loja int default null, p_bandeira text default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare b text := lower(trim(coalesce(p_busca, ''))); bd text := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'); tem_base boolean; r jsonb;
begin
  perform exige_adm(p_pin);
  tem_base := exists (select 1 from base_cpfs);
  with f as (
    select c.id, c.criado_em from cadastros c
    where (p_sabado is null or c.sabado_id = p_sabado) and (p_influencer is null or c.influencer_id = p_influencer)
      and (p_loja is null or c.loja_id = p_loja) and (p_bandeira is null or c.bandeira = p_bandeira)
      and (coalesce(p_status, '') = '' or c.status = p_status)
      and (b = '' or lower(c.codigo) like '%' || b || '%' or lower(c.nome) like '%' || b || '%' or (length(bd) >= 4 and c.cpf like '%' || bd || '%'))
  )
  select jsonb_build_object('total', (select count(*) from f), 'linhas', coalesce((
    select jsonb_agg(cupom_json(c) || jsonb_build_object(
      'cpf', c.cpf, 'whatsapp', c.whatsapp, 'criado_em', c.criado_em,
      'cliente_novo', case when tem_base then not exists (select 1 from base_cpfs x where x.cpf = c.cpf) end) order by c.criado_em desc)
    from cadastros c where c.id in (select id from f order by criado_em desc limit 500)), '[]'::jsonb))
  into r;
  return r;
end $$;

create or replace function adm_base_cpfs(p_pin text, p_cpfs text[], p_substituir boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare lidos int;
begin
  perform exige_adm(p_pin);
  if p_substituir then delete from base_cpfs; end if;
  insert into base_cpfs (cpf)
  select distinct cpf_pad(x) from unnest(p_cpfs) x where length(cpf_pad(x)) = 11
  on conflict do nothing;
  select count(*) into lidos from unnest(p_cpfs) x where length(cpf_pad(x)) = 11;
  return jsonb_build_object('total', (select count(*) from base_cpfs), 'lidos', lidos);
end $$;

-- notas escaneadas no clube (Rock): [{cpf, chave, data, valor}]. Dá baixa no cupom do CPF com origem 'rock'.
-- A mesma lógica serve para o webhook da Rock quando a API estiver liberada (Edge Function chama esta função).
create or replace function adm_importar_notas(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare x jsonb; c cadastros; v_cpf text; v_chave text; v_data timestamptz; v_dia date; v_erro text; i int := 0;
  n_us int := 0; n_ja int := 0; n_sem int := 0; n_rec int := 0; det text[] := '{}';
begin
  perform exige_adm(p_pin);
  for x in select * from jsonb_array_elements(p) loop
    begin
      i := i + 1;
      v_cpf := cpf_pad(x->>'cpf');
      v_chave := substring(coalesce(x->>'chave', '') from '\d{44}');
      v_data := nullif(x->>'data', '')::timestamptz;
      v_dia := case when length(coalesce(x->>'data', '')) = 10 then (x->>'data')::date else (v_data at time zone 'America/Sao_Paulo')::date end;
      if not cpf_valido(v_cpf) or v_chave is null then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': CPF ou chave da nota inválidos.'); end if; continue; end if;
      select cd.* into c from cadastros cd join sabados s on s.id = cd.sabado_id
        where cd.cpf = v_cpf and (v_dia is null or s.data = v_dia)
        order by (cd.status = 'emitido') desc limit 1 for update of cd;
      if not found then n_sem := n_sem + 1; continue; end if;
      if c.status = 'usado' then n_ja := n_ja + 1; continue; end if;
      v_erro := nota_erro(v_chave, c);
      if v_erro <> '' then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ' (' || c.codigo || '): ' || v_erro); end if; continue; end if;
      update cadastros set status = 'usado', usado_em = coalesce(v_data, now()), origem = 'rock', nfce_chave = v_chave,
        cupom_fiscal = 'NFC-e ' || substr(v_chave, 26, 9)::bigint, valor = valor_num(x->>'valor')
      where id = c.id;
      n_us := n_us + 1;
    exception when others then
      n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': ' || sqlerrm); end if;
    end;
  end loop;
  return jsonb_build_object('usados', n_us, 'ja_usados', n_ja, 'sem_cupom', n_sem, 'recusadas', n_rec, 'detalhes', to_jsonb(det));
end $$;

-- vendas do PDV com cupom: [{cupom, cpf, nota, data, valor}]. Dá baixa pelo código, confere o CPF do cadastro e a nota.
create or replace function adm_importar_vendas(p_pin text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare x jsonb; c cadastros; v_cod text; v_cpf text; v_chave text; v_erro text; i int := 0;
  n_us int := 0; n_ja int := 0; n_sem int := 0; n_rec int := 0; det text[] := '{}';
begin
  perform exige_adm(p_pin);
  for x in select * from jsonb_array_elements(p) loop
    begin
      i := i + 1;
      v_cod := upper(regexp_replace(coalesce(x->>'cupom', ''), '[^A-Za-z0-9]', '', 'g'));
      v_cpf := cpf_pad(x->>'cpf');
      v_chave := substring(coalesce(x->>'nota', '') from '\d{44}');
      select * into c from cadastros where norm_cod(codigo) = v_cod for update;
      if not found then n_sem := n_sem + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': o token ' || v_cod || ' foi usado no caixa sem cadastro na página. Não conta para a meta.'); end if; continue; end if;
      if v_cpf <> '' and v_cpf <> c.cpf then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ' (' || c.codigo || '): CPF da venda diferente do CPF do cadastro.'); end if; continue; end if;
      if c.status = 'usado' then n_ja := n_ja + 1; continue; end if;
      if v_chave is not null then
        v_erro := nota_erro(v_chave, c);
        if v_erro <> '' then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ' (' || c.codigo || '): ' || v_erro); end if; continue; end if;
      end if;
      update cadastros set status = 'usado', usado_em = coalesce(nullif(x->>'data', '')::timestamptz, now()), origem = 'pdv', nfce_chave = v_chave,
        cupom_fiscal = case when v_chave is null then nullif(trim(x->>'nota'), '') else 'NFC-e ' || substr(v_chave, 26, 9)::bigint end,
        valor = valor_num(x->>'valor')
      where id = c.id;
      n_us := n_us + 1;
    exception when others then
      n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': ' || sqlerrm); end if;
    end;
  end loop;
  return jsonb_build_object('usados', n_us, 'ja_usados', n_ja, 'sem_cupom', n_sem, 'recusadas', n_rec, 'detalhes', to_jsonb(det));
end $$;

create or replace function adm_teste(p_pin text, p_teste boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform exige_adm(p_pin);
  insert into config (chave, valor) values ('teste', case when p_teste then '1' else '0' end)
  on conflict (chave) do update set valor = excluded.valor;
  return jsonb_build_object('teste', p_teste);
end $$;

-- ---------- campanha de fim de ano (notas cadastradas no hotsite/WhatsApp do sorteio) ----------
-- Entra por arquivo exportado da campanha: CPF; nome; nota (chave ou número); data; valor; loja ou bandeira.
create table if not exists fimdeano_notas (
  id bigserial primary key,
  cpf text not null,
  nome text not null default '',
  nota text not null,                -- chave de 44 dígitos ou número da nota
  data timestamptz,
  valor numeric,
  loja text not null default '',
  bandeira text not null default 'tesoura',   -- campanha de fim de ano de cada bandeira
  importado_em timestamptz not null default now(),
  constraint fimdeano_unica unique (cpf, nota, bandeira)   -- a mesma nota pode existir em bandeiras diferentes
);
alter table fimdeano_notas drop constraint if exists fimdeano_notas_cpf_nota_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fimdeano_unica') then
    alter table fimdeano_notas add constraint fimdeano_unica unique (cpf, nota, bandeira);
  end if;
end $$;
create index if not exists fimdeano_cpf on fimdeano_notas (cpf);
alter table fimdeano_notas enable row level security;

drop function if exists adm_importar_fimdeano(text, jsonb, boolean);
create or replace function adm_importar_fimdeano(p_pin text, p jsonb, p_substituir boolean default false, p_bandeira text default 'tesoura') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare x jsonb; v_cpf text; v_nota text; i int := 0; n_ok int := 0; n_rep int := 0; n_rec int := 0; det text[] := '{}';
begin
  perform exige_adm(p_pin);
  if coalesce(p_bandeira, '') not in ('tesoura', 'magazine', 'free') then raise exception 'Escolha de qual bandeira é a campanha.'; end if;
  if p_substituir then delete from fimdeano_notas where bandeira = p_bandeira; end if;
  for x in select * from jsonb_array_elements(p) loop
    begin
      i := i + 1;
      v_cpf := cpf_pad(x->>'cpf');
      v_nota := coalesce(substring(coalesce(x->>'nota', '') from '\d{44}'), nullif(trim(coalesce(x->>'nota', '')), ''),
                         'sem-nota-' || coalesce(x->>'data', '') || '-' || coalesce(x->>'valor', ''));
      if not cpf_valido(v_cpf) then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': CPF inválido.'); end if; continue; end if;
      insert into fimdeano_notas (cpf, nome, nota, data, valor, loja, bandeira)
      values (v_cpf, trim(coalesce(x->>'nome', '')), v_nota, nullif(x->>'data', '')::timestamptz, valor_num(x->>'valor'), trim(coalesce(x->>'loja', '')), p_bandeira)
      on conflict (cpf, nota, bandeira) do nothing;
      if found then n_ok := n_ok + 1; else n_rep := n_rep + 1; end if;
    exception when others then
      n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': ' || sqlerrm); end if;
    end;
  end loop;
  return jsonb_build_object('importadas', n_ok, 'repetidas', n_rep, 'recusadas', n_rec, 'detalhes', to_jsonb(det),
    'total_notas', (select count(*) from fimdeano_notas where bandeira = p_bandeira), 'total_cpfs', (select count(distinct cpf) from fimdeano_notas where bandeira = p_bandeira));
end $$;

-- cruzamento por CPF: quem pegou o cupom na página x quem cadastrou nota na campanha de fim de ano, e quanto gastou
drop function if exists adm_comparativo(text, int);
drop function if exists adm_comparativo(text, int, text);
-- p_todos = false: a lista de pessoas traz só quem está na página E no sorteio (a tela); true: todos (para exportar)
create or replace function adm_comparativo(p_pin text, p_sabado int, p_bandeira text default null, p_todos boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform exige_adm(p_pin);
  with lp as (   -- um registro por CPF e bandeira (primeiro cadastro no recorte)
    select distinct on (c.cpf, c.bandeira) c.cpf, c.nome, c.codigo, c.influencer_id, c.loja_id, c.status, c.valor valor_cupom, c.criado_em,
      (select min(criado_em) from cadastros x where x.cpf = c.cpf and (p_bandeira is null or x.bandeira = p_bandeira)) primeiro
    from cadastros c where (p_sabado is null or c.sabado_id = p_sabado) and (p_bandeira is null or c.bandeira = p_bandeira)
    order by c.cpf, c.bandeira, c.criado_em
  ), fa as (
    select cpf, max(nome) nome, count(*) notas, coalesce(sum(valor), 0) valor, min(data) primeira, max(loja) loja from fimdeano_notas
    where p_bandeira is null or bandeira = p_bandeira group by cpf
  ), pos as (    -- gasto na campanha depois do cadastro na página
    select f.cpf, count(*) notas, coalesce(sum(f.valor), 0) valor
    from fimdeano_notas f join lp on lp.cpf = f.cpf where (p_bandeira is null or f.bandeira = p_bandeira) and (f.data is null or f.data >= lp.primeiro) group by f.cpf
  ), j as (
    select lp.*, fa.notas fa_notas, fa.valor fa_valor, pos.notas pos_notas, pos.valor pos_valor
    from lp left join fa on fa.cpf = lp.cpf left join pos on pos.cpf = lp.cpf
  )
  select jsonb_build_object(
    'totais', (select jsonb_build_object(
        'lp', (select count(*) from lp),
        'lp_usaram', (select count(*) from lp where status = 'usado'),
        'lp_valor_cupom', (select coalesce(sum(valor_cupom), 0) from lp where status = 'usado'),
        'fa_cpfs', (select count(*) from fa), 'fa_notas', (select coalesce(sum(notas), 0) from fa), 'fa_valor', (select coalesce(sum(valor), 0) from fa),
        'ambos', (select count(*) from j where fa_notas is not null),
        'ambos_notas', (select coalesce(sum(fa_notas), 0) from j), 'ambos_valor', (select coalesce(sum(fa_valor), 0) from j),
        'ambos_pos_valor', (select coalesce(sum(pos_valor), 0) from j), 'ambos_pos_notas', (select coalesce(sum(pos_notas), 0) from j),
        'ambos_usaram', (select count(*) from j where fa_notas is not null and status = 'usado'),
        'so_fa', (select count(*) from fa where not exists (select 1 from lp where lp.cpf = fa.cpf)),
        'so_fa_valor', (select coalesce(sum(valor), 0) from fa where not exists (select 1 from lp where lp.cpf = fa.cpf)))),
    'influencers', coalesce((select jsonb_agg(z order by (z->>'fa_valor')::numeric desc, z->>'nome') from (
        select jsonb_build_object('id', i.id, 'nome', i.nome, 'slug', i.slug, 'prefixo', i.prefixo, 'loja_id', i.loja_id,
          'lp', count(j.cpf), 'usaram', count(j.cpf) filter (where j.status = 'usado'),
          'valor_cupom', coalesce(sum(j.valor_cupom) filter (where j.status = 'usado'), 0),
          'ambos', count(j.fa_notas), 'fa_notas', coalesce(sum(j.fa_notas), 0), 'fa_valor', coalesce(sum(j.fa_valor), 0),
          'pos_valor', coalesce(sum(j.pos_valor), 0)) z
        from influencers i left join j on j.influencer_id = i.id
        group by i.id having count(j.cpf) > 0) t), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object('cpf', j.cpf, 'nome', j.nome, 'codigo', j.codigo, 'influencer', i.nome, 'loja', l.nome,
        'cadastro', j.criado_em, 'status', j.status, 'valor_cupom', j.valor_cupom,
        'fa_notas', coalesce(j.fa_notas, 0), 'fa_valor', coalesce(j.fa_valor, 0), 'pos_valor', coalesce(j.pos_valor, 0)) order by j.fa_valor desc nulls last, j.criado_em)
      from j join influencers i on i.id = j.influencer_id join lojas l on l.id = j.loja_id where p_todos or j.fa_notas is not null), '[]'::jsonb))
  into r;
  return r;
end $$;

-- ---------- tokens do PDV ----------
-- p: [{token, influencer}] (influencer = prefixo, link ou nome; obrigatória). Substituir apaga só os tokens ainda livres
-- das influencers que vierem na lista.
drop function if exists adm_importar_tokens(text, jsonb, boolean);
-- p_sabado: a qual sábado o lote pertence (null = o sábado atual de cada influencer)
create or replace function adm_importar_tokens(p_pin text, p jsonb, p_substituir boolean default false, p_sabado int default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare x jsonb; v_cod text; v_inf text; v_id int; v_sab int; n_match int; limpas int[] := '{}'; i int := 0; n_ok int := 0; n_rep int := 0; n_rec int := 0; det text[] := '{}';
begin
  perform exige_adm(p_pin);
  if p_sabado is not null and not exists (select 1 from sabados where id = p_sabado) then raise exception 'Sábado não encontrado.'; end if;
  for x in select * from jsonb_array_elements(p) loop
    begin
      i := i + 1;
      v_cod := trim(coalesce(x->>'token', ''));
      v_inf := lower(trim(coalesce(x->>'influencer', '')));
      if length(norm_cod(v_cod)) < 3 then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': token vazio ou curto demais.'); end if; continue; end if;
      if v_inf = '' then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': ' || v_cod || ' sem influencer. Todo token precisa ser de uma influencer.'); end if; continue; end if;
      select count(*), min(id) into n_match, v_id from influencers where lower(prefixo) = v_inf or slug = v_inf or lower(nome) = v_inf;
      if n_match = 0 then select count(*), min(id) into n_match, v_id from influencers where lower(split_part(nome, ' ', 1)) = v_inf; end if;
      if n_match > 1 then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': "' || (x->>'influencer') || '" serve para mais de uma influencer. Use o prefixo do cupom.'); end if; continue; end if;
      if n_match = 0 then v_id := null; end if;
      if v_id is null then n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': influencer "' || (x->>'influencer') || '" não encontrada.'); end if; continue; end if;
      v_sab := coalesce(p_sabado, (select sabado_id from influencers where id = v_id));
      if p_substituir and not (v_id = any(limpas)) then delete from tokens where cadastro_id is null and influencer_id = v_id and sabado_id = v_sab; limpas := limpas || v_id; end if;
      if exists (select 1 from cadastros where norm_cod(codigo) = norm_cod(v_cod)) and not exists (select 1 from tokens where norm_cod(codigo) = norm_cod(v_cod)) then
        n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': ' || v_cod || ' já é um cupom emitido.'); end if; continue;
      end if;
      if exists (select 1 from tokens where norm_cod(codigo) = norm_cod(v_cod)) then n_rep := n_rep + 1; continue; end if;
      insert into tokens (codigo, influencer_id, sabado_id) values (v_cod, v_id, v_sab);
      n_ok := n_ok + 1;
    exception when others then
      n_rec := n_rec + 1; if cardinality(det) < 12 then det := det || ('Linha ' || i || ': ' || sqlerrm); end if;
    end;
  end loop;
  return jsonb_build_object('importados', n_ok, 'repetidos', n_rep, 'recusados', n_rec, 'detalhes', to_jsonb(det),
    'total', (select count(*) from tokens), 'livres', (select count(*) from tokens where cadastro_id is null));
end $$;

drop function if exists adm_tokens(text);
create or replace function adm_tokens(p_pin text, p_sabado int default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform exige_adm(p_pin);
  return jsonb_build_object(
    'total', (select count(*) from tokens where p_sabado is null or sabado_id = p_sabado),
    'livres', (select count(*) from tokens where cadastro_id is null and (p_sabado is null or sabado_id = p_sabado)),
    'influencers', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome, 'prefixo', i.prefixo, 'sabado_id', i.sabado_id,
        'total', (select count(*) from tokens t where t.influencer_id = i.id and (p_sabado is null or t.sabado_id = p_sabado)),
        'livres', (select count(*) from tokens t where t.influencer_id = i.id and t.cadastro_id is null and (p_sabado is null or t.sabado_id = p_sabado))) order by i.nome)
      from influencers i), '[]'::jsonb));
end $$;

-- ---------- backup em planilha (Google Sheets da GTO puxa a cada 15 min pelo Apps Script de infra/backup-planilha.gs) ----------
-- Protegido por token próprio (não é a senha do CRM). Configurar: ver fim do arquivo. json (não jsonb) para manter a ordem das colunas.
create or replace function backup_exportar(p_token text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare tz text := 'America/Sao_Paulo';
begin
  if not exists (select 1 from config where chave = 'backup_token_hash' and valor = crypt(coalesce(p_token, ''), valor)) then
    raise exception 'Token de backup inválido ou não configurado.';
  end if;
  return json_build_object(
    'gerado_em', to_char(now() at time zone tz, 'YYYY-MM-DD HH24:MI:SS'),
    'cadastros', coalesce((select json_agg(json_build_object(
        'cupom', c.codigo, 'bandeira', c.bandeira, 'influencer', i.nome, 'loja', l.nome, 'sabado', to_char(s.data, 'YYYY-MM-DD'),
        'nome', c.nome, 'cpf', c.cpf, 'whatsapp', c.whatsapp, 'bairro', c.bairro,
        'cadastro_em', to_char(c.criado_em at time zone tz, 'YYYY-MM-DD HH24:MI:SS'),
        'aceite_lgpd_em', to_char(c.aceite_em at time zone tz, 'YYYY-MM-DD HH24:MI:SS'),
        'status', c.status, 'usado_em', to_char(c.usado_em at time zone tz, 'YYYY-MM-DD HH24:MI:SS'),
        'nota', c.cupom_fiscal, 'chave_nfce', c.nfce_chave, 'valor', c.valor, 'origem', c.origem) order by c.id)
      from cadastros c join influencers i on i.id = c.influencer_id join lojas l on l.id = c.loja_id join sabados s on s.id = c.sabado_id), '[]'::json),
    'notas_fim_de_ano', coalesce((select json_agg(json_build_object(
        'bandeira', f.bandeira, 'cpf', f.cpf, 'nome', f.nome, 'nota', f.nota, 'data', to_char(f.data at time zone tz, 'YYYY-MM-DD HH24:MI:SS'),
        'valor', f.valor, 'loja', f.loja, 'importado_em', to_char(f.importado_em at time zone tz, 'YYYY-MM-DD HH24:MI:SS')) order by f.id)
      from fimdeano_notas f), '[]'::json),
    'influencers', coalesce((select json_agg(json_build_object(
        'nome', i.nome, 'cupom_prefixo', i.prefixo, 'instagram', i.instagram, 'bandeira', l.bandeira, 'loja', l.nome, 'sabado', to_char(s.data, 'YYYY-MM-DD'),
        'lote', i.lote, 'meta', i.meta, 'etapa', i.etapa, 'ativa', i.ativo) order by i.nome)
      from influencers i join lojas l on l.id = i.loja_id join sabados s on s.id = i.sabado_id), '[]'::json));
end $$;

-- ---------- permissões: o público só executa as funções ----------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function lp_info(text), cadastrar(text, text, text, text, text, boolean),
  balcao_entrar(text), balcao_buscar(text, text), balcao_validar(text, text, text, numeric), balcao_recentes(text),
  adm_entrar(text), adm_dados(text, int, text), adm_salvar_influencer(text, jsonb), adm_salvar_loja(text, jsonb),
  adm_salvar_sabado(text, jsonb), adm_cadastros(text, text, int, int, text, int, text), adm_importar_notas(text, jsonb), adm_importar_vendas(text, jsonb), adm_base_cpfs(text, text[], boolean), adm_teste(text, boolean),
  adm_importar_fimdeano(text, jsonb, boolean, text), adm_comparativo(text, int, text, boolean), backup_exportar(text),
  adm_importar_tokens(text, jsonb, boolean, int), adm_tokens(text, int), adm_influencer_foto(text, int)
to anon;

-- avisa o PostgREST que a estrutura mudou (no Supabase é inofensivo)
notify pgrst, 'reload schema';

-- ---------- dados iniciais ----------
insert into sabados (n, data, label, meta, fixo) select * from (values
  (1, date '2026-11-28', 'Black Friday', 50, 1000),
  (2, date '2026-12-05', 'Abertura do Natal', 70, 1500),
  (3, date '2026-12-12', 'Natal', 130, 1500)) v
where not exists (select 1 from sabados);

-- PIN do admin: TROCAR '1234' antes de abrir para as lojas
insert into config (chave, valor) values ('admin_pin_hash', extensions.crypt('1234', extensions.gen_salt('bf', 10)))
on conflict (chave) do update set valor = excluded.valor;
insert into config (chave, valor) values ('teste', '1') on conflict (chave) do nothing;

-- Token do backup em planilha: gerar um valor longo (openssl rand -hex 32), rodar a linha abaixo com ele e colar o
-- mesmo valor nas propriedades do Apps Script (BACKUP_TOKEN). Sem esta linha o backup fica desligado.
-- insert into config (chave, valor) values ('backup_token_hash', extensions.crypt('TOKEN_AQUI', extensions.gen_salt('bf', 10)))
--   on conflict (chave) do update set valor = excluded.valor;
