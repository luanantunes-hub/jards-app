-- PD1.9, ajuste do recorte da pessoa: o que a revisão de producao_equipe achou, antes de existir
-- qualquer dado ou tela da equipe.
--
-- 1) Quem tem o recorte "só onde está vinculado" podia ligar a um vínculo ou a uma escala uma pessoa
--    que não vê, sabendo o id dela, e com o vínculo passava a ver a pessoa (nome, e-mail, telefone).
--    Agora o vínculo e a escala só aceitam de quem grava uma pessoa que ele já vê. A conferência
--    olha o banco de antes da gravação, então gravar não abre a pessoa a quem grava.
-- 2) A escala de uma data que se vê aparecia sem a pessoa escalada quando ela não tinha vínculo num
--    lugar que se vê (o diarista de um dia). Agora quem vê a data vê quem está escalado nela:
--    auth_producao_ve_pessoa ganha o ramo da escala, no fim (o resto do texto igual).
-- Quem vê a organização inteira, o admin e o suporte não mudam: para eles a pessoa sempre está à
-- vista. As regras de ler e de apagar não mudam; nas de alterar, só a condição do que sai (o que
-- entra já era de quem vê o lugar, e quem vê o lugar vê as pessoas dele).
--
-- Aditiva e reaplicável, sem DROP: create or replace na função (mesma assinatura, mesmos privilégios)
-- e alter policy nas quatro regras de escrita. As tabelas da equipe estão vazias e nenhuma
-- organização tem a produção (0 contratos em 30/10/2026).

set local lock_timeout = '10s';

create or replace function public.auth_producao_ve_pessoa(p_org uuid, p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.auth_producao_ve_temporada(p_org, null)
    or exists (
      select 1 from public.producao_vinculos v
      where v.organization_id = p_org and v.pessoa_id = p_pessoa_id
        and ((v.temporada_id is not null and public.auth_producao_ve_temporada(p_org, v.temporada_id))
          or (v.espaco_id is not null and public.auth_producao_ve_espaco(p_org, v.espaco_id)))
    )
    or exists (
      select 1 from public.producao_escalas e
      join public.producao_datas d on d.id = e.data_id
      where e.organization_id = p_org and e.pessoa_id = p_pessoa_id and d.organization_id = p_org
        and public.auth_producao_ve_temporada(p_org, d.temporada_id)
    );
$$;

revoke execute on function public.auth_producao_ve_pessoa(uuid, uuid) from public, anon;
grant execute on function public.auth_producao_ve_pessoa(uuid, uuid) to authenticated;

alter policy "producao_vinculos: insere" on public.producao_vinculos
  with check (public.auth_producao_pode(organization_id, 'editar')
              and ((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))
                or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id)))
              and public.auth_producao_ve_pessoa(organization_id, pessoa_id));

alter policy "producao_vinculos: edita" on public.producao_vinculos
  with check (public.auth_producao_pode(organization_id, 'editar')
              and ((temporada_id is not null and public.auth_producao_ve_temporada(organization_id, temporada_id))
                or (espaco_id is not null and public.auth_producao_ve_espaco(organization_id, espaco_id)))
              and public.auth_producao_ve_pessoa(organization_id, pessoa_id));

alter policy "producao_escalas: insere" on public.producao_escalas
  with check (public.auth_producao_pode(organization_id, 'editar')
              and exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id)
              and public.auth_producao_ve_pessoa(organization_id, pessoa_id));

alter policy "producao_escalas: edita" on public.producao_escalas
  with check (public.auth_producao_pode(organization_id, 'editar')
              and exists (select 1 from public.producao_datas d where d.id = producao_escalas.data_id)
              and public.auth_producao_ve_pessoa(organization_id, pessoa_id));

comment on function public.auth_producao_ve_pessoa(uuid, uuid) is
  'O recorte da pessoa deixa ver esta pessoa da equipe? Quem não tem recorte vê; com o recorte por vínculo, quem tem vínculo num lugar que ela vê ou está escalado numa data que ela vê.';
