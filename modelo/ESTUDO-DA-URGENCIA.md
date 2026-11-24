# Estudo da urgência: o modelo separa urgência e boca a boca?

Jørgensen e Zaccour (Journal of Economic Dynamics & Control, 2019): "restam poucos lugares" faz comprar mais rápido. É "venda puxa venda", como o boca a boca
(ESTUDO-DO-BOCA-A-BOCA.md), mas tem outro formato: o boca a boca é mais forte no meio da venda e some quando o público acaba; a urgência cresce até esgotar.

Script: `estudo_da_urgencia.py`, com dados inventados de `dados_sinteticos.py` (`urgencia`: força × z ingressos a mais por semana, z = parte dos lugares já vendida).
Dois tamanhos de sala: uma **grande** (os eventos vendem até metade dos lugares; aí z e z(1 − z) andam quase juntos, correlação de 0,98) e uma que **lota** (vende de 85% a 95%;
correlação de 0,4 a 0,6). Em cada uma, três mundos (só boca a boca, só urgência, os dois), três sementes e dois modelos: só o controle "boca" (z(1 − z)) e os dois controles
("boca" e "urgencia" = z).

## Quanto o modelo mede (parte das vendas; verdade entre parênteses)

| sala | mundo | só "boca": boca | os dois controles: boca | os dois controles: urgência |
|---|---|---|---|---|
| grande | só boca a boca (12%) | 9,6 a 14,0 | 7,2 a 12,8 | 2,6 a 4,4 (0), intervalo pega o zero |
| grande | só urgência (11%) | 3,7 a 8,3 (0) | −4,7 a 1,6 (0) | 12,8 a 15,3 |
| grande | os dois (11% + 11%) | 13,5 a 17,2 (soma 22) | 7,7 a 12,1 | 12,5 a 13,3 |
| lota | só boca a boca (7%) | 6,1 a 8,4 | 5,7 a 7,6 | 1,5 a 3,4 (0), intervalo pega o zero |
| lota | só urgência (11%) | 0,8 a 2,9 (0) | −1,4 a 0,4 (0) | 12,2 a 14,2 |
| lota | os dois (6% + 11%) | 6,8 a 8,3 (soma 17) | 5,0 a 6,4 | 12,2 a 14,3 |

## O que sai daqui

- **Com os dois controles, o modelo separa os dois**, até na sala grande, onde se esperava que não desse. O boca a boca fica a até 3 pontos da verdade e a urgência a até
  4 pontos (ela sai um pouco acima: 1 a 4 pontos a mais).
- **Só com o controle do boca a boca, a urgência some**: o modelo põe parte dela no boca a boca e o resto na **proximidade da data**, que sobe para 9% a 14% (a verdade é perto de
  5%). É o mesmo erro do estudo anterior: sem medir, o calendário empurraria o gasto para o fim por um motivo que não é a data.
- **Onde não existe, a urgência quase não aparece** (1,5% a 4,4%, sempre com intervalo que pega o zero). O boca a boca chegou a sair −4,7% numa semente sem boca a boca. A tela só
  pode dizer "faz diferença" com a parte acima de uns 5% e o intervalo fora do zero.
- **Custo nos canais:** com os dois controles, o erro dos canais fica igual em dois terços das rodadas e piora até 0,6 ponto no resto. É o preço de medir duas coisas a mais;
  pequeno perto do ganho na proximidade.
- **Recomendação:** os dois controles entram juntos no modelo, com a regra dos 5% para aparecer na tela. O efeito total do anúncio (com o boca a boca que ele puxa) segue para depois.
