# Estudo do corte: com quantas semanas dá para confiar no modelo?

Roda o modelo completo (`mmm.py`) em dados inventados de resposta verdadeira conhecida (`dados_sinteticos.py`, com proximidade da sessão, feriados, lote, cupom e visitas) e mede o erro. Script: `estudo_de_corte.py`
(`python estudo_de_corte.py <pasta> <semente-inicial> <quantas> [semanas] [variações]`). 72 rodadas: 30, 45, 58, 80 e 104 semanas, gasto que varia muito ("alta") ou pouco ("baixa").

| semanas | variação | rodadas | erro médio por canal (pontos) | melhor canal certo | pares de canais na ordem certa | ajuste fechou limpo | margem x3 cobre a verdade |
|---|---|---|---|---|---|---|---|
| 30 | alta | 4 | 9,0 | 0% | 16% | 0% | 100% |
| 45 | alta | 4 | 8,2 | 0% | 8% | 0% | 94% |
| 58 | alta | 20 | 6,4 | 25% | 60% | 65% | 92% |
| 80 | alta | 4 | 6,0 | 50% | 58% | 100% | 94% |
| 104 | alta | 20 | 5,2 | 60% | 70% | 100% | 88% |
| 58 a 104 | baixa | 4 por célula | 7 a 10 | 25% a 50% | 33% a 50% | 0% | 100% |

Sortear o melhor entre 3 canais acerta 33%. O que sai daqui:

- **Abaixo de 52 semanas o modelo não serve** (erro de 8 a 9 pontos, ajuste sem fechar, ordem dos canais pior que sorteio): confiança **baixa**.
- **Gasto que varia pouco** deixou o ajuste instável em todas as rodadas: com algum canal assim, **no máximo média**.
- **De 52 a 103 semanas** o tamanho de cada canal fica em torno de 6 pontos de erro, mas qual canal rende mais ainda é incerto (25% de acerto com 58 semanas): confiança **média**, sem apontar canal.
- **104 semanas ou mais**, gasto variando e ajuste limpo: **boa**. Mesmo assim o melhor canal sai certo só em 60% das vezes: a tela fala "o modelo aponta" e pede um experimento pequeno para confirmar.
- O intervalo de 80% do cálculo cobre a verdade em 34% a 39% das vezes (alta variação, 58 e 104 semanas); com a margem multiplicada por 3 (`FATOR_DE_CAUTELA`) cobre cerca de 90%.

## O modelo simples (não adotado)

`simples.py` é uma regressão com efeito atrasado fixo e sem saturação, para pouco histórico. `estudo_simples.py` roda o mesmo estudo com 240 rodadas: acertou o melhor canal em 10% a 45% das vezes (sorteio: 33%) e atribuiu
cerca de 30 pontos a menos aos anúncios. Uma variante em diferenças semana a semana ficou igualmente perto do acaso. Não entra no produto: para pouco histórico o plano B é medir (custo por ingresso das ações) e sugerir
um experimento pequeno e seguro. Fica no repositório como registro do resultado negativo.

## Limites

Dados inventados, com três canais e uma estrutura única: o corte é uma orientação, não uma garantia, e deve ser refeito quando houver dado real.
