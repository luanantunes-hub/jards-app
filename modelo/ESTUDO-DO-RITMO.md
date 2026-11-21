# Estudo do ritmo de venda comparado com eventos parecidos

Script: `estudo_de_ritmo.py` (3.000 tentativas por célula, dados inventados de resposta conhecida: cada evento tem o seu tamanho final e a sua curva de venda; 15% dos "parecidos" não se parecem de verdade e têm
tamanho bem diferente, como um nome maior ou menor). Mede, por número de eventos parecidos e por dias até a sessão: o erro da previsão da lotação final e se a verdade cai dentro da faixa.

## Resultado

| dias até a sessão | erro da previsão por comparação | erro da conta simples (ritmo dos últimos 7 dias) |
|---|---|---|
| 5 | 3% | 4% |
| 10 | 4% | 6% |
| 18 | 6% | 9% |
| 30 | 9% | 13% |
| 45 | 12% | 17% |

O erro é relativo ao tamanho final do evento. Quase não depende do número de parecidos (de 2 a 8); o que muda é a faixa.

| parecidos | verdade entre o mínimo e o máximo dos parecidos | verdade no intervalo de previsão de 80% | idem, com o fator 1,1 | largura do intervalo a 18 dias (fração da lotação) |
|---|---|---|---|---|
| 2 | 36% | 77% | 79% | 0,22 |
| 3 | 53% | 78% | 80% | 0,17 |
| 4 | 62% | 78% | 81% | 0,16 |
| 6 | 72% | 79% | 82% | 0,15 |

## O que isso decide

- A previsão por comparação é **melhor que a conta simples do ritmo**, em todos os pontos (cerca de um terço a menos de erro).
- A faixa **não pode ser "do mínimo ao máximo" dos parecidos**: com 3 parecidos ela cobre a verdade só em metade das vezes. Usa-se um intervalo de previsão de 80% (t de Student sobre o log das projeções), alargado por 1,1 (`FATOR_DA_FAIXA`).
- **1 parecido**: dá uma previsão pontual, mas não há como medir o quanto os eventos variam: sem faixa, selo "muito impreciso". **2 parecidos**: faixa larga (±11% da lotação), "muito impreciso". **3 ou mais**: "impreciso".
- Longe da sessão (30 a 45 dias) o erro é de 9% a 12%: a tela mostra a faixa mais larga e o selo continua "impreciso".

## Limites

Dados inventados com uma única forma de curva e o mesmo tamanho médio entre eventos: em dado real, eventos parecidos variam mais e a faixa pode cobrir menos. O selo nunca passa de "impreciso" até haver dado real. Um evento sem nenhum parecido não tem previsão por comparação (a tela diz isso).

Nota: uma primeira versão deste estudo usava o t de Student com os graus de liberdade errados (um a mais), o que deixava a faixa estreita demais; foi corrigido antes de qualquer uso e os números acima são os corrigidos.
