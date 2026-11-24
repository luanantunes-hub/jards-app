# Estudo da sazonalidade: curva da casa e férias escolares

Telas 46 a 48 (aprovadas em 23/11/2026). Rodado com o modelo completo (`mmm.py`, PyMC-Marketing 1.5) em dados inventados de resposta conhecida (`dados_sinteticos.py`), 104 semanas.

## Férias escolares: a data que pode importar (`teste_sintetico.py`)

As férias entram para todo mundo com 52 semanas ou mais, mas com o efeito começando em zero (prior Normal(0; 0,1) na escala do modelo, contra Normal(0; 2) dos outros controles).

| mundo | parte das férias estimada | verdade | efeito nas semanas de férias |
|---|---|---|---|
| férias não mexem nas vendas | 0,08% (−0,14 a 0,32) | 0% | +0,4% → a tela diz "Não faz diferença" |
| férias trazem 25 ingressos por semana | 3,99% (3,78 a 4,20) | 3,9% | +20% → "As semanas de férias venderam 20% mais" |

Os canais ficaram dentro da tolerância nos dois mundos: pôr as férias para todo mundo não estragou a medida dos anúncios.

## Curva da casa no lugar da rampa (`estudo_da_curva.py`)

A venda de verdade concentrada perto da data (35% na semana da sessão, 22% uma semana antes: a curva da tela 47). Mesmos dados, o modelo rodado com a rampa padrão e com a curva da casa.

| semente | parte da proximidade com a rampa | com a curva da casa | verdade | erro médio dos canais (rampa x curva) |
|---|---|---|---|---|
| 7 | 5,10% | 4,04% | 3,94% | 2,2 x 2,3 pontos |
| 11 | 5,01% | 3,96% | 3,83% | 3,9 x 4,2 pontos |
| 21 | 4,75% | 3,67% | 3,81% | 4,9 x 4,6 pontos |

Com a curva da casa a parte da proximidade fica a 0,1 ponto da verdade (com a rampa, a 1 a 1,2 ponto). A medida dos canais quase não muda: neste mundo a proximidade é pequena perto dos anúncios. A rampa fica como reserva até a casa ter 3 eventos com 20+ ingressos.

## O que fica de alerta

- Com a marca (atraso de até 13 semanas), uma das três sementes não fechou o ajuste (r-hat 1,08, 95 divergências); as outras duas fecharam limpo, mas a parte da marca variou de 4,3% a 8,6% para uma verdade de 10,1% (dentro da tolerância de 12 pontos, mas tende a ficar abaixo). A tela já trata ajuste que não fecha como confiança baixa. Se isso se repetir com dados reais, rever o prior da marca.
- O calendário de férias é aproximado e igual no país (julho; de 20/12 a 31/1). O calendário de cada estado fica para depois.
