# Fila de trabalho da produção

Para seguir o plano sem pedir "pode seguir" a cada entrega. **Quem trabalha pega o primeiro lote da lista "Prontos" e vai em frente**; ao terminar um lote, já começa o próximo, sem perguntar qual. O plano completo é [plano-implementacao-modulo-producao.md](./plano-implementacao-modulo-producao.md) (a coluna "O que falta" da tabela "Andamento" diz o que resta de cada item); o contexto é [producao-contexto.md](./producao-contexto.md).

## Como cada lote anda

1. **Um PR por tela ou área**, com no máximo uma migration. Juntar itens do plano que mexem nas mesmas telas; não fazer um PR por item.
2. Branch nova a partir de `origin/main`. Migration nova: ensaiar com `npx tsx scripts/rodar-teste-banco.ts <teste> --migration <arquivo>` (desfeito no fim), aplicar, conferir que nada de teste ficou no banco. Tabela nova: partir de `scripts/molde-de-tabela.ts` ([docs/producao-molde-de-tabela.md](../../producao-molde-de-tabela.md)).
3. `npx tsc --noEmit`, eslint nos arquivos mexidos e `npx tsx --test tests/producao-*.test.ts tests/navegacao.test.ts` antes de empurrar.
4. Abrir o PR e **já começar o próximo lote** numa branch nova; mesclar cada PR **quando o teste automático (`validate`) estiver verde**, sem perguntar; depois do deploy, conferir a rota pública nova (código inexistente deve dar "não encontrada" sem login).
5. Notas do plano ("Andamento") e da memória do módulo vão **junto do PR de código**, não em PR só de nota.
6. Sem texto explicativo novo nas telas; sem `window.alert`; seguir `DESIGN.md`.
7. Ao fim de cada lote: mensagem curta em português simples (o que mudou, o que ficou sem ver logado), **sem pergunta no fim**.

## Parar e perguntar só quando

- Decisão que é do dono: preço, pagamento e venda de ingressos (decisões 16 a 19), texto de privacidade da coleta de dados de terceiros, provedor de assinatura eletrônica ou de rotas, regras de jornada do motorista, política de dados pessoais (alergia e restrições), funil de venda das datas, pilotos.
- Teste que falha ou regressão de verdade (a mesma falha do teste automático duas vezes; falha de download do GitHub não conta, é só rodar de novo).
- O que muda o que cliente real vê ou paga fora do piloto, página que cliente usa (`/atividades`), e-mail para fora, Stripe.
- `DELETE` que o conector recuse (entregar o `.sql`) ou apagar dado de produção.
- Limite de uso do Claude: retomar quando voltar.

## Prontos, em ordem

1. **Fichas e links** (feito em 17/11: PD3.5 ficha técnica do espaço por link). Falta no PD3.5: logo do espaço e planta da sala no PDF.
2. **Acerto técnico II** (PD4.1 e PD4.2): anexos e fotos na resposta; mais de uma pessoa respondendo; modelos por tipo de produção; lembrete antes de o link vencer (e-mail ao responsável da casa: já aprovado em 12/11). PD4.3: criar de uma vez todas as diferenças; camarins, luz e catering no rider.
3. **Dinheiro I** (PD5.1, PD5.5, PD5.7): comprometido somado dos acordos e pago somado dos lançamentos no orçamento; "a receber" ao lado do comprometido; arquivos das notas dentro do pacote de exportação.
4. **Operação do dia I** (PD7.1, PD7.4, PD7.3): tela de palco por link com cronômetro; exportar o borderô em planilha ou PDF; leitura da porta sem internet.
5. **Logística II** (PD6.3, PD6.4, PD6.8, PD6.12): foto na conferência e fila offline; valor do abastecimento; tipo de cama no mapa de quartos; onde cada item está e quando volta.
6. **Programação III** (PD8.1, PD8.4, PD8.5, PD12.3): arrastar entre salas; linha do tempo por espaço e por temporada; desenho das obras na planta (PD8.5); logo da marca por envio e marcas dos patrocinadores do CRM (só com os dois módulos).
7. **Parceiros** (PD9.2 a PD9.5): portal do patrocinador, relatório de retorno, portal do artista, comunicação por data. **Antes de construir, mostrar o desenho em um parágrafo e seguir se não houver objeção**, porque expõe dado ao parceiro.
8. **Pontes com a prestação** (PD10.x) e **conexão companhia–espaço** (PD11.x): ler o plano da fase e propor o primeiro corte; PD11 mexe em duas organizações, então começar pelo desenho.

## Bloqueados pelo dono (não começar)

PD4.6 assinatura eletrônica; PD6.5 jornada do motorista; PD6.7 e PD6.8 alergia e restrição; PD7.5, PD7.10, PD7.11 e PD8.2 (texto de privacidade); PD12.4 a PD12.9 venda de ingressos; PDL.1 a PDL.3 cobrança. PD3.6 foi descartado pelo dono em 17/11/2026.
