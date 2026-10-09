-- P8.4: o nível da manifestação esportiva e a validade da CRC na prestação.
--
-- Na Lei de Incentivo ao Esporte, o nível da manifestação (formação
-- esportiva, esporte para toda a vida, excelência) muda o limite de
-- elaboração e captação (10%, 7% ou 5% de fim + meio; Portaria MESP 10/2026,
-- art. 26), o limite de captação por projeto (art. 14) e quem pode receber
-- bolsa (art. 13). No nível excelência, a Certidão de Registro Cadastral
-- (CRC) precisa estar válida durante toda a execução (art. 31).
-- Quem edita a prestação grava os dois campos como os demais dados oficiais.

alter table public.prestacoes_contas
  add column if not exists manifestacao_esportiva text
    constraint prestacoes_contas_manifestacao_esportiva_check
    check (manifestacao_esportiva is null or manifestacao_esportiva in ('formacao', 'toda_vida', 'excelencia')),
  add column if not exists crc_validade date;

comment on column public.prestacoes_contas.manifestacao_esportiva is
  'LIE: nível da manifestação esportiva (formacao, toda_vida, excelencia), que define os limites de elaboração e de captação e a bolsa.';
comment on column public.prestacoes_contas.crc_validade is
  'LIE: validade da Certidão de Registro Cadastral do proponente, exigida no nível excelência durante toda a execução.';
