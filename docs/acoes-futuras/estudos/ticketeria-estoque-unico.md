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
2. **Teto do tipo.** A quantidade do lote continua existindo, mas passa a significar "até quantos deste lote", não "quantos lugares ficam separados para ele". A Meia tem lote de até 40% dos lugares; a Inteira, de até todos os lugares. Isso mantém a ordem de lotes (1º lote esgota, abre o 2º) como é hoje.
3. **Gravação.** O banco para de exigir que a soma dos lotes caiba no setor. Passa a exigir só que cada lote, sozinho, caiba (um lote nunca passa dos lugares do setor).

O comprador não vê mudança: continua escolhendo Inteira ou Meia e pagando o preço de cada uma. A diferença é que a inteira só esgota quando o teatro lota de verdade.

### Teto de 40% da meia

Já nasce do desenho: o lote da Meia é de até 40% dos lugares. O que falta decidir é se o sistema **impede** o produtor de aumentar esse número ou só **avisa** (ver decisões). A conta é por sessão: se cada sessão tem no máximo 40% de meia, o evento inteiro também tem.

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
| `fn_ticketeria_comecar` / `_pracas` (Começar) | Inteira = 60%, Meia = 40% | Inteira = todos os lugares, Meia = até 40% |
| `catalogo.ts` (`ofertaNoSetor`) e a tela do catálogo | "ofertados" e "sobram" somando lotes | mostra o setor, o teto de cada tipo e quanto já foi vendido |
| Início, vitrine, modelo (MMM), análise do MCP | alguns usam a soma dos lotes como capacidade | **a conferir**: devem usar os lugares do setor |
| Histórico importado | grava lotes com a quantidade vendida | **a conferir** contra a nova regra de gravação |

Cuidado principal: a trava. Hoje a venda trava cada lote. Com o balde, ela precisa travar o setor (uma ordem fixa: setor primeiro, lotes depois) para duas compras ao mesmo tempo, de tipos diferentes, não passarem do total juntas. Vale prova com compras simultâneas.

## Eventos que já existem

Nada é migrado. As quantidades antigas passam a valer como tetos, e a soma delas continua dentro do setor, então tudo segue funcionando como antes. Quem quiser liberar os lugares parados só sobe a quantidade da Inteira. Se o Luan preferir, um botão "liberar o estoque" faz isso por evento.

## Alternativa descartada por enquanto: meia como variação do mesmo ingresso

Um ingresso só, com a meia como "variação de preço" escolhida na compra, com o estoque no lote. É o jeito mais fiel a "se ele clicar, paga meio", mas mexe no pedido, no cupom, no reembolso, nos relatórios por categoria e na vitrine. É mais caro e mais arriscado. O desenho acima chega ao mesmo resultado para o produtor e o comprador com bem menos mudança. Dá para evoluir para essa variação depois, sem desfazer nada.

## Decisões do Luan

1. **Teto de meia: impedir ou só avisar?** Impedir protege o produtor de uma multa; avisar dá liberdade (alguns eventos têm regras próprias, como os de entrada social).
2. **Os outros tipos (social, VIP, convênio) também dividem o mesmo balde?** O desenho diz que sim, por padrão.
3. **Eventos que já existem:** deixar como estão (o produtor sobe a Inteira), ou um botão que libera por evento?
4. **Começar:** depois da mudança, volta a pergunta "Tem meia-entrada?" com o significado novo (Inteira com todos os lugares, Meia com teto de 40%)? Ou só a Inteira, e a meia entra depois, no evento? Hoje a pergunta já foi tirada do Começar por esse motivo, só se ela voltar com o sentido certo.

## Como seria a obra (quando aprovado)

1. Migration aditiva (`create or replace` das funções acima, sem DROP e sem mudar assinatura, para não cair no PGRST203): balde na reserva, `livres`, regra de gravação, Começar.
2. pgTAP: duas compras de tipos diferentes até lotar; compras simultâneas; teto da meia; reembolso devolvendo o lugar; setor numerado; lista de espera; evento antigo com lotes já divididos; histórico importado.
3. Telas: catálogo e Começar.

O módulo está escondido dos clientes e nenhuma organização o usa em produção: é a hora mais barata de mexer em estoque.
