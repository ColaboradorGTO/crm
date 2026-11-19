-- Migração 003 · cadastro de influencer sem loja ou sem sábado escolhido.
-- Antes: o formulário mandava loja_id/sabado_id vazio ("") e o banco respondia
--   invalid input syntax for type integer: ""  (código 22P02)
-- Agora: vazio vira nulo e a função devolve "Escolha a loja." / "Escolha o sábado.". Idempotente (create or replace).

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
