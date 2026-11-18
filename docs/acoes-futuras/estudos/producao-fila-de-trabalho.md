# Fila de trabalho da produção

Para seguir o plano sem pedir "pode seguir" a cada entrega. **Quem trabalha pega o primeiro lote aberto da "Fila de execução" e vai em frente**; ao terminar um lote, já começa o próximo, sem perguntar qual. O plano completo é [plano-implementacao-modulo-producao.md](./plano-implementacao-modulo-producao.md) (a coluna "O que falta" da tabela "Andamento" diz o que resta de cada item); o contexto é [producao-contexto.md](./producao-contexto.md).

## Como cada lote anda

1. **Um PR por tela ou área**, com no máximo uma migration. Juntar itens do plano que mexem nas mesmas telas; não fazer um PR por item.
2. Branch nova a partir de `origin/main`. Migration nova: ensaiar com `npx tsx scripts/rodar-teste-banco.ts <teste> --migration <arquivo>` (desfeito no fim), aplicar, conferir que nada de teste ficou no banco. Tabela nova: partir de `scripts/molde-de-tabela.ts` ([docs/producao-molde-de-tabela.md](../../producao-molde-de-tabela.md)).
3. `npx tsc --noEmit`, eslint nos arquivos mexidos e `npx tsx --test tests/producao-*.test.ts tests/navegacao.test.ts` antes de empurrar.
4. Abrir o PR e **já começar o próximo lote** numa branch nova; mesclar cada PR **quando o teste automático (`validate`) estiver verde**, sem perguntar; depois do deploy, conferir a rota pública nova (código inexistente deve dar "não encontrada" sem login).
5. Notas do plano ("Andamento") e da memória do módulo vão **junto do PR de código**, não em PR só de nota.
6. Sem texto explicativo novo nas telas; sem `window.alert`; seguir `DESIGN.md`.
7. Ao fim de cada lote: mensagem curta em português simples (o que mudou, o que ficou sem ver logado), **sem pergunta no fim**.

## Parar e perguntar só quando

- Decisão que é do dono: preço, texto de privacidade da coleta de dados de terceiros, provedor de assinatura eletrônica ou de rotas, regras de jornada do motorista, política de dados pessoais (alergia e restrições), funil de venda das datas, pilotos.
- Teste que falha ou regressão de verdade (a mesma falha do teste automático duas vezes; falha de download do GitHub não conta, é só rodar de novo).
- O que muda o que cliente real vê ou paga fora do piloto, página que cliente usa (`/atividades`), e-mail para fora, Stripe.
- `DELETE` que o conector recuse (entregar o `.sql`) ou apagar dado de produção.
- Limite de uso do Claude: retomar quando voltar.

## Fila de execução (19/11/2026)

Ordem fixa. **Pega-se o primeiro lote aberto, faz-se, mescla-se com o teste verde e começa-se o seguinte, sem perguntar.** Um lote = um PR (no máximo uma migration). Quando um lote fecha, marca-se "feito" aqui, no mesmo PR do código.

| # | Lote | O que entra | Pronto quando |
|---|---|---|---|
| ~~**L1**~~ | ~~Planta da sala no PDF da ficha~~ | **FEITO em 19/11/2026**: o PDF da ficha e a página `/ficha/[código]` mostram a planta mais recente de cada sala, com os objetos no lugar e girados. Fechou o PD3.5 | — |
| ~~**L2**~~ | ~~Linha do tempo por espaço e por temporada~~ | **FEITO em 19/11/2026**: `espaco_id` e `temporada_id` no histórico, achados por `fn_producao_pai` (sobe a árvore sem configuração por tabela), linhas antigas preenchidas e os dois filtros na página | — |
| **L3** | Desenho das obras na planta (PD8.5) | A expografia posiciona a obra na planta da sala (x, y), reaproveitando o editor da PD2.2, com a ordem de montagem | A planta mostra onde cada obra fica e a montagem é conferida pelo desenho |
| **L4** | Relatório de retorno ao patrocinador (PD9.3) e comunicação por data (PD9.5) | Dentro do app, sem link para fora: números da sessão patrocinada, contrapartidas cumpridas, kit de imprensa e artes por data | A produção abre o retorno de um patrocinador e copia o texto |
| **L5** | Portais do patrocinador (PD9.2) e do artista (PD9.4) | Link sem conta, como os outros links públicos. **Antes de construir, escrever o desenho em um parágrafo no PR** (expõe dado a terceiro) | O parceiro abre o portal e vê só o que é dele |
| **L6** | Pontes com a prestação (PD10.2 e PD10.4) | A despesa da produção vira comprovante da prestação (cópia do arquivo, nunca referência) e os orçamentos aparecem lado a lado, dizendo de onde vem cada número. A PD10.1 é a migration da ponte | Uma despesa da produção chega à prestação e os três orçamentos se comparam |
| **L7** | Conexão companhia–espaço (PD11.1) | Só o desenho e o vínculo: `producao_conexoes` com aceite dos dois lados. As partes compartilhadas (PD11.2 a PD11.4) vêm depois, uma por lote | As duas organizações aceitam o vínculo e cada lado vê só o seu |
| **L8** | Restos do dinheiro | "A receber" ao lado do comprometido no orçamento; arquivos das notas dentro do pacote de exportação (PD5.7) | O orçamento mostra o a receber e o pacote sai com os documentos |
| **L9** | Sem internet (PD7.3 e PD6.3) | A leitura da porta e a folha do motorista funcionam com sinal ruim. **Primeiro o desenho no PR**: guardar a lista no aparelho expõe os códigos das credenciais (hoje só o hash fica no banco); a escolha é entre hashes no aparelho ou fila de leituras para conferir depois | A porta lê sem internet e a folha do motorista grava offline |

Fora da fila, só com decisão do dono: PD6.6 (leitura de passagem por IA — precisa publicar função no Supabase), PD6.13 (rotas e combustível — precisa contratar o serviço de mapas) e tudo que está em "Bloqueados" abaixo.

### Lotes fechados

- **Fichas e links** (PD3.5): ficha por link em 17/11; logo do espaço em 19/11 (#321); planta da sala no PDF e na página pública em 19/11. **Fechado.**
- **Acerto técnico II** (PD4.1, PD4.2): modelos por tipo de produção (#275) e "Pedir todas à casa" (#268), em 18/11. Resta o que depende do dono: anexos na resposta, mais de uma pessoa respondendo, lembrete por e-mail, campo numérico de camarim, luz e catering.
- **Dinheiro I** (PD5.1, PD5.5): comprometido dos acordos e pago dos lançamentos no orçamento. Resta o que está no L8.
- **Operação do dia I** (PD7.1, PD7.4): planilha do borderô (#267) e tela de palco por link (#274). Resta a porta sem internet, que é o L9.
- **Logística II** (PD6.3, PD6.4, PD6.8, PD6.12): tipo de cama, valor do abastecimento, onde cada item está e foto na conferência (#270, #271, #272). Resta a fila offline, que é o L9.
- **Programação III** (PD8.1, PD8.4, PD12.3): arrastar entre salas (#273), logo da marca por envio e a linha do tempo por espaço e por temporada (19/11). Resta o que está no L3; as marcas dos patrocinadores do CRM dependem de a organização ter os dois módulos.
- **Site público** (PD12.1 a PD12.3): o que está na main fica como está. **O site vai para a Ticketeria** (fase T1 do plano dela, decisão de 18/11): quem for mexer no site trabalha lá, não aqui.

## Bloqueados pelo dono (não começar)

PD4.6 assinatura eletrônica; PD6.5 jornada do motorista; PD6.7 e PD6.8 alergia e restrição; PD7.5, PD7.10, PD7.11 e PD8.2 (texto de privacidade); PDL.1 a PDL.3 cobrança. **A venda de ingresso (PD12.4 a PD12.9) saiu da Produção em 18/11/2026: é da Ticketeria, e a Produção não vende nem lê ingresso.** PD3.6 foi descartado pelo dono em 17/11/2026.
