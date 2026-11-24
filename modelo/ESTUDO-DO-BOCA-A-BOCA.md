# Estudo do boca a boca no modelo

Jørgensen, Kort e Zaccour (Automatica, 2006), a partir de Bass (1969): quem já comprou um ingresso conta para quem não sabe, e o evento vende também pelo que já vendeu. A pergunta
aqui: o nosso modelo erra os canais quando há boca a boca, e um controle "boca" mede o boca a boca sem inventá-lo onde ele não existe?

Script: `estudo_do_boca_a_boca.py`, com dados inventados de `dados_sinteticos.py` (`boca_a_boca`: cada evento é um bloco de 13 semanas e vende a mais, por semana,
força × vendidos até a semana passada × (1 − parte do público que já comprou)). O controle "boca" é o que o Jards consegue calcular: z(1 − z), com z = a parte dos lugares do
evento já vendida antes da semana. São 104 semanas, 3 sementes e 3 forças de boca a boca: 0 (não existe), 0,03 (12% das vendas) e 0,06 (22% das vendas).

A verdade de cada canal sai de dois jeitos: **direta** (o que o anúncio vende sozinho) e **total** (somando o boca a boca que as vendas do anúncio puxam depois, medida pelo
contrafactual: o mesmo mundo, com o mesmo sorteio, sem o canal).

## Erro médio de cada canal (pontos percentuais, contra a verdade direta)

| boca a boca | semente | sem o controle | com o controle |
|---|---|---|---|
| 0 | 7 | 2,40 | 2,35 |
| 0 | 11 | 4,24 | 4,29 |
| 0 | 21 | 4,46 | 4,57 |
| 12% | 7 | 2,26 | 2,19 |
| 12% | 11 | 3,82 | 3,77 |
| 12% | 21 | 4,19 | 3,91 |
| 22% | 7 | 2,94 | 1,89 |
| 22% | 11 | 3,74 | 3,41 |
| 22% | 21 | 4,76 | 3,63 |

## Quanto o modelo mede de boca a boca (parte das vendas, com o intervalo de 80%)

| verdade | semente 7 | semente 11 | semente 21 |
|---|---|---|---|
| 0% | 0,0% [−1,8; 1,7] | −2,5% [−4,1; −0,8] | 3,0% [1,1; 4,8] |
| 12% | 11,9% [10,3; 13,4] | 9,6% [8,1; 11,0] | 14,1% [12,5; 15,5] |
| 22% | 21,9% [20,6; 23,2] | 19,8% [18,6; 21,0] | 23,6% [22,4; 24,9] |

## A proximidade da data leva a culpa

Sem o controle, o modelo põe o boca a boca na conta da **proximidade da data**: ela sobe de cerca de 6,5% das vendas (sem boca a boca) para 12,5% (boca a boca de 12%) e 17,6% (de 22%).
Com o controle, a proximidade volta para 4% a 7%. Isso importa fora do modelo: o calendário de divulgação usa a proximidade para concentrar o gasto perto da data. Com boca a boca na
conta da proximidade, ele empurraria o dinheiro para o fim, que é o contrário do que o boca a boca pede (anunciar cedo, para quem compra cedo contar aos outros).

## O que sai daqui

- **O controle mede o boca a boca bem:** fica a até 2,4 pontos da verdade nas seis rodadas com boca a boca.
- **Sem boca a boca, ele quase não inventa:** 0%, −2,5% e +3,0%. Duas das três rodadas saem com intervalo fora do zero, então a tela só pode dizer que o boca a boca "faz
  diferença" acima de um limite (5% das vendas, por exemplo), como fizemos com as férias.
- **Os canais melhoram quando o boca a boca é forte** (com 22% das vendas, o erro cai de 2,9–4,8 para 1,9–3,6 pontos) e não pioram quando ele não existe.
- **Nenhuma das duas versões mede o efeito total do anúncio.** O modelo mede o que o anúncio vende sozinho. Com boca a boca, o anúncio vende de 5 a 8 pontos a mais no total,
  porque quem ele trouxe traz outros. Isso pede uma conta à parte (simular a venda com e sem o anúncio usando a força do boca a boca medida), que fica para depois.
- **No mundo real, o controle é calculável:** por semana, a média, ponderada pelos lugares, de z(1 − z) dos eventos à venda (z = parte vendida antes da semana).
- **A urgência** (Jørgensen e Zaccour, 2019: "restam poucos lugares" faz comprar mais rápido) também é "venda puxa venda", mas cresce até esgotar em vez de sumir no fim. Ainda
  não foi testada: falta ver se o modelo separa os dois.
