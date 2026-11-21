# Ticketeria: estoque único (a meia-entrada não reserva lugar)

Desenho no papel, 21/11/2026. **Sem código e sem migration.** Nasceu de uma pergunta do Luan sobre o Começar: "Não tem que reservar lugar para meia-entrada, né?". Não tem. Hoje o sistema reserva.

## O problema

Cada tipo de ingresso (Inteira, Meia-entrada, Social…) tem **lotes com uma quantidade própria por sessão**, e o banco exige que a **soma** dessas quantidades caiba nos lugares do setor (`lugares_excedidos`, `fn_ticketeria_conferir_lugares`). Na venda, `fn_ticketeria_reservar` conta o que cada lote já vendeu (`fn_ticketeria_ocupados`) e só deixa vender o que sobra **naquele lote**.

Resultado: num teatro de 58 lugares o Começar cria Inteira = 35 e Meia = 23 (`fn_ticketeria_comecar_pracas`, 40% de meia). Quando as 35 inteiras esgotam, a venda de inteira para, mesmo que ninguém tenha comprado meia. Os 23 lugares ficam vazios, e o produtor perde dinheiro sem ter feito nada errado. O mesmo vale para qualquer divisão (social, VIP, convênio).

O que a lei pede é outra coisa: a Lei 12.933/2013 **limita** a meia-entrada a 40% dos ingressos de cada evento. É um teto, não uma reserva. (Confirmar a leitura exata com quem entende da lei antes de endurecer a regra.)

## O desenho

**O setor passa a ser o estoque.** Os lugares do setor (no setor numerado, os lugares do mapa sem os bloqueados) são um balde só por sessão. Todo ingresso do setor tira desse balde: inteira, meia, social, cortesia, o que vier.

Três regras, nesta ordem:

1. **Balde.** Numa sessão, o total ocupado (pago ou reservado e não vencido) em todos os ingressos do setor, mais o que está sendo pedido, nunca passa dos lugares do setor.
2. **Teto do lote.** A quantidade do lote continua existindo, mas passa a significar "até quantos deste lote", não "quantos lugares ficam separados para ele". No Começar, inteira e meia nascem com todos os lugares. Isso mantém a ordem de lotes (1º lote esgota, abre o 2º) como é hoje.
3. **Gravação.** O banco para de exigir que a soma dos lotes caiba no setor. Passa a exigir só que cada lote, sozinho, caiba (um lote nunca passa dos lugares do setor).

O comprador não vê mudança: continua escolhendo Inteira ou Meia e pagando o preço de cada uma. A diferença é que a inteira só esgota quando o teatro lota de verdade.

### Sem limite de meia (decisão do Luan, 21/11/2026)

O produto não limita a meia-entrada: ela vende os mesmos lugares que a inteira, e quem comprar primeiro leva. Não há teto de 40%, nem aviso, nem reserva. A quantidade do lote continua existindo para quem quiser limitar um tipo de ingresso (um lote de promoção, por exemplo), mas o Começar não limita nenhum.

### O que não muda

- Lugares numerados: o lugar continua sendo único por sessão (`lugar_ocupado`), qualquer que seja o tipo do ingresso. O balde e o mapa dizem a mesma coisa.
- Reembolso, cortesia, porta e bilheteria: já passam pela mesma reserva, então herdam a regra sem mexer neles. Reembolso devolve o lugar ao balde porque só pago e reservado vigente contam.
- Preço, taxa, cupom e lista de espera de cada tipo.

## O que muda no sistema

| Peça | Hoje | Depois |
|---|---|---|
| `fn_ticketeria_reservar` (e as duas que a embrulham: com cupom, com lugares) | confere só o lote | trava o setor e confere o balde, depois confere o lote |
| `fn_ticketeria_livres` (vitrine, lista de espera) | soma o que sobra nos lotes | o menor entre isso e o que sobra no balde |
| `fn_ticketeria_conferir_lugares` e os dois gatilhos | soma dos lotes ≤ lugares | cada lote ≤ lugares |
| `fn_ticketeria_comecar` / `_pracas` (Começar) | Inteira = 60%, Meia = 40% | Inteira e Meia com todos os lugares |
| `catalogo.ts` (`ofertaNoSetor`) e a tela do catálogo | "ofertados" e "sobram" somando lotes | mostra o setor, o teto de cada tipo e quanto já foi vendido |
| Início, vitrine, modelo (MMM), análise do MCP | alguns usam a soma dos lotes como capacidade | **a conferir**: devem usar os lugares do setor |
| Histórico importado | grava lotes com a quantidade vendida | **a conferir** contra a nova regra de gravação |

Cuidado principal: a trava. Hoje a venda trava cada lote. Com o balde, ela precisa travar o setor (uma ordem fixa: setor primeiro, lotes depois) para duas compras ao mesmo tempo, de tipos diferentes, não passarem do total juntas. Vale prova com compras simultâneas.

## Eventos que já existem

Nada é migrado. As quantidades antigas passam a valer como tetos, e a soma delas continua dentro do setor, então tudo segue funcionando como antes. Quem quiser liberar os lugares parados só sobe a quantidade da Inteira. Se o Luan preferir, um botão "liberar o estoque" faz isso por evento.

## Alternativa descartada por enquanto: meia como variação do mesmo ingresso

Um ingresso só, com a meia como "variação de preço" escolhida na compra, com o estoque no lote. É o jeito mais fiel a "se ele clicar, paga meio", mas mexe no pedido, no cupom, no reembolso, nos relatórios por categoria e na vitrine. É mais caro e mais arriscado. O desenho acima chega ao mesmo resultado para o produtor e o comprador com bem menos mudança. Dá para evoluir para essa variação depois, sem desfazer nada.

## Decisões do Luan (21/11/2026)

1. **Limite de meia:** não há. Nem o Começar, nem o catálogo, nem o banco limitam ou avisam sobre 40%. (A lei 12.933/2013 fala em 40%; o Luan decidiu que o produto não trata disso.)
2. **Social, VIP e convênio:** dividem o mesmo balde.
3. **Eventos que já existem:** ficam como estão, sem botão nem migração.
4. **Começar:** a pergunta da meia fica; sim = uma Meia com todos os lugares e metade do preço.

## Feito (21/11/2026)

- Migration `20261127100300_ticketeria_estoque_unico.sql`, aplicada: a conta do balde (`fn_ticketeria_ocupados_do_setor`), a reserva (trava o setor e confere o balde), o pagamento depois do prazo, `fn_ticketeria_livres` e a regra de gravação (cada lote cabe nos lugares).
- Migration `20261127100400_ticketeria_comecar_meia_sem_limite.sql`, aplicada: o Começar cria a Meia com todos os lugares (a versão anterior usava 40%) e sem o mínimo de 3 lugares.
- pgTAP `ticketeria_estoque_unico.test.sql`, 24 verificações: inteira e meia dividindo o balde, o lote pequeno de uma meia, a inteira vendendo o resto, dois tipos no mesmo pedido, reserva vencida, pagamento tardio e quem pode chamar. As suítes antigas seguiram verdes (catálogo, Começar em várias praças, pagamentos, assentos, lista de espera, porta e reembolsos); duas verificações antigas do catálogo mudaram de propósito (a soma dos lotes não é mais exigida; e `fn_ticketeria_conferir_lugares` é chamável por quem edita, desde a migration do editor de mapa).
- App: a vitrine limita o que se compra ao balde de todo setor (antes só do numerado); o catálogo mostra "N lugares para todos os ingressos"; a tela final do Começar mostra o preço da inteira e da meia e os lugares, sem número por tipo.
- Não conferido: compras simultâneas de verdade (o desenho trava o setor antes dos lotes, mas só foi provado em sequência), e os efeitos nas telas de início e do modelo, que já usavam os lugares do setor como capacidade.
