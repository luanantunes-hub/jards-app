# Estudo da lotação: sessões esgotadas no modelo

Putler & Lele (Marketing Letters, 2003): quando a sessão esgota, a venda bate no teto da sala e esconde a procura. Eles trataram isso com um modelo "tobit" (venda censurada). A pergunta
aqui: o nosso modelo subestima o anúncio quando as sessões esgotam, e dá para corrigir?

Script: `estudo_da_lotacao.py` (dados inventados de `dados_sinteticos.py` com `lotacao`: um quarto das semanas tem a procura acima do teto). 104 semanas, 3 sementes, erro médio de
cada canal em pontos percentuais contra a verdade.

| semente | sem teto (o melhor possível) | com teto, modelo como está | com teto e a coluna "esgotou" como controle |
|---|---|---|---|
| 7 | 3,60 | 4,58 | 4,59 |
| 11 | 4,71 | 4,97 | 4,54 |
| 21 | 2,98 | 3,35 | 3,45 |

## O que sai daqui

- **O teto piora um pouco a medida** (de 0,3 a 1 ponto a mais de erro, com um quarto das semanas esgotadas).
- **Pôr "esgotou" como controle não resolve** (ajudou numa semente e piorou nas outras): não entrou no modelo.
- **O jeito certo é a venda censurada** ("nas semanas esgotadas a procura foi pelo menos isso"). O PyMC-Marketing 1.5 tem `Censored`, mas não aceita um teto diferente por semana na
  verossimilhança do MMM (pede um número só, e o teto por semana esbarra nas dimensões do modelo). Fica para uma versão da biblioteca que aceite, ou para um modelo próprio em PyMC.
- **O que entrou no produto:** o calendário não planeja vender mais do que os lugares que faltam, e os avisos de anúncio gastando com o evento esgotado (aba Ações e gasto e sino).
  Isso não depende do modelo e resolve o desperdício, que é o efeito prático mais caro.
