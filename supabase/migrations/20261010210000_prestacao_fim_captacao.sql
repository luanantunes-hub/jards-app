-- P9.1: fim da captação na prestação.
--
-- Na saúde (Anexo LXXXVI-A da PRC GM/MS 5/2017, arts. 58 e 59), a
-- readequação para menor (de 60% a 99,99% captado) e a readequação para
-- maior (até 20% do aprovado) são pedidas em 30 dias do fim da captação, e a
-- captação que termina abaixo de 60% leva ao indeferimento. A data é um
-- marco como os outros da prestação: quem edita a prestação grava.

alter table public.prestacoes_contas
  add column if not exists data_fim_captacao date;

comment on column public.prestacoes_contas.data_fim_captacao is
  'Fim do período de captação (P9.1). Na saúde, conta o prazo de 30 dias da readequação para menor ou para maior (Anexo LXXXVI-A, arts. 58 e 59).';
