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

## 6. Modelo v2: o que a literatura acrescenta (22/11/2026)

O modelo das seções 3 e 4 mede **só um canal**, o vazamento (devolução e disputa). Os estudos que o dono pediu para incorporar apontam mais três. O saldo do preço dinâmico para o produtor, por setor, passa a ser:

> **Saldo = G − V − E − R**, em % da receita do setor.

| Canal | O que é | O que a literatura diz | Número público |
|---|---|---|---|
| **G** (ganho) | Receita a mais do que com preço único | Courty e Pagliero (2012): ~5% por categorias de assento em shows. Sweeting (2012): ~16% no ganho esperado de vendedores de ingresso de beisebol em revenda, com preços 40% ou mais menores perto do jogo | **5% a 16%**, de contextos diferentes |
| **V** (vazamento) | Devolução, cancelamento e chargeback por queda de preço | Sem estudo medido. Cohen-Vernik e Pazgal (2017): devolver a diferença numa janela curta pode aumentar o lucro num modelo teórico | **Nenhum.** Nosso modelo: 0,07% a 3% da receita (seção 4, suposições) |
| **E** (espera) | Compradores que adiam a compra esperando a queda | Su (2007), Aviv e Pazgal (2008), Levin, McGill e Nediak (2009): ignorar esse comportamento pode reduzir a receita seriamente | **Nenhum** para ingressos |
| **R** (recompra perdida) | Quem pagou mais e viu o preço menor compra menos depois | Anderson e Simester (2010): experimento de 28 meses, mais de 50 mil clientes, queda de compras por cerca de 20 meses, maior nos melhores clientes (catálogo, não ingresso) | **Nenhum** para ingressos |

**O que isso muda no modelo**
1. **Compensa enquanto V + E + R < G.** Com G = 5%, o conjunto das três perdas precisa ficar abaixo de 5% da receita; com G = 16%, abaixo de 16%. Como não há número público para E e R em ingressos, o modelo **não os preenche**: eles ficam como incógnitas a medir nas vendas do Jards.
2. **A faixa escolhida define a exposição.** A queda máxima entre o preço mais alto e o piso é conta direta, sem suposição:

| Faixa pronta | Pior queda para quem comprou no teto | Queda de um passo | Passos até o piso | Tempo mínimo até o piso |
|---|---|---|---|---|
| Estreita (−10% a +10%, passo de 5%, 6 h) | 18,2% | 4,5% | 4 | 24 h |
| Intermediária (−20% a +30%, passo de 10%, 6 h) | 38,5% | 7,7% | 5 | 30 h |
| Ampla (−30% a +50%, passo de 10%, 6 h) | 53,3% | 6,7% | 8 | 48 h |

   É uma **hipótese** (não um achado) que faixas mais largas aumentem V e R; nenhum dos estudos testa isso em ingressos.
3. **Regra de últimas 48 h só baixa** pode ensinar o público a esperar (E). É a primeira coisa a medir.

## 7. Como medir, em vez de supor

Ligar o preço dinâmico em alguns setores e sessões e manter preço fixo em outros do mesmo evento ou de eventos parecidos do mesmo produtor. Por grupo: pedidos de reembolso e motivo, chargebacks, **hora da compra em relação à sessão** (espera) e recompra do mesmo comprador em eventos seguintes (recompra perdida). Só com isso as taxas da seção 4 e os canais E e R deixam de ser suposição.

## 8. O que o produtor vê (no produto)

Na folha **Aderir ao preço dinâmico**, antes do aceite: (a) **faixas prontas** (Estreita, Intermediária, Ampla) que só preenchem os campos, sem tirar a liberdade de digitar qualquer valor dentro dos limites; (b) a frase da **exposição da faixa** escolhida, atualizada enquanto ele digita; (c) o bloco **O que a literatura registra**, com três grupos: **Ganho** ("A literatura dá 5% a 16%, de contextos diferentes", sem o contexto de cada estudo), **Riscos registrados** (cada um numa frase curta e exata) e **Associado a menos risco**; cada item com a fonte e o link, em tom neutro, sem recomendar nem desaconselhar. A ausência de estudo público sobre ingressos fica neste documento (seção 6) e **não** aparece ao produtor, por decisão do dono. **Os itens (b) e (c) ficam atrás de um ⓘ ao lado de "Faixas prontas"** (o mesmo gesto do ⓘ do preço ajustado na compra): fechado por padrão, e o produtor abre só se quiser (decisão do dono, 22/11/2026). Código: `lib/ticketeria/preco-dinamico-evidencias.ts` e `components/ticketeria/EvidenciasDoPrecoDinamico.tsx`. O texto do aceite (rascunho para o advogado) não mudou.

**Limite deste levantamento:** os números dos estudos vêm de resumos e páginas dos artigos; os artigos completos, quando pagos, não foram lidos. Revisar este bloco quando houver dado real das vendas.

## 9. Fontes

- Consumer Scotland, relatório sobre preço dinâmico (out/2024): https://consumer.scot/media/anslxeui/dynamic-pricing-a-consumer-scotland-insight-report-october-2024.pdf
- Which?, preço dinâmico: https://www.which.co.uk/news/article/dynamic-pricing-how-does-it-work-is-it-legal-aJJzK5F74ZP8
- Cohen-Vernik e Pazgal (2017), Journal of Retailing: https://econpapers.repec.org/RePEc:eee:jouret:v:93:y:2017:i:4:p:507-526
- Kukar-Kinney (2005), pedidos de devolução da diferença: https://www.emerald.com/insight/content/doi/10.1108/10610420510601067/full/html
- Visa VAMP, limites: https://support.checkout.com/hc/en-us/articles/23330844282514 e https://docs.solidgate.com/risks/monitoring-programs/visa/
- Idec, direitos na compra de ingresso: https://idec.org.br/dicas-e-direitos/vai-comprar-ingresso-pela-internet-saiba-quais-sao-seus-direitos
- Procon-MPMG x Sympla (taxa de conveniência): https://www.mpmg.mp.br/data/files/21/95/05/46/AEE9C9103E1129C9B9A8F9C2/Dec%20Adm_CDC_Retencao%20da%20taxa%20de%20conveniencia_anonymous.pdf
- Anderson e Simester (2010), Price Stickiness and Customer Antagonism, QJE: https://dspace.mit.edu/handle/1721.1/58801
- Courty e Pagliero (2012), Review of Economics and Statistics: https://econpapers.repec.org/RePEc:tpr:restat:v:94:y:2012:i:1:p:359-369
- Sweeting (2012), Journal of Political Economy: https://www.econ.umd.edu/publication/price-dynamics-perishable-goods-markets-case-secondary-markets-major-league-baseball
- Levin, McGill e Nediak (2009), Management Science: https://ideas.repec.org/a/inm/ormnsc/v55y2009i1p32-46.html
- Su (2007), Intertemporal Pricing with Strategic Customer Behavior: https://repository.upenn.edu/oid_papers/153
- Resumo do Cohen-Vernik e Pazgal (2017) pela Rice Business: https://business.rice.edu/wisdom/peer-reviewed-research/how-price-adjusting-eases-consumer-regrets-while-boosting-profit
