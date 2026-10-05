# IN ANCINE 150/2019: conferência das regras "a confirmar"

> Leitura feita em 05/10/2026. As decisões tomadas a partir dela estão em `lib/prestacao/regimes/conferencias/ancine-in150-2019.ts`, aplicadas na versão 2 do regime.

Fonte: texto oficial da IN 150/2019 com o Anexo (gov.br/ancine). Foram 159 itens. Cada citação foi conferida por script como trecho literal do texto; a única normalização foi trocar espaço não separável por espaço comum.

## Contagem

| Veredito | Itens |
|---|---|
| confirmada | 66 |
| ausente_vale_outra_norma | 55 |
| diferente | 27 |
| ausente | 11 |

## Diferenças relevantes (por importância)

1. **Prestação parcial: sem reanálise na final.** Despesas da parcial "não serão objeto de nova análise" na final, e a análise parcial vai à Diretoria Colegiada. Dispositivos: art. 58 e art. 57. Itens: `prestacaoParcial.regras[reanalise_na_final]` e `prestacaoParcial`.
2. **Concentração por fornecedor: mais exceções.** Os percentuais são os mesmos (≥ 25% gera ressalva e advertência; > 50% gera inabilitação). Mas a IN 150 tem oito exceções: desenvolvimento, sala (construção, reforma ou atualização), aquisição de ações, finalização, comercialização, animação, produção com orçamento executado **até** R$ 500 mil e jogos. Dispositivos: art. 29, VI; art. 43, § 1º, II, c.
3. **Tarifas bancárias: glosadas "de qualquer natureza".** Não há a exceção da tarifa de manutenção, que veio da IN 167/2023 na IN 159. Dispositivo: art. 21, VII. Itens: `contas.tarifas` e `despesas.vedadas[juros_multas_tarifas]`.
4. **Reembolso: hipóteses diferentes.** Valem diárias, figurante até R$ 1.000/mês, **rateio de serviços internalizados**, compras até R$ 1.000 cada e locação até R$ 1.000. Não entram tributos, compra no exterior com cartão nem aluguel por temporada. Dispositivo: art. 16.
5. **Multa na não aprovação.** São 50% sobre o débito atualizado (Lei 8.685) e 20% "calculada sobre o valor total dos recursos" (Funcines). Para o FSA e o fomento direto, a IN 150 remete ao regramento próprio, sem fixar 20%. Dispositivos: arts. 34 a 36 e 38.
6. **Redução do orçamento global.** Em projetos de incentivo fiscal, o pedido de redução aos valores executados vai junto com a prestação, como documento do Anexo, e não precisa de aprovação prévia. O sistema não lista esse documento. Dispositivo: Anexo, art. 1º, VII.
7. **Contrapartida por doação.** O teto é o valor aprovado do item, e não o saldo depois da execução pública. A declaração segue o art. 19. Dispositivos: art. 18, § 1º, e art. 19.
8. **Agenciamento e partes relacionadas.**
   - A IN 150 não veda agenciamento pago à proponente, a coprodutores, ao grupo ou a sócios (art. 21, IV).
   - Exige 3 orçamentos só para bens da proponente, do coexecutor ou do coprodutor, sem falar em grupo econômico (art. 12).
9. **Contas de movimentação.** Ficam no Banco do Brasil, abertas pela ANCINE. Projetos aprovados antes da IN 150 podem manter a conta já aberta em outro banco, se autorizada. Dispositivo: art. 71 (IN 125, art. 55, § 3º; art. 73, § 3º, II).
10. **Depósito legal.** O comprovante vai com o material do objeto, e não "até o fim da execução financeira". Há rito de 30 dias para GRU ou nova cópia. Dispositivo: art. 71 (IN 125, art. 128-A).
11. **Carimbo em cupom fiscal.** Na IN 150 o carimbo vai **no verso**, não no anverso, e a referência é a "numeração junto à ANCINE". Dispositivo: art. 9º, § 2º.
12. **Cartão de crédito internacional.** Serve para pequenas despesas de manutenção de equipe no exterior, e o cartão pode ser da proponente. Dispositivo: art. 15, II.
13. **Pagamento ao exterior.** Exige contrato de câmbio detalhado e invoice com o título do projeto. Não há SWIFT. Dispositivo: art. 15, I.
14. **Auditoria independente.** Está liberada para projetos do art. 5º, I, da IN 42/2005. Dispositivo: art. 21, XII.
15. **Material permanente.** Há uma exceção a mais: aquisição para pagar credores de serviços ou locações. Dispositivo: art. 21, XVII, c.
16. **Infraestrutura.**
   - Na sala, o memorial do engenheiro ou arquiteto é sempre exigido.
   - Na atualização tecnológica, entra o documento fiscal.
   - Nos dois casos há inspeção in loco obrigatória e não se pedem fotos da logomarca.
   - Dispositivo: art. 71 (IN 125, art. 85, V, VI e § 7º).
17. **Remanejamento e inclusão.** Não há equivalente ao art. 20 da IN 159. O remanejamento em desacordo gera ressalva e advertência (art. 29, V). Despesa não autorizada na análise da execução final é glosada (art. 21, XV).
18. **Encerramento das contas.** É exigido para as contas de movimentação, sem a restrição "abertas pela proponente". Dispositivo: Anexo, art. 1º, V.
19. **Modelos oficiais.** A IN 150 tem modelos próprios de RP, DE e DO (`modelos-oficiais/ancine/IN_150_*.xls`). O leiaute é igual ao da IN 159; mudam o título "(IN 150)", o cabeçalho e, no DO, a aba e a expressão "significativas diferenças".

## Outros pontos

- **Norma de aprovação da época.** Para projetos da IN 150, essa norma era a **IN 125/2015**: a IN 150 a cita no Anexo, art. 1º, VIII, e a altera no art. 71.
  - O material do objeto por modalidade não está na IN 150, que remete à IN 125, art. 85. Por isso desenvolvimento, produção, distribuição, festival e formação ficaram como "ausente".
  - Os itens que vêm da IN 158 (tetos, grupos, prazos de acompanhamento e de conclusão) só valem se a regra de transição da IN 158 alcançar o projeto. Se não alcançar, é preciso conferir na IN 125.
- **Cabeçalho do regime.** O arquivo `ancine-in150-2019.ts` diz "IN 125/2015 para despesas até 2019". Mas a IN 150 revoga a **IN 124/2015** (art. 73), que era a norma de prestação de contas anterior, e vale para despesas a partir de 1º/1/2020 (arts. 66 e 75).
- **Regra `documentos_em_180_dias`.** O regime a acrescenta citando o Anexo, art. 2º, § 2º, da IN 159. A IN 150 não tem regra equivalente.
- **Diferenças que o regime já tinha, agora confirmadas no texto:**
  - período e despesas prévias até 5% (art. 14, parágrafo único);
  - documento com data posterior ao débito (art. 13; art. 21, XXIX);
  - aplicação financeira obrigatória (art. 29, VII; IN 125, art. 57, na redação do art. 71);
  - empregados CLT por recibo de reembolso com contracheque e rateio (art. 10, III).
- **Dispositivos com numeração a corrigir.**
  - Dispensa na parcial: na IN 150 é o Anexo, art. 1º, § 2º (não art. 2º, § 3º).
  - Material do objeto: Anexo, art. 1º, VIII (não VII).
  - Equivalências de artigos (IN 159 → IN 150): art. 18 → art. 21; art. 19 → art. 22; art. 28 → art. 29; art. 29 → art. 30; art. 42 → art. 43.
