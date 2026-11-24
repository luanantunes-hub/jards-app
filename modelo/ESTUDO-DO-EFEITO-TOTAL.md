# Estudo do efeito total do anúncio

Com boca a boca e urgência, o anúncio vende mais do que o modelo mostra para cada canal: quem ele traz traz outros, e a sala que enche faz o resto comprar mais rápido. O modelo separa
essas vendas em "boca" e "urgencia" (ESTUDO-DO-BOCA-A-BOCA.md, ESTUDO-DA-URGENCIA.md), e por isso a parte de cada canal é só o efeito DIRETO. A pergunta (do dono, 23/11/2026): dá para
medir o efeito TOTAL do anúncio?

A conta (`total_estimado` em `estudo_do_efeito_total.py`): para cada canal, tira da venda de cada semana o que o canal vendeu (`por_semana`, que o modelo agora devolve), refaz a parte
vendida de cada sessão sem isso e soma o que o boca a boca e a urgência deixariam de vender, com a força que o modelo mediu (`efeito_por_unidade`), semana após semana. No Jards a conta usa as
sessões de verdade; aqui, os blocos de 13 semanas de `dados_sinteticos.py`. A verdade vem do contrafactual: o mesmo mundo, com o mesmo sorteio, sem o canal.

## Erro médio de cada canal contra o efeito total verdadeiro (pontos percentuais)

| mundo | semente | direto (a tela de hoje) | total pela conta |
|---|---|---|---|
| sala grande, boca a boca e urgência | 7 | 5,36 | 2,08 |
| sala grande, boca a boca e urgência | 11 | 6,31 | 3,97 |
| sala grande, boca a boca e urgência | 21 | 7,16 | 4,27 |
| sala que lota, boca a boca e urgência | 7 | 3,94 | 1,91 |
| sala que lota, boca a boca e urgência | 11 | 4,94 | 3,91 |
| sala que lota, boca a boca e urgência | 21 | 5,69 | 3,89 |
| sem boca a boca nem urgência | 7 | 2,43 | 2,14 |
| sem boca a boca nem urgência | 11 | 4,21 | 4,11 |
| sem boca a boca nem urgência | 21 | 4,63 | 4,28 |

## O que sai daqui

- **Com boca a boca e urgência, a conta chega bem mais perto:** o erro médio cai de 5,6 para 3,3 pontos. No Meta da semente 7 (sala grande), a verdade é 36,4%, o direto
  25,5% e o total pela conta 32,2%.
- **Sem boca a boca nem urgência, não atrapalha:** o erro fica igual ou um pouco menor (o modelo mede pouco boca a boca onde não há, e a conta soma pouco).
- **Ainda fica abaixo da verdade:** a soma dos canais pela conta fica de 4 a 14 pontos abaixo do total verdadeiro. Boa parte disso é a tendência do modelo de subestimar os canais,
  que já aparece sem boca a boca (soma direta de 42% a 49% contra 56% de verdade). A conta resolve a parte do boca a boca e da urgência, não essa.
- **Recomendação:** a tela mostra o canal "sozinho" e "no total", e o custo por ingresso e o "onde vale investir mais" passam a usar o total.
