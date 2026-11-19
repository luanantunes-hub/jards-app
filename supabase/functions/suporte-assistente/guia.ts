// Guia do Jards que a IA da ajuda (o botão "?") usa para responder. É a única fonte dela: o que não estiver aqui, ela manda
// para a equipe. Preços e planos seguem a página de preços (public/precos.html) e a tela Meu plano.
//
// Mantenha este texto em dia quando mudar plano, preço, menu ou fluxo. Em especial: Conversas (e-mails e reuniões) está
// escondida do menu dos clientes enquanto o e-mail está em teste fechado e o Vexa não está no ar (ROTAS_SO_SUPER_ADMIN em
// app/(dashboard)/layout.tsx); quando ela abrir, tire "/conversas" de lá, passe o trecho de Conversas para o menu e
// republique a função. Um teste avisa se uma ponta mudar sem a outra.
// Sem crases nem "${" aqui dentro: o texto é um template string.

export const GUIA_DO_JARDS = `
O QUE É O JARDS
O Jards é uma plataforma brasileira para captar patrocínio pelas leis de incentivo (Cultura/Rouanet, Esporte, Audiovisual/Ancine e Saúde) e para prestar contas dos projetos incentivados. Tem três módulos: Captação, Prestação de contas e Produção. Quem usa mais de um troca de módulo no seletor de módulos, logo abaixo do logo no menu lateral. A Produção (agenda, equipe e logística de espetáculos) ainda está em implantação e só aparece para as organizações em que foi liberada.

MENU DA CAPTAÇÃO
Gerenciamento
- Visão geral: o painel com o funil consolidado de eficácia dos canais, as negociações estagnadas e os próximos eventos.
- Atividades: tarefas, reuniões, ligações e e-mails com prazo. Dá para ver em Lista, Calendário, Gantt e Carga da equipe, com as abas A fazer e Histórico.
- Projetos: os projetos incentivados que você capta.
Oportunidades
- Patrocinadores: a base de empresas que incentivam, nas quatro leis, com quanto cada uma aportou por ano, os projetos que patrocinou, o relatório de sustentabilidade, notícias e os contatos de quem decide.
- Comparativo: coloca empresas lado a lado, lei por lei, e mostra a expectativa de crescimento e o espaço que cada uma ainda tem até o teto legal de dedução.
- Editais: editais e chamamentos de patrocínio com inscrição aberta, com prazo e link, com busca por edital, empresa e estado.
Prospecções
- Empresas: as empresas com que você está trabalhando.
- Negociações: cada negociação é uma oportunidade de patrocínio e liga uma empresa a um projeto. Ela anda pelas etapas do funil, que a organização pode personalizar em Configurações, Funis e etiquetas. Para ganhar uma negociação, use Fechar negócio.
- Inscrições: a inscrição de um projeto em um edital de patrocínio de uma empresa.
Relacionamento
- Proponentes: quem apresenta o projeto à lei de incentivo (a organização ou a pessoa dona do projeto).
- Captadores: agências ou pessoas que captam patrocínio para os projetos.
- Contatos: as pessoas das empresas e dos projetos.
- Clientes: as empresas que já patrocinam. É onde ficam as entregas combinadas e o acompanhamento depois da venda.
O sino no alto da tela mostra os avisos. Configurações e Sair ficam no fim do menu lateral.

AINDA NÃO DISPONÍVEL
- Conversas: a ideia é reunir num lugar só os e-mails trocados com os contatos (Gmail ou Outlook) e as reuniões gravadas do Meet e do Teams, com a opção de escrever, responder e agendar e-mails pelo Jards. Ainda está em preparação e não aparece no menu. Se perguntarem, diga que ainda não está disponível.

COMO FAZER AS TAREFAS MAIS COMUNS
- Criar uma negociação: Prospecções, Negociações, botão Nova negociação. Escolha o patrocinador (ou crie na hora), o projeto, o valor e a etapa.
- Criar uma empresa, um contato, um projeto, um proponente ou uma inscrição: cada página tem o seu botão no alto (Nova empresa, Novo contato, Novo projeto, Novo proponente, Nova inscrição).
- Criar uma atividade: Atividades, botão Nova atividade. Escolha o tipo, o prazo e a que ela está vinculada. Em Mais detalhes ficam prioridade, responsável, horário, Sincronizar com calendário, resultado e nota. Para editar, clique na atividade; no campo Vínculo dá para criar na hora a negociação, a empresa, o projeto ou o contato.
- Ver os contatos de quem decide numa empresa: na página do patrocinador, em Responsáveis, Ver contatos. Isso gasta 1 crédito por empresa, uma única vez, e vale para a equipe toda.
- Convidar alguém para a equipe: Configurações, Minha equipe.
- Conectar o Claude ou o ChatGPT ao Jards: Configurações, Minhas ferramentas, Claude e ChatGPT. Na tela, siga os passos e entre com a conta do Jards. O e-mail da conta do Claude ou do ChatGPT não precisa ser o mesmo do Jards. Na Captação isso vale para os planos pagos (Starter e Pro) e quem conecta é quem administra a organização.
- Esqueci a senha: na tela de entrada, clique em Esqueci minha senha e siga o e-mail que chega.
- Trocar o e-mail de login: o app não troca. Peça à equipe.

PLANOS E PREÇOS DA CAPTAÇÃO
- Gratuito, R$ 0 para sempre, sem cartão. Negociações, empresas e contatos sem limite; incentivadores, editais abertos e histórico de aportes; 1 projeto ativo; 5 atividades em aberto e 5 inscrições em andamento; 1 captador, 1 proponente e 5 clientes ativos; comparativo com até 15 empresas no total; 1 usuário.
- Starter, R$ 62,90 por mês: tudo do Gratuito sem os limites, 100 créditos a cada mês pago (acumulam), comparações sem limite, Claude e ChatGPT conectados, 1 usuário incluído.
- Pro, R$ 92,80 por mês: as mesmas funções do Starter, com 200 créditos a cada mês pago.
- Usuários extras: R$ 19,90 por usuário por mês, nos planos pagos e na Prestação de contas. As vagas são por módulo. Captadores e proponentes externos não ocupam vaga.
- Créditos: 1 crédito libera os contatos de quem decide numa empresa, uma única vez, para toda a equipe. O saldo acumula enquanto a assinatura estiver ativa; se a assinatura for cancelada, o saldo zera. O saldo de créditos aparece em Configurações, em Saldo de créditos. Gráficos e histórico de aportes de cada empresa ficam abertos em todos os planos.
- Todas as assinaturas são mensais; não há plano anual.
- Assinar, ver o plano e pagar: tela Meu plano. Quem administra a organização assina; o botão Fazer upgrade do menu lateral (plano gratuito) leva para lá, e há um botão para ela em Configurações.
- Cancelar ou trocar o cartão: em Meu plano, Gerenciar assinatura, que abre o portal de pagamento. O cancelamento vale no fim do período já pago e nada é apagado: a organização volta aos limites do Gratuito.
- Trocar de plano (de Starter para Pro ou o contrário): o portal de pagamento não faz isso. Peça à equipe.
- Pagamento atrasado: há até 15 dias para regularizar sem perder os créditos nem a conexão com Claude e ChatGPT.

PRESTAÇÃO DE CONTAS
É um módulo à parte, com assinatura própria, independente do plano da Captação: R$ 92,80 por mês, 45 dias de teste gratuito (uma vez por organização, sem cartão), 1 usuário incluído e extras por R$ 19,90. Quem administra a organização começa o teste no seletor de módulos. Sem assinatura depois do teste, os dados ficam disponíveis para consulta e exportação.
Cada prestação segue as regras da lei do projeto: Lei Rouanet (IN MinC 29/2026, sistema oficial Salic), Lei de Incentivo ao Esporte (Portaria MESP 10/2026 e Portaria 424/2020), Audiovisual da Ancine (IN 159/2021 e IN 150/2019) e Pronon e Pronas/PCD na Saúde. Patrocínio direto e outras leis usam um modo genérico, sem regras de lei.
O que o módulo faz:
- Orçamento: importa por CSV ou PDF, com versões e os tetos de cada grupo de custo.
- Extrato: importa em OFX, CSV ou PDF, com conferência de saldo.
- Comprovantes: XML de NF-e e NFS-e é lido na hora; PDF e foto são lidos por IA, sempre com a confirmação da pessoa.
- Conciliação: o Jards sugere ligações entre pagamento e débito do banco por valor, data e documento, e a pessoa confirma cada uma.
- Checagens: mais de cem verificações de despesas, fornecedores, pagamentos, orçamento e execução, em bloqueios, alertas e avisos, cada um com o caminho para resolver. Os fornecedores são consultados na Receita e nas listas de sanções do TCU, do CNJ e da CGU.
- Prontidão para envio: o percentual pronto e o que falta, item por item, com o checklist de envio.
- Execução: metas, atividades, locais, beneficiários, distribuição, bens e divulgação, com as evidências (a data e o local das fotos são lidos do próprio arquivo, quando a foto os guarda).
- Prazo: o prazo de envio é calculado pela regra da lei, contando feriados nacionais, e vira atividade do responsável, com avisos de 30, 15, 7, 3 e 1 dia no app.
O envio ao órgão acontece no sistema oficial de cada lei; o Jards confere e prepara. A pessoa também pode registrar notas e recibos por e-mail encaminhado, no endereço da prestação.

QUANDO NÃO SOUBER
Para o que não está neste guia (cobrança, erro na tela, pedido de função, trocar de plano, dúvida jurídica ou tributária), a pessoa fala com a equipe pelo botão Falar com a equipe do painel de ajuda; a equipe responde por e-mail.
`;
