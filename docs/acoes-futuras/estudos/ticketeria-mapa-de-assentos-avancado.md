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

**Conferido no texto oficial em 23/11/2026** ([Decreto 9.404/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/decreto/d9404.htm), que deu nova redação ao art. 23 do Decreto 5.296/2004; li o decreto alterador, não o 5.296 consolidado). A primeira versão deste estudo trazia "20, mais 1%" para qualquer lotação: estava errada para quem tem até mil lugares.

- **Até 1.000 lugares:** **2%** de espaços para pessoas em cadeira de rodas e **2%** de assentos para pessoas com deficiência ou mobilidade reduzida, cada um com **no mínimo 1**.
- **Acima de 1.000:** **20** de cada **mais 1% do que passar de mil**.
- **Pessoas obesas:** **50% dos assentos reservados** para deficiência ou mobilidade reduzida têm que servir a pessoa obesa (medidas da norma da ABNT), no mínimo 1. Não é um número à parte: são lugares que contam também como os de mobilidade reduzida.
- **Fração:** vale o primeiro número inteiro acima (§ 9º).
- **Mapa:** os espaços e assentos devem ser **identificados no mapa de assentos** dos pontos de venda e de divulgação, físicos ou virtuais, e esses pontos devem ser acessíveis e trazer as informações de acessibilidade do evento (art. 23-B).
- **Venda a quem não tem deficiência (art. 23-A):** o lugar reservado só pode ser ocupado por outra pessoa se não houver procura comprovada, depois de prazos (o resumo que li cita 24 horas antes do evento, 72 horas em locais com mais de 10 mil pessoas e 30 minutos antes em cinemas). **Não está construído**: hoje o lugar de acessibilidade seria vendido como qualquer outro. Precisa de uma regra de liberação (decisão do Luan e conferência com quem entende da lei).
- **Prazo de adaptação:** só há um no texto, de 12 meses da publicação (12/06/2018) para os assentos de pessoa obesa.
- **Não confirmado:** se o 5.296 consolidado foi mexido depois de 2018; o conteúdo da NBR 9050; regras estaduais e municipais (o Paraná exige 3%). O contador do produto é **informativo** e não deve dizer "em conformidade".

### 4.1 A regra de venda dos lugares reservados (art. 23-A): decidida e ligada à venda em 23/11/2026

**O que o texto diz** (lido no Planalto; paráfrase, com trechos curtos entre aspas):
- A reserva vale do início das vendas "até vinte e quatro horas antes de cada evento", em **todos os pontos de venda, físicos ou virtuais** (§ 1º); em locais com capacidade acima de dez mil pessoas, "até setenta e duas horas antes" (§ 2º); em **cinemas**, "até meia hora antes de cada sessão" (§ 4º).
- Se não houver "procura comprovada", os lugares podem, "excepcionalmente", ser ocupados por pessoas sem deficiência (caput), mas só "depois de esgotados os demais assentos daquele setor" e depois do prazo (§ 3º).
- **O texto não define "procura comprovada"**: não diz critério, documento nem procedimento. Não traz sanção nem órgão fiscalizador, e não fala de preço dos lugares reservados.
- Os lugares devem ficar onde caiba o acompanhante ao lado (art. 23, § 3º). A meia-entrada não se restringe aos lugares reservados (art. 23, § 11).

**A proposta para a Ticketeria** (a função pura que a descreve, e os testes, estão em `lib/ticketeria/mapa-reserva.ts`):
1. **Lugar reservado** = os tipos cadeira de rodas, mobilidade reduzida e pessoa obesa. O lugar de acompanhante não é reservado por si: é comprado junto (decisão 3).
2. **Quem pode comprar um lugar reservado:** quem **declara** que ele (ou quem acompanha) tem deficiência ou mobilidade reduzida, a qualquer momento. Quem não declara, só **depois do prazo e com os demais lugares do setor esgotados nessa sessão**.
3. **O prazo** vem da capacidade do local (mais de 10.000: 72 horas; senão, 24) e de uma marca "é um cinema" no espaço (meia hora).
4. **Na compra:** antes do mapa, uma pergunta ("Alguém do grupo precisa de lugar para cadeira de rodas ou com mobilidade reduzida?"). Sem a declaração, os lugares reservados aparecem no mapa como "reservado" (com o selo, que o decreto manda mostrar) e não podem ser escolhidos; com ela, aparecem livres. A declaração fica gravada no pedido.
5. **No banco** (precisa do "sim" do Luan): a venda de lugares (`fn_ticketeria_reservar_com_lugares`) e o mapa do comprador (`fn_ticketeria_mapa_da_sessao`) passam a conhecer a declaração. Como não se acrescenta parâmetro a função publicada (PGRST203), nascem funções com outro nome, e o servidor passa a chamar as novas; uma coluna no pedido guarda a declaração e uma no espaço guarda "é cinema".

**Decisão do Luan (23/11/2026) e o que foi ligado:** vale a **declaração do comprador** (sem comprovante na venda). Ficam para depois: a marca "é cinema" (meia hora; hoje o prazo é 24 horas, ou 72 acima de 10.000 lugares pela capacidade da sala) e o acompanhante comprado junto (o lugar de acompanhante segue comprável por qualquer pessoa). Migration `20261128400000_ticketeria_lugares_reservados`, **aplicada**: coluna `ticketeria_pedidos.declarou_acessibilidade`; `fn_ticketeria_reserva_do_setor(sessao, setor, fora)` (quando a reserva termina, quantos lugares comuns sobram e se já foi liberada; a própria venda não conta como "esgotou"); e `fn_ticketeria_reservar_com_declaracao(...)` (função nova, chama a cadeia de sempre e recusa com `lugar_reservado`, na mesma transação, o pedido que leva lugar reservado antes da hora sem declaração). Nenhuma função existente mudou. Testes: pgTAP `supabase/tests/ticketeria_lugares_reservados.test.sql` (26 de 26 no banco real, numa transação desfeita) e os de compra, pagamentos, layout e tipo continuam passando. No servidor, a compra passa a chamar a função nova com a declaração (`acessibilidade` no corpo do pedido) e a rota do mapa marca como `reservado` os lugares reservados livres para quem não declarou. Na tela de escolher lugares, quando o mapa tem lugar reservado, aparece a pergunta "Alguém do grupo precisa de lugar para cadeira de rodas ou com mobilidade reduzida?" (um botão liga e desliga); marcar abre os lugares reservados, e desmarcar tira dos escolhidos os que voltam a ser reservados. **Privacidade:** a declaração é dado sobre deficiência; fica no pedido com o nome e o e-mail do comprador, na guarda de 12 meses (D6), e deve constar da política de privacidade (a conferir com o advogado). **Não visto:** a compra de ponta a ponta numa conta logada e com o Asaas (a venda segue desligada até as travas do dinheiro real).

**O que o produto não consegue fazer, e vale dizer ao produtor:**
- A regra só vale em **setor numerado** (é nele que há lugar com tipo). O decreto vale para o prédio inteiro: num setor sem lugar marcado, quem organiza tem que garantir à mão o espaço acessível.
- O Jards **não confere** se a pessoa tem deficiência. A declaração é do comprador, e a conferência, se houver, é na entrada (hoje a Porta não tem esse passo).

**Perguntas para quem entende da lei** (o texto não responde): o que vale como "procura comprovada" e quem decide; se basta a declaração do comprador; se o organizador pode manter os lugares reservados depois do prazo; como tratar setor sem lugar marcado; se a regra do cinema vale também para sala de teatro com sessões.

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

**Andamento (23/11/2026):**
- **M0 (salas):** feita (commits 5a54000, 7c80fd1, a62a77a).
- **M1, 1ª fatia:** o motor de layout, só em código (`lib/ticketeria/mapa-layout.ts`, desenho `components/ticketeria/MapaPorLayout.tsx`): blocos, corredores livres, fileira curva, ângulo, três regras de numeração, três modelos, conferência (inclui blocos sobrepostos) e a conversão do mapa de hoje. **Fora das telas e sem banco.** Falta: guardar o layout, ligar o desenho à compra e ao editor, o editor de arrastar e girar, mais modelos.
- **M2, 1ª fatia:** os tipos de lugar (`lib/ticketeria/mapa-acessibilidade.ts`): cadeira de rodas, acompanhante, mobilidade reduzida e pessoa obesa; a conta de referência da seção 4; as frases do contador; o selo com letra, o texto falado e a legenda no desenho. Fora das telas.
- **M2, banco (23/11/2026, com o "sim" do Luan):** migration `20261127110000_ticketeria_assentos_tipo`, **aplicada e registrada**. Coluna `ticketeria_assentos.tipo` (comum por padrão, com trava dos cinco valores) e três funções com o corpo trocado e a **mesma assinatura**: `fn_ticketeria_salvar_mapa` (cada lugar aceita `tipo`; quem não manda não apaga o gravado; tipo fora dos cinco é mapa inválido), `fn_ticketeria_mapa_do_setor` e `fn_ticketeria_mapa_da_sessao` (trazem `tipo` só quando não é comum: o JSON de quem não tem tipo é o de antes). Os 656 lugares que já existiam seguem comuns. Testes: pgTAP `supabase/tests/ticketeria_assentos_tipo.test.sql` (20 de 20 no banco real, numa transação desfeita) e os quatro testes antigos do mapa e das salas continuam passando com a migration. No código, `lerMapa`, `lerMapaDaSessao`, `paraSalvar`, `comTipoNoLugar` e `tiposDoMapa` (`lib/ticketeria/mapa.ts`) leem e gravam o tipo.
- **M2, o editor (23/11/2026, na branch; imagens APROVADAS pelo Luan em 23/11; falta a ordem de publicar dele, e ver o salvar numa conta logada):** na folha do mapa do setor (`MapaEditorSheet`), duas ferramentas: **Bloquear lugares** (como era) e **Tipo do lugar** (os cinco tipos para escolher; tocar marca o lugar; tocar de novo no mesmo tipo o devolve a comum). O lugar marcado leva selo com letra (R, A, M, O) e nome falado; a legenda mostra só os tipos que existem; o painel **Acessibilidade** mostra quanto há contra a referência da seção 4 ("1 de 2 · Faltam 1"), só como aviso, sem impedir de salvar. O mapa do comprador também mostra selo e legenda (art. 23-B). O onboarding (Começar) não ganha a ferramenta. Código: `components/ticketeria/AssentosView.tsx` (`EditorDoMapa`, `PainelDeAcessibilidade`) e `SetorDoLocal.tsx`.
- **M1, o layout no banco (23/11/2026, com o "sim" do Luan):** migration `20261128300000_ticketeria_layout_do_mapa`, **aplicada e registrada**. Coluna `ticketeria_setores.layout` (jsonb, nulo = lista de fileiras de sempre) com trava de tabela (`fn_ticketeria_layout_ok`: formato, limites, até 30 blocos, 60 fileiras, 80 lugares, 5.000 lugares); função **nova** `fn_ticketeria_salvar_mapa_com_layout(setor, fileiras, corredor, layout)` (salva o mapa pela função de sempre e o layout na mesma chamada; `layout_invalido` e `layout_inconsistente` se o layout não fala das mesmas fileiras e quantidades de lugares do mapa); `fn_ticketeria_salvar_mapa` e `fn_ticketeria_mapa_da_sessao` com o corpo trocado e a mesma assinatura: quem muda os **lugares** sem mandar layout deixa o setor sem layout (bloquear lugar ou mudar o tipo não derruba), e o mapa do comprador traz `layout` quando há. Testes: pgTAP `supabase/tests/ticketeria_layout_do_mapa.test.sql` (36 de 36 no banco real, numa transação desfeita) e os testes antigos do mapa, da compra, da porta, das salas e do tipo passando com a migration. No código: `lerLayout`, `mapaDoLayout` e `comEstadosDoMapa` (`lib/ticketeria/mapa-layout.ts`); a rota do mapa do comprador só repassa layout que se desenha; a tela de escolher lugares desenha pelo layout quando há (SVG que se ajusta à largura; "Ampliar o mapa" deixa os lugares com ~34 px e rolagem). **Nenhum setor tem layout ainda**: sem o editor, nada muda para quem usa o Jards hoje.
- **M1, o editor do layout (23/11/2026, na branch; imagens APROVADAS pelo Luan em 23/11; falta a ordem de publicar dele e ver o salvar numa conta logada):** na folha do mapa do setor, a terceira ferramenta **Desenho** (ao lado de Bloquear lugares e Tipo do lugar). O desenho em blocos fica no alto da folha e acompanha a rolagem; embaixo, **três modelos** (corredor central, três blocos, leque, cada um com seus números: fileiras, lugares...) e, para o **bloco escolhido**, a numeração (esquerda para direita, direita para esquerda, do centro para fora), o primeiro número, as fileiras, os lugares por fileira, a curva (raio), o ângulo, o corredor no meio, o mover (setas) e apagar; "+ Bloco" acrescenta um bloco ao lado; **arrastar o bloco no desenho** o move (encaixa em meio lugar). Erros do desenho (blocos em cima um do outro, número repetido, curva fechada demais, passar de 80 lugares na fileira ou 60 fileiras somando os blocos) aparecem em palavras e impedem salvar. "Voltar à lista de fileiras" tira o desenho. Salvar vai por `fn_ticketeria_salvar_mapa_com_layout`. Bloquear lugares e marcar o tipo funcionam também sobre o desenho em blocos. O onboarding (Começar) não ganha a ferramenta. Código: `lib/ticketeria/mapa-layout-editor.ts` (as contas), `components/ticketeria/EditorDoLayout.tsx` (os controles), `MapaPorLayout.tsx` (o desenho e o arrastar), `AssentosView.tsx` e `SetorDoLocal.tsx`. **Provado:** o que o editor gera (3 modelos no tamanho de partida, no mínimo e no máximo) é aceito pelo banco real; o arrastar foi provado com eventos de ponteiro sintéticos (o navegador de teste não gera os reais); **não visto:** abrir e salvar numa conta logada de verdade.
- **M1, empurrar os vizinhos (23/11/2026, na branch):** quando um bloco cresce (lugares, fileiras, curva, ângulo, corredor), os vizinhos que ele passou a atingir saem do caminho, o mínimo para deixar 1,2 lugar de folga, e o empurrado empurra o seguinte (`empurrarVizinhos`, `lib/ticketeria/mapa-layout-editor.ts`). Quem não é atingido não se mexe; arrastar um bloco com a mão não empurra ninguém (o editor só avisa se ficarem em cima um do outro). Visto no navegador: o centro de um modelo de três blocos ganhou 6 lugares por fileira e os lados saíram de ±12,4 para ±15,5.
- **M1, a alça de girar (23/11/2026, na branch):** no modo Desenho, o bloco escolhido ganha uma alça (círculo roxo com ↻) acima do pivô, ligada a ele por uma linha pontilhada; arrastar a alça em volta do pivô gira o bloco, encaixando de 5 em 5 graus, e os vizinhos são empurrados só ao soltar (`posicaoDaAlca` e `anguloParaPonto`, `lib/ticketeria/mapa-layout-editor.ts`; desenho em `MapaPorLayout.tsx`). Os botões de ângulo do painel seguem para quem usa teclado. Visto no navegador (eventos de ponteiro sintéticos): 0° → 30° → 47° encaixou em 45°.
- **M1, mais três modelos (23/11/2026, na branch):** **Plateia e balcão** (dois blocos, o balcão atrás, fileiras com nomes seguidos), **Continental** (fileiras longas, sem corredor) e **Arena** (o palco no meio e quatro blocos em volta, os de cima e dos lados girados para a primeira fileira ficar junto ao palco; o palco tem a marca `centralizado` e o editor o mantém no centro quando o desenho muda). São seis modelos no total. O contrato com o banco real foi provado para os três (tamanho de partida, mínimo e máximo, mais uma arena editada): todos aceitos. **Ficam de fora**, porque pedem um tipo novo de objeto no desenho: mesas, camarotes e área em pé (M6).
- **Falta:** a marca "é cinema" e o acompanhante comprado junto (seção 4.1); a conferência na porta de quem comprou lugar reservado; as perguntas ao advogado; modelos a mais (balcão, mesas, camarote, em pé); a planta de fundo (M4).

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
- **Leitura da lei.** Os números da seção 4 foram conferidos no texto do Decreto 9.404/2018, mas não no 5.296 consolidado, na NBR 9050 nem nas regras estaduais e municipais. O contador é informativo e nunca diz "em conformidade".
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
