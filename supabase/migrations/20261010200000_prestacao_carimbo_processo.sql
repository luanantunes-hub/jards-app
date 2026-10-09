-- P8.8: carimbo e atesto das notas e GRU da LIE.
--
-- Na Lei de Incentivo ao Esporte, cada nota original leva na frente o carimbo
-- com o número do projeto no SLI e, no verso, o atesto de recebimento com a
-- data e a assinatura (modelo de carimbos da DPPIE; Portaria MESP 10/2026,
-- art. 41, § 1º, e art. 49, III). O modelo publicado ainda cita a Lei
-- 11.438/2006, revogada pela LC 222/2025: o texto da lei no carimbo fica
-- escolhido na prestação. A data do atesto vai na despesa, para conferir que
-- não vem antes da emissão nem fora da vigência.
--
-- O número do processo no SEI passa a ficar na prestação: é a referência da
-- GRU da LIE ("número do processo, sem caracteres especiais") e o "Nº do
-- processo" dos cabeçalhos do formulário PCP/PCF e da grade de RH.
-- Quem edita a prestação grava os campos como os demais dados oficiais.

alter table public.prestacoes_contas
  add column if not exists numero_processo text
    constraint prestacoes_contas_numero_processo_check
    check (numero_processo is null or char_length(btrim(numero_processo)) between 1 and 60),
  add column if not exists carimbo_lei text
    constraint prestacoes_contas_carimbo_lei_check
    check (carimbo_lei is null or char_length(btrim(carimbo_lei)) between 1 and 80);

comment on column public.prestacoes_contas.numero_processo is
  'Número do processo no órgão (na LIE, o processo no SEI): referência da GRU e cabeçalho dos formulários.';
comment on column public.prestacoes_contas.carimbo_lei is
  'Texto da lei no carimbo das notas (LIE). Vazio: o do modelo publicado pela DPPIE.';

alter table public.prestacao_comprovantes
  add column if not exists atestado_em date;

comment on column public.prestacao_comprovantes.atestado_em is
  'Data do atesto de recebimento no verso da nota (LIE: "ATESTO QUE O SERVIÇO FOI RECEBIDO EM").';
