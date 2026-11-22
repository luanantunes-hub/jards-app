# Ticketeria: o mapa de assentos mais sofisticado (estudo)

Estudo de 22/11/2026, a pedido do Luan: ver como os bons mapas de assentos funcionam e o que dá para implementar no nosso (blocos, vários corredores, ângulos, fileiras curvas, importar a planta do espaço, modelos de layout). **Nada foi construído.** A parte de fora vem de uma pesquisa na web: onde a fonte é de fornecedor (não de norma), digo; onde não consegui confirmar, digo. Fontes no fim.

## 1. Onde estamos

Hoje o mapa é **uma lista de fileiras de um setor**.

- **O modelo.** Setor → fileiras (A, B, C…) → lugares numerados 1, 2, 3…. No banco: `ticketeria_assentos` (setor, fileira, número, bloqueado) e, no setor, `numerado` e `corredor_no_meio`. Não há posição, ângulo nem curva guardados: a tela só empilha as fileiras, uma abaixo da outra.
- **O corredor.** É um só, no meio: um liga/desliga do setor que abre um vão depois do lugar do meio de cada fileira de 6 lugares ou mais (`vaos` no código). Não dá para pôr outro corredor, nem em outro lugar.
- **O palco.** É um só, fixo no alto.
- **O editor.** "+ Fileira", um lugar a mais ou a menos por fileira, tocar num lugar para bloqueá-lo, e o liga/desliga do corredor. O mesmo desenho serve para o editor, para a compra e para a prévia do Começar.
- **Limites.** 60 fileiras, 80 lugares por fileira, 5.000 por setor. Estados do lugar: livre, ocupado, bloqueado, selecionado.
- **Um mapa por setor.** O comprador vê o mapa do setor do ingresso que escolheu. Um teatro com plateia e balcão tem dois mapas separados, nunca um desenho só da sala.

O que isso não consegue desenhar: plateia em três blocos (esquerda, centro, direita) com dois corredores, fileiras em arco, alas inclinadas, camarotes, mesas, área em pé, lugares para cadeira de rodas, numeração par e ímpar por lado.

## 2. O que os bons mapas fazem

Resumo do que aparece nos editores de mercado (Eventbrite, Ticketmatic, Seatmap Pro, VBO Tickets, On the Stage e outros). Conferi as páginas de ajuda de cada um; não consegui abrir a documentação do Seats.io, então ele não entra como fonte.

**Estrutura.** O padrão é **seção → fileira → lugar**, com seções que podem ter qualquer formato (no Eventbrite, retângulos por padrão que se ajustam à sala). Preço e categoria se definem por seção ou até por lugar.

**Objetos além da cadeira.**
- Mesas: uma mesa redonda de 8 lugares, ou retangular com os lugares das pontas virados um para o outro.
- Áreas em pé, com capacidade.
- Palco, que se pode girar.

**Geometria.**
- **Fileira curva:** ao pôr uma faixa de fileiras, informa-se um **raio de curva** e os lugares se distribuem sozinhos (VBO Tickets). O On the Stage usa um controle de curvatura para uma fileira ou para a seção toda.
- **Espaçamento por fileira**, também ajustável (Seatmap Pro, On the Stage).
- **Girar lugares**, e uma ferramenta de "forma do espaço" que alinha os lugares e gera o contorno das seções sozinha (Seatmap Pro).

**Planta de fundo.** Quase todos aceitam uma imagem ou um SVG da planta **atrás** do editor, para você desenhar por cima.

**Acessibilidade.** Os editores têm marcação de lugar acessível, mas nenhuma das páginas que li explica como ele é marcado ou filtrado para o comprador. No Brasil isso tem peso de lei (seção 4).

**Numeração.** Não há regra única. O padrão mais comum em teatros: **ímpar de um lado e par do outro**, com os números crescendo do centro para fora, e fileiras que podem ir de A a Z ou de AA a ZZ. Por isso dois lugares lado a lado no mapa podem ter números que não são seguidos (35 ao lado de 37). Cada sala tem a sua regra. Logo, **o rótulo do lugar é uma coisa e a posição dele no desenho é outra**.

**Tipos de plateia** (de projeto de auditórios, fontes de fornecedores de cadeiras):
- Vários corredores, para salas retangulares.
- **Continental:** grandes blocos, corredores só nas laterais, fileiras em raio, corredores mais largos.
- Leque largo: mais de 130 graus empurra a sala para fala.
- Anfiteatro, arena (360 graus) e vinhedo (blocos em cascata).
- Fileiras em degraus para a visão.

Nossos clientes (teatros, casas de show, igrejas, auditórios, escolas) cobrem sobretudo os três primeiros.

## 3. Importar a planta

**O que o mercado faz.**
- **SVG é o formato de troca.** O Ticketmatic recebe um SVG em que cada elemento de um grupo "lugares" é um lugar, cada seção é um caminho fechado que envolve os lugares, e os ids dos elementos não podem mudar. Depois de enviar, ele mostra a contagem de lugares para conferir, e uma camada de referência (imagem por baixo) é descartada na importação.
- **A planta como fundo.** O Seatmap Pro e outros aceitam SVG ou imagem como fundo e o produtor posiciona seções e lugares por cima.
- **PDF e CAD.** Para eles, a pesquisa aponta o caminho de exportar para SVG ou PDF antes. Não achei produto que leia DWG ou DXF direto para virar mapa de venda.
- **Detecção automática** dos lugares a partir de uma imagem **só apareceu em patentes**: redes neurais que reconhecem lugares, ou vetorização de imagem. Não achei produto comprovado que faça isso bem. Trato como experimento, sempre com revisão de uma pessoa.
- **Trocar mapas entre eventos.** O Ticketmatic exporta e importa o plano inteiro em JSON.

**O que isso quer dizer para nós.** Os espaços culturais brasileiros costumam ter a planta num **PDF ou JPG** ("mapa de plateia"). Um exemplo é um anexo de edital da Fundação Cultural da Bahia com um modelo de mapa de plateia em PDF. A rota mais realista é **a planta como fundo do editor**, e não um conversor automático.

## 4. Acessibilidade: a parte que tem lei

Pelos resultados da pesquisa (a conferir no texto oficial antes de qualquer promessa):
- O **Decreto 9.404/2018**, que alterou o Decreto 5.296/2004, manda reservar em teatros, cinemas e auditórios **espaços para cadeira de rodas** (20, mais 1% do que passar de mil lugares) e **assentos para pessoas com deficiência ou mobilidade reduzida** (20, mais 1% do que passar de mil lugares).
- Esses espaços e assentos devem aparecer **identificados no mapa de assentos** dos pontos de venda e da divulgação do evento.
- Há versões anteriores, com 2% e mínimo de um, então confira qual vale.
- A **NBR 9050** traz parâmetros para assentos de pessoas obesas, e há regras estaduais e municipais (o Paraná exige 3% adaptados). O percentual e as medidas precisam ser conferidos na norma da ABNT e com quem entende da lei.

**Hoje o nosso mapa não tem tipo de lugar.** Cadeira de rodas, acompanhante e mobilidade reduzida não existem, nem aparecem no mapa do comprador. Isso não é "melhoria": é uma lacuna que vale tratar cedo.

## 5. A proposta

### 5.1 A ideia central: layout parametrizado, lugares com identidade

Separar duas coisas que hoje estão juntas:
- **Os lugares, com identidade** (setor, fileira, número): continuam em `ticketeria_assentos`, intactos. É nisso que a venda, o ingresso e o reembolso se apoiam, e nada do que se desenha pode mudar a identidade de um lugar vendido (a regra `lugar_vendido` já existe).
- **O desenho, descrito por parâmetros**, guardado num JSON por mapa: **blocos** (cada um com posição, ângulo, curvatura, espaçamento e a regra de numeração), **corredores** (vãos entre blocos e dentro das fileiras) e **objetos** (palco, mesa, área em pé, camarote, rótulos). A tela calcula a posição de cada lugar a partir desses parâmetros.

Por que parâmetros, e não x e y de cada lugar: o arquivo fica pequeno e editável por controles simples (arco, ângulo, espaço), serve em qualquer tamanho de tela e o cálculo é uma função pura, testável. Ajuste lugar por lugar fica como exceção, só se pedirem.

**Compatibilidade:** o mapa de hoje vira um layout de **um bloco** com o corredor do meio. Nenhum dado é perdido.

### 5.2 O que o produtor consegue

1. **Blocos e corredores livres.** Adicionar um bloco, arrastar, girar, e tocar entre dois lugares para abrir ou fechar um corredor (generaliza o `vaos` de hoje).
2. **Fileiras curvas e alas inclinadas**, com um controle de curvatura e outro de ângulo por bloco.
3. **Modelos de layout**, para o produtor começar do mais parecido e ajustar:
   - plateia com corredor central;
   - três blocos (esquerda, centro, direita);
   - continental;
   - leque;
   - plateia mais balcão;
   - mesas;
   - arena.
   Também **salvar um mapa como modelo** da organização e copiar o mapa de outro espaço ou evento.
4. **Tipos de lugar:** cadeira comum, cadeira de rodas, acompanhante, mobilidade reduzida, obeso. Com legenda no mapa do comprador e um contador do mínimo de referência da lei, **só informativo** (como o resto do produto, avisa e não impede).
5. **Regra de numeração por bloco:** esquerda para direita, direita para esquerda, ou ímpar e par a partir do centro, com o rótulo de cada lugar visível antes de salvar.
6. **Um mapa só da sala, com os setores coloridos** (decidido pelo Luan em 22/11/2026). Cada bloco pertence a um setor (que continua sendo a unidade de preço e de ingresso), e o comprador vê a sala inteira colorida por setor, em vez de um mapa por setor. É a maior mudança e a que mais parece com o mercado. A palavra "sala" está explicada em 5.5.
7. **Mesas, áreas em pé e camarotes** (um grupo de lugares com nome).

### 5.3 Importar

Em três degraus, do mais simples ao mais ambicioso:
1. **Planta de fundo.** Subir o PDF (primeira página), JPG, PNG ou SVG; aparece esmaecida por baixo; o produtor ajusta a escala e desenha por cima, arrastando blocos. O PDF vira imagem **no navegador**, sem servidor novo. É o que mais resolve na prática.
2. **Importar e exportar SVG e JSON.** O JSON é o nosso backup e o jeito de copiar mapas. O SVG segue o padrão do mercado (grupo de lugares, seções como caminhos fechados, contagem para conferir).
3. **Detecção assistida** (experimento): o produtor marca as pontas de cada bloco e quantos lugares há por fileira, e geramos o bloco. Detecção totalmente automática só se um piloto mostrar que presta, e sempre com revisão.

DWG e DXF: não. Pedimos para exportar para PDF ou SVG.

### 5.4 Como desenhar na tela

- **SVG** (não canvas): fica nítido em qualquer tamanho, cada lugar é um elemento acessível (leitor de tela e teclado, como já fazemos) e funciona bem com zoom.
- **Zoom e arrastar** no mapa do comprador, no celular com pinça. Salas grandes (milhares de lugares) pedem desenhar só o que está à vista.
- O **editor avançado é feito para computador** (o Eventbrite nem permite editar mapa no celular). No celular, o produtor continua com o editor simples de hoje para pequenos ajustes (bloquear lugar).
- Nada de biblioteca de terceiros para o editor. As que achei (seatmap-creator, react-seatmap-builder) são de poucos mantenedores e pouco usadas, e o que pesa para nós (reserva sem vender duas vezes) já é do banco, não da tela.

### 5.5 Um espaço com várias salas (decidido pelo Luan em 22/11/2026)

Um espaço pode ter **mais de uma sala**: um cinema com 2, 4 ou 6 salas, um centro cultural com teatro e sala menor. A pessoa diz quantas são e **dá um nome a cada uma** ("Sala 1", "Sala Jardim"). Cada sala tem o **seu mapa**.

**O modelo.** Entra um nível entre o espaço e o setor:

```
Espaço (hoje: local)  →  Sala (novo)  →  Setor  →  Lugar
                                  └── o mapa (blocos, corredores) é da sala
```

- **Compatibilidade.** Todo espaço que já existe ganha **uma sala padrão** ("Sala única", sem aparecer na tela enquanto houver uma só). Os setores e as sessões de hoje passam para ela. Nada muda para quem tem uma sala só, nem para turnê e evento único.
- **A sessão passa a ser de uma sala.** Hoje ela aponta para o espaço, e a venda confere que o setor do ingresso é do mesmo espaço da sessão (`fn_ticketeria_reservar`). Passaria a conferir a **sala**. No cinema, o mesmo filme em horários diferentes e em salas diferentes vira o caso normal.
- **O Começar** (para quem "tem um espaço") ganha a pergunta "Quantas salas tem?", com 1 como resposta de partida e, se houver mais de uma, os nomes de cada. Ao criar o evento, quem tem mais de uma sala escolhe em qual.
- **De bônus**, dá para avisar quando duas sessões se encavalam **na mesma sala** (o que um cinema precisa e hoje não existe).

**O que isso toca no que já existe** (conferido no código):
- Banco: `ticketeria_setores` e `ticketeria_sessoes` guardam `local_id`; a venda compara os dois. Passam a guardar também `sala_id`, com a comparação trocada para a sala.
- A página de compra lê os setores pelo espaço da sessão e passaria a lê-los pela sala.
- A tela de Vendas soma os lugares de cada espaço para dizer quanto da sessão já vendeu; passaria a somar por sala. (A sessão de cinema numa sala de 80 lugares não pode contar os lugares de todas as salas.)
- O catálogo de ingressos (setores por espaço) passa a listar os setores por sala.
- Tudo isso é **aditivo e compatível**: colunas novas com sala padrão preenchida, sem apagar nada.

## 6. Em que ordem

| Fase | O que entrega | Tamanho |
|---|---|---|
| **M0** | **Salas:** a tabela de salas, o `sala_id` nos setores e nas sessões (com a sala padrão para o que já existe), a venda conferindo a sala, a pergunta no Começar e a escolha da sala ao criar o evento. Sem mexer no desenho do mapa. | Médio: é encanamento, mas passa por venda, vitrine e vendas |
| **M1** | O motor do layout (blocos, corredores livres, curva e ângulo) e a tela do comprador desenhando por ele; os mapas de hoje viram um bloco. Modelos básicos: corredor central, três blocos, leque. | Grande: semanas, é a base de tudo |
| **M2** | Tipos de lugar (acessibilidade), regra de numeração, legenda no mapa do comprador e o contador de referência. | Médio |
| **M3** | Um mapa só da sala, com vários setores coloridos. Mexe na leitura do mapa para a compra. | Médio a grande |
| **M4** | Planta de fundo (PDF, imagem, SVG) para traçar por cima. | Médio |
| **M5** | Importar e exportar SVG e JSON, modelos salvos pela organização, copiar mapa. | Médio |
| **M6** | Mesas, áreas em pé, camarotes. | Médio |
| **M7** | Detecção assistida (piloto). | Incerto |

A minha sugestão é fazer **M0 primeiro**: é a estrutura em que o mapa se pendura, e é mais barato mexer nela agora, antes de haver mais eventos e vendas. Depois **M1 e M2 juntas**, porque a acessibilidade é a lacuna com peso de lei, e **M4 logo depois**, porque é o que o produtor sentiria mais.

## 7. O que o Luan decide

**Já decidido (22/11/2026):**
- **Mapa só do espaço**, com os setores coloridos (na prática, um mapa por sala).
- **Espaço com várias salas**, nomeáveis, cada uma com o seu mapa (seção 5.5).

**Ainda em aberto:**
1. **A ordem:** salas (M0) primeiro, como sugiro, ou o motor dos blocos (M1) primeiro?
2. **A acessibilidade entra já, junto com o motor (M2)?** A recomendação é que sim.
3. **A importação começa pela planta de fundo (PDF ou imagem)** em vez do SVG? A recomendação é que sim.
4. **Quais modelos de sala valem como os primeiros?** Teatro com plateia e balcão, cinema, igreja, auditório escolar, show em pé com camarote… quais os produtores de vocês mais pedem?
5. **Mesas e áreas em pé:** antes (para festas e shows) ou depois (M6)?
6. **Salas que se repetem:** num cinema com 6 salas iguais, a pessoa desenha um mapa e o **copia** para as outras? (A recomendação é que sim, com "copiar o mapa de outra sala".)

## 8. Riscos

- **Salas em eventos que já têm vendas.** A migração para a sala padrão não pode mexer em sessões vendidas: a conta de lugares e o conferir da venda precisam dar o mesmo resultado de antes para quem tem uma sala só. Teste pesado, como no resto.
- **Mapas com vendas.** Mudar o desenho não pode mudar quem é cada lugar. A migração do mapa de hoje precisa de teste pesado com lugares vendidos. Mudar a regra de numeração só vale sem vendas.
- **Leitura da lei.** Os números de acessibilidade vêm de resumos da pesquisa, não do texto oficial. Conferir antes de mostrar qualquer "mínimo".
- **Desempenho** com milhares de lugares na tela, em celular fraco.
- **Tamanho.** Isto é um produto dentro do produto. M1 sozinha é de semanas, e cada fase com tela passa pelo ok do Luan nas imagens, como no resto da Ticketeria.

## Fontes

- Estrutura, mesas, seções, acessibilidade e preço por seção: [Eventbrite, reserved seating](https://www.eventbrite.com/features/reserved-seating/).
- Linhas, blocos, mesa redonda de 8 lugares, planta de fundo e escala: [Ticketor](https://ticketor.com/Account/Feature/most-powerful-seating-chart-designer).
- Raio de curva ao pôr fileiras: [VBO Tickets](https://vbotickets.com/site/features/seatmap-builder).
- Curvatura por fileira ou por seção, espaçamento e rotação do palco: [On the Stage, curvar uma seção](https://intercom.help/on-the-stage/en/articles/6716287-curving-an-entire-section-on-your-seating-chart) e [espaço entre lugares](https://intercom.help/on-the-stage/en/articles/6735712-increasing-and-decreasing-space-between-seats-on-your-seating-chart).
- Espaçamento por fileira, importar SVG, ferramenta de forma: [Seatmap Pro](https://seatmap.pro/features/) e [espaçamento por fileira](https://seatmap.pro/knowledge-base/venue-editor/seat-spacing/).
- Formato SVG, grupos, seções fechadas, ids, camada de referência, contagem de lugares: [Ticketmatic, criar um SVG](https://docs.ticketmatic.com/en/creating-an-svg-for-a-seating-plan) e [desenhar planos](https://www.ticketmatic.com/docs/events/drawingseatingplans).
- Tipos de plateia (continental, vários corredores, leque, arena, vinhedo): [Irwin Seating, continental](https://www.irwinseating.com/resources/auditorium-design/seating-configurations/continental-seating), [Leadcom](https://www.leadcomseating.com/blog/auditorium-seating-layout-guide/) e [ArchDaily, 21 layouts](https://www.archdaily.com/799379/how-to-design-theater-seating-shown-through-21-detailed-example-layouts/).
- Numeração ímpar e par, do centro para fora: páginas de ajuda de teatros e bilheterias, como [Broadway.com](https://boston.broadway.com/help/visiting-the-theatre) e o [Paramount Oakland](https://www.paramountoakland.org/events/seating-charts). É prática local, não norma.
- Detecção automática de lugares em imagem (só patentes): [US 11.620.585](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11620585) e [US 12.443.898](https://patentsgazette.uspto.gov/week41/OG/html/1539-2/US12443898-20251014.html).
- Acessibilidade: [Decreto 9.404/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9404.htm), [guia de acessibilidade em eventos do Sebrae](https://sebrae.com.br/Sebrae/Portal%20Sebrae/UFs/AP/Anexos/guia_acessibilidade_eventos.pdf) e a NBR 9050 (a conferir na ABNT).
- Mapa de plateia em PDF no Brasil: [anexo da Fundação Cultural da Bahia](https://www.ba.gov.br/fundacaocultural/sites/site-funceb/files/2026-07/ANEXO%20XI%20-%20MAPA%20DE%20PLATEIA_0.pdf).
- Bibliotecas abertas (só desenho): [Konva, demo de reserva de lugares](https://konvajs.org/docs/sandbox/Seats_Reservation.html), [seatmap-creator](https://www.pkgstats.com/pkg:seatmap-creator) e [react-seatmap-builder](https://www.pkgstats.com/pkg:react-seatmap-builder).
