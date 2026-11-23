# Estudo da proximidade: e se o anúncio rende mais perto da data?

O modelo (`mmm.py`) supõe que um real de anúncio rende o mesmo em qualquer semana. Kang (International Journal of Market Research, 2019), com dados de 54 eventos de um centro de artes,
encontrou outra coisa: o anúncio multiplica a vontade de comprar que já existe, e ela cresce perto da sessão, então o mesmo real rende mais no fim. Se for assim, o calendário de divulgação
(`lib/ticketeria/modelo-calendario.ts`) pode estar adiantando demais o gasto.

Script: `npx tsx modelo/estudo_da_proximidade.ts` (grava `estudo_da_proximidade.csv`). Roda em 2 segundos, sem o modelo bayesiano: é uma conta de mundos inventados.

## Como foi feito

- Os três canais de `dados_sinteticos.py` (tamanho, atraso e saturação conhecidos), com o calendário montado a partir das curvas **verdadeiras**: é o melhor caso (o modelo acertou tudo), então
  a perda medida é só a da suposição "rende igual toda semana".
- Num mundo de força **k**, a venda que o anúncio traz na semana é a da curva vezes `1 + k × proximidade` (a mesma proximidade do modelo: 1 na semana da sessão, caindo até 0 oito semanas
  antes), normalizado para a média ser 1. k = 0 é o mundo que o modelo supõe; k = 4 é algo como o que Kang encontrou.
- Dois tipos de canal: **saturação forte** (o dos dados inventados: rende bem menos a partir de um gasto parecido com o que se gasta) e **quase reta** (rende quase igual mesmo gastando muito).
- 4 durações (4, 6, 8 e 12 semanas até a sessão) × 3 orçamentos semanais (R$ 300, R$ 700 e R$ 1.500) = 12 cenários por mundo.
- Comparados com o **melhor calendário possível** em cada mundo: o calendário puro (sem prudência), o calendário com prudência (o do produto), igual toda semana e tudo nas 2 últimas semanas.

## Resultado (perda em % dos ingressos do melhor calendário possível)

| mundo | calendário puro: média | puro: pior | **com prudência 0,5: média** | **com prudência: pior** | igual toda semana | tudo nas 2 últimas |
|---|---|---|---|---|---|---|
| saturação forte, k = 0 | 0,0% | 0,0% | 0,2% | 1,0% | 0,9% | 66% |
| saturação forte, k = 1 | 0,1% | 0,8% | 0,0% | 0,4% | 0,5% | 61% |
| saturação forte, k = 4 | 0,5% | 4,3% | 0,3% | 2,4% | 0,4% | 57% |
| quase reta, k = 0 | 0,0% | 0,3% | 2,5% | 9,5% | 6,0% | 56% |
| quase reta, k = 1 | 1,7% | 14,0% | 0,1% | 1,6% | 4,0% | 49% |
| quase reta, k = 2 | 3,2% | 25,1% | −0,2% | 1,9% | 3,8% | 46% |
| quase reta, k = 4 | 5,3% | 35,3% | 0,4% | 4,5% | 4,5% | 43% |

Também testados: prudência 1 (pior caso 10,4%) e 2 (pior caso 15,0%). A 0,5 teve o menor pior caso.

## O que sai daqui

- **Com canais que saturam (o caso comum), a suposição quase não importa:** o calendário puro perde no máximo 4%, mesmo num mundo forte como o de Kang.
- **Com canais que quase não saturam e efeito forte perto da data, o calendário puro pode perder muito** (até 35% num cenário): ele põe dinheiro cedo demais.
- **A prudência resolve a um custo baixo.** Montar o calendário como se o anúncio rendesse um pouco mais perto da data (`PRUDENCIA_DA_PROXIMIDADE = 0,5`) custa em média de 0% a 2,5% se o modelo
  estiver certo e corta o pior caso de 35% para menos de 10%. **Adotado no produto:** só a escolha do calendário usa a prudência; as previsões na tela continuam as do modelo, e a tela diz isso.
- **Tudo no fim é ruim em qualquer mundo** (perde de 43% a 66%): o dinheiro concentrado em poucas semanas satura. A tela mostrar isso ao produtor é o recado mais útil do calendário.
- **Igual toda semana é um plano B seguro** (perde no máximo 6%): bom conselho para quem ainda não tem o modelo.

## Limites

- Os mundos são inventados, e k não foi medido em nenhum dado real. Medir k de verdade pede pôr no modelo um termo "anúncio × proximidade" e rodar o estudo do corte com ele (o modelo
  bayesiano, minutos por rodada). Só vale a pena quando houver lojas reais com 104+ semanas.
- O calendário com as curvas verdadeiras é o melhor caso: na prática o modelo também erra as curvas (ver `ESTUDO-DO-CORTE.md`), e isso soma a esta perda.
