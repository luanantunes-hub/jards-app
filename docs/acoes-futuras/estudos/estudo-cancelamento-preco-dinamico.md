# Estudo simples: cancelamento, reembolso e chargeback com preço dinâmico

**Data:** 22/11/2026. **Pergunta do dono:** se o comprador vê um preço, compra, e depois vê o ingresso mais barato, quanto isso aumenta cancelamentos e chargebacks?

**Resposta curta:** não existe número público medido para isso, e eu não inventei um. O que dá para fazer é (1) ver o que a evidência diz sobre o mecanismo, (2) medir a nossa exposição pelas regras do motor e (3) montar um modelo com faixas, deixando claro que as taxas dele são **suposições** a trocar por dados reais.

## 1. O que a evidência diz

- **Reembolso por queda de preço costuma ser recusado.** Os grandes vendedores de ingresso tratam a venda como definitiva e a queda de preço não é motivo padrão de reembolso. Esta é a prática, vista em guias de consumidor e reclamações, não uma pesquisa com números.
- **A queixa forte é de aviso, não da queda.** Na polêmica das vendas do Oasis, o que os grupos de consumidores atacaram foi o aviso tardio do preço dinâmico, não a variação em si. O relatório do Consumer Scotland diz que o preço dinâmico não é ilegal por si só, mas o preço final precisa ser comunicado com clareza e a tempo. Isso reforça o ⓘ que fizemos.
- **No varejo existe a "garantia de preço".** Estudos acadêmicos (Cohen-Vernik e Pazgal, 2017) indicam que devolver a diferença dentro de uma janela curta pode **aumentar** o lucro. Kukar-Kinney (2005) achou que o pedido de devolução da diferença é mais frequente **na hora da compra** do que depois (amostra de estudantes, vale com cautela). Não achei estudo que meça aumento de devolução ou de arrependimento por queda de preço.
- **Chargeback tem teto.** A Visa monitora a razão de disputas: 1,5% para comerciantes (na América Latina desde junho de 2025, segundo a Solidgate), com um piso de volume. O contrato do adquirente pode ser mais rígido. Não achei regra específica para ingressos.

## 2. O que é diferente no Brasil

O artigo 49 do CDC dá 7 dias de arrependimento em compra à distância. Para ingresso com data marcada há divergência, mas o Idec defende que vale, um julgado do TJDFT aplicou, e o Procon-MPMG multou a Sympla em R$ 210 mil por reter a taxa de conveniência em desistência dentro do prazo. Então o risco aqui não é só o chargeback: é o **"cancelar e comprar de novo mais barato"** dentro de 7 dias, que a lei provavelmente permite. A decisão sobre isso é do advogado.

## 3. A nossa exposição, pelas regras do motor

Passos de 10 pontos, no mínimo a cada 6 h, piso −20%, teto +30%, e nas últimas 48 h só baixa. Quanto o comprador "perde" ao ver o preço depois:

| Comprou a | Pode ver depois | Diferença |
|---|---|---|
| +30% | −20% | 38,5% mais barato (pior caso) |
| +20% | −10% | 25% |
| +10% | base | 9,1% |
| base | −10% | 10% |

Os passos são pequenos de propósito: uma queda típica é de uma casa (9% a 10%), e o pior caso leva pelo menos 30 horas para acontecer.

## 4. Modelo simples (taxas são suposições)

Para cada 100 compras: **e** parte que comprou antes de uma queda, **a** parte dessas que percebe, **c** parte das que percebem que pede o dinheiro de volta, **p** parte dos pedidos recusados que vira chargeback, **d** queda média.

| Cenário | e | a | c | p | d | Pedidos por 100 compras | Chargebacks por 100 compras | Custo se devolver só a quem pede | Custo se devolver a todos |
|---|---|---|---|---|---|---|---|---|---|
| Baixo | 10% | 5% | 5% | 5% | 10% | 0,03 | 0,001 | ~0% da receita | 1,0% |
| Médio | 25% | 15% | 15% | 15% | 12% | 0,56 | 0,08 | 0,07% | 3,0% |
| Alto | 40% | 30% | 30% | 30% | 18% | 3,6 | 1,1 | 0,65% | 7,2% |

**Leitura:** no cenário médio o efeito é pequeno. No alto, o chargeback chega a 1,1 por 100 compras, perto do limite de 1,5% da Visa depois de somar o que já existe sem preço dinâmico (não medimos esse número). A parte que mais pesa é **p**: o chargeback nasce da recusa, e reembolso fácil custa bem menos que disputa.

**Linha de base nossa:** o banco tem 937 pedidos pagos e 0 reembolsados, mas é quase tudo histórico importado, que não registra reembolso. Então **não** serve como taxa real de reembolso. Só a venda de verdade vai medir.

## 5. O que reduz o risco

1. **Reembolso fácil e dentro do prazo legal** (já temos por e-mail e pela página). Quem consegue reembolso não abre disputa.
2. **Descidas mais devagar:** no máximo uma queda por setor a cada 24 h (hoje o piso é de 6 h) deixa o "cancelar e recomprar" menos atraente.
3. **O ⓘ e o preço travado na reserva** (feitos) cortam a reclamação de aviso.
4. **Registrar o motivo de cada reembolso e de cada chargeback**, para ligar a queixa ao fator do setor no momento da compra.
5. **Um freio automático:** pausar o preço dinâmico de um evento quando a razão de reembolso ou disputa passar de um limite que o dono escolher.
6. **Garantia de preço só para quem pedir** (devolver a diferença dentro de 7 dias): no cenário médio custa ~0,07% da receita, contra ~3% se devolvêssemos a todos. É decisão de produto e de advogado.

## 6. Fontes

- Consumer Scotland, relatório sobre preço dinâmico (out/2024): https://consumer.scot/media/anslxeui/dynamic-pricing-a-consumer-scotland-insight-report-october-2024.pdf
- Which?, preço dinâmico: https://www.which.co.uk/news/article/dynamic-pricing-how-does-it-work-is-it-legal-aJJzK5F74ZP8
- Cohen-Vernik e Pazgal (2017), Journal of Retailing: https://econpapers.repec.org/RePEc:eee:jouret:v:93:y:2017:i:4:p:507-526
- Kukar-Kinney (2005), pedidos de devolução da diferença: https://www.emerald.com/insight/content/doi/10.1108/10610420510601067/full/html
- Visa VAMP, limites: https://support.checkout.com/hc/en-us/articles/23330844282514 e https://docs.solidgate.com/risks/monitoring-programs/visa/
- Idec, direitos na compra de ingresso: https://idec.org.br/dicas-e-direitos/vai-comprar-ingresso-pela-internet-saiba-quais-sao-seus-direitos
- Procon-MPMG x Sympla (taxa de conveniência): https://www.mpmg.mp.br/data/files/21/95/05/46/AEE9C9103E1129C9B9A8F9C2/Dec%20Adm_CDC_Retencao%20da%20taxa%20de%20conveniencia_anonymous.pdf
