-- Gerado por scripts/prestacao-gerar-seed-regimes.ts a partir de lib/prestacao/regimes
-- e lib/prestacao/calendario-regulatorio.ts. Não edite à mão: mude o código e
-- gere de novo. Idempotente.

-- Lei Rouanet — IN MinC 29/2026 (versão 2)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'rouanet_in29_2026' and versao < 2 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, vigente_ate, status, parametros, fontes, checklist_envio, modelos_saida, publicado_em)
values (
  'rouanet_in29_2026', 2, 'Lei Rouanet — IN MinC 29/2026', 'cultura', 'rouanet',
  'federal', 'Ministério da Cultura', 'Salic', 'Lei 8.313/1991; IN MinC 29/2026, alterada pela IN MinC 34/2026',
  '2026-01-30'::date, null, 'publicado',
  $regime${
  "codigo": "rouanet_in29_2026",
  "versao": 2,
  "nome": "Lei Rouanet — IN MinC 29/2026",
  "area": "cultura",
  "mecanismo": "rouanet",
  "esfera": "federal",
  "orgao": "Ministério da Cultura",
  "sistemaOficial": "Salic",
  "normaReferencia": "Lei 8.313/1991; IN MinC 29/2026, alterada pela IN MinC 34/2026",
  "vigenteDesde": "2026-01-30",
  "identificadorOficial": {
    "tipo": "pronac",
    "rotulo": "Pronac"
  },
  "fontes": [
    {
      "documento": "IN MinC 29/2026 (gov.br, com a IN 34)",
      "url": "https://www.gov.br/cultura/pt-br/acesso-a-informacao/legislacao-e-normativas/instrucao-normativa-minc-no-29-de-29-de-janeiro-de-2026"
    },
    {
      "documento": "IN MinC 29/2026 (DOU de 30/01/2026)",
      "url": "https://www.in.gov.br/web/dou/-/instrucao-normativa-minc-n-29-de-29-de-janeiro-de-2026-684187391"
    },
    {
      "documento": "IN MinC 34/2026 (DOU de 14/08/2026)",
      "url": "https://www.in.gov.br/web/dou/-/instrucao-normativa-minc-n-34-de-11-de-agosto-de-2026-725487667"
    }
  ],
  "aplicabilidade": {
    "criterio": "ato_praticado",
    "desde": "2026-01-30",
    "ate": null,
    "descricao": "Vale desde a publicação e se aplica também aos projetos em andamento, respeitados os direitos adquiridos.",
    "sucede": [],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 96 e 102",
      "citacao": "entra em vigor na data de sua publicação"
    }
  },
  "prazos": {
    "prestacaoFinal": {
      "descricao": "Concluir os pagamentos e enviar o relatório final no Salic",
      "responsavel": "proponente",
      "marco": "fim_vigencia",
      "quantidade": 60,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 69, caput",
        "citacao": "No período improrrogável de 60 (sessenta) dias após o término da vigência do projeto",
        "nota": "\"Improrrogável\" afasta pedido de prorrogação; a contagem segue a Lei 9.784/1999, art. 66 (art. 98, I)."
      }
    },
    "respostaDiligencia": {
      "descricao": "Responder diligência",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 20,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 95, caput",
        "citacao": "com o prazo de 20 (vinte) dias para resposta",
        "nota": "Vale também para a notificação por omissão do art. 69, § 1º, que não fixa prazo próprio."
      }
    },
    "analisePrestacao": {
      "descricao": "Análise da prestação de contas pelo MinC",
      "responsavel": "orgao",
      "marco": "envio_prestacao",
      "quantidade": 6,
      "unidade": "meses",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 71 e parágrafo único",
        "citacao": "no prazo de 6 (seis) meses, contados da data do envio da prestação de contas",
        "nota": "Vencido o prazo, começa a correr a prescrição quinquenal. Diligência suspende o prazo (art. 95, § 1º)."
      }
    },
    "recurso": {
      "descricao": "Recorrer da decisão (inclusive da aprovação com ressalvas)",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 78, caput",
        "citacao": "no prazo de 30 (trinta) dias",
        "nota": "Efeito suspensivo (§ 1º). A autoridade decide em 60 dias."
      }
    },
    "devolucao": {
      "descricao": "Recolher os valores após a reprovação",
      "responsavel": "proponente",
      "marco": "registro_decisao",
      "quantidade": 20,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 77",
        "citacao": "no prazo de 20 (vinte) dias, a contar do dia seguinte ao registro da decisão",
        "nota": "Atualização pela poupança desde o fim do prazo de captação."
      }
    },
    "recolhimentoAposRecurso": {
      "descricao": "Recolher ou pedir parcelamento depois do recurso indeferido",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 20,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 78, § 5º",
        "citacao": "recolher os recursos irregularmente aplicados, devidamente corrigidos; ou II - solicitar o parcelamento"
      }
    },
    "aprovacaoPeca": {
      "descricao": "Avaliação de peça de divulgação pelo MinC; sem resposta, a peça está aprovada",
      "responsavel": "orgao",
      "marco": "submissao_peca",
      "quantidade": 5,
      "unidade": "dias_uteis",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 21, §§ 2º e 3º",
        "citacao": "terá 5 (cinco) dias úteis para avaliá-los"
      }
    },
    "analiseAlteracao": {
      "descricao": "Análise de alteração pelo MinC; sem resposta, a alteração pode ser executada",
      "responsavel": "orgao",
      "marco": "protocolo_alteracao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 64, §§ 7º a 9º",
        "citacao": "Não havendo manifestação do Ministério da Cultura nos prazos estabelecidos, as alterações poderão ser executadas",
        "nota": "Mais 30 dias com manifestação da unidade técnica e mais 60 em obras ou restauro."
      }
    }
  },
  "prestacaoParcial": {
    "modalidades": [
      "continua"
    ],
    "descricao": "Não há prestação parcial como entrega: a comprovação financeira é contínua no Salic, à medida que os débitos acontecem, e o monitoramento é automatizado.",
    "prazo": null,
    "regras": [
      {
        "codigo": "comprovacao_minima_monitoramento",
        "descricao": "Deixar de fazer 30% das comprovações financeiras leva a notificação, sob pena de inadimplência.",
        "severidade": "alerta",
        "parametros": {
          "percentual": 30
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 65, § 3º",
          "citacao": "Quando o proponente deixar de realizar 30% (trinta por cento) das comprovações financeiras"
        }
      },
      {
        "codigo": "comprovado_recomendado",
        "descricao": "O manual recomenda manter mais de 80% do gasto comprovado para evitar inadimplência.",
        "severidade": "alerta",
        "parametros": {
          "percentual": 80
        },
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 57",
          "aConfirmar": true,
          "nota": "Régua do manual; a IN usa a de 30% do art. 65, § 3º."
        }
      },
      {
        "codigo": "diligencia_por_indicio",
        "descricao": "Denúncia, indício de irregularidade ou de vantagem ao incentivador abre diligência de 20 dias, sob pena de suspensão imediata.",
        "severidade": "alerta",
        "parametros": {
          "dias": 20
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 65, §§ 2º e 4º",
          "citacao": "apresente esclarecimentos no prazo de 20 (vinte) dias, sob pena de imediata suspensão"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 65, § 1º, e 68",
      "citacao": "As comprovações ocorrerão tempestivamente no [...] (Salic)"
    }
  },
  "orcamento": {
    "estrutura": {
      "niveis": [
        "Produto",
        "Etapa",
        "UF e município",
        "Item"
      ],
      "descricao": "Planilha por produto e etapa, com local e itens (quantidade, ocorrência e valor unitário). Versões: solicitada, aprovada para captar, adequada, homologada e readequada.",
      "fonte": {
        "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
        "dispositivo": "p. 20–21 e 44–48"
      }
    },
    "grupos": [
      {
        "codigo": "execucao",
        "rotulo": "Pré-produção, produção e pós-produção",
        "descricao": "Etapas de execução do produto, com assessoria contábil e jurídica; entram no valor do projeto.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 17, I a III e V"
        }
      },
      {
        "codigo": "direitos",
        "rotulo": "Direitos autorais e conexos",
        "descricao": "Direitos autorais e conexos; entram no valor do projeto e têm limite próprio.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 27"
        }
      },
      {
        "codigo": "recolhimentos",
        "rotulo": "Recolhimentos",
        "descricao": "Tributos e encargos recolhidos pelo projeto; entram no valor do projeto.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 17, IV"
        }
      },
      {
        "codigo": "divulgacao",
        "rotulo": "Acessibilidade e divulgação",
        "descricao": "Custo vinculado: acessibilidade, comunicação e divulgação acessíveis.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 17, § 1º, II, e art. 20"
        }
      },
      {
        "codigo": "administracao",
        "rotulo": "Custos administrativos",
        "descricao": "Custo vinculado: bens e serviços administrativos, tarifas necessárias, pessoal administrativo, elaboração da proposta e prestação de contas.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 17, § 1º, I, e art. 22"
        }
      },
      {
        "codigo": "captacao",
        "rotulo": "Remuneração de captação",
        "descricao": "Remuneração para captação de recursos; fica fora do valor do projeto e tem limite próprio.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 19"
        }
      }
    ],
    "bases": {
      "valor_projeto": {
        "descricao": "Valor do projeto: pré-produção, produção, pós-produção, recolhimentos e assessoria contábil e jurídica, sem custos vinculados e captação.",
        "soma": "todos",
        "exceto": [
          "administracao",
          "divulgacao",
          "captacao"
        ],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 17, caput; Anexo I, LXXV",
          "citacao": "sem custos vinculados e captação de recursos"
        }
      },
      "valor_total_projeto": {
        "descricao": "Valor total do projeto: o valor do projeto mais os custos vinculados e a captação.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "Anexo I, LXXVII",
          "citacao": "incluindo os custos vinculados e captação de recursos"
        }
      },
      "valor_aprovado_execucao": {
        "descricao": "Valor aprovado para execução: o total da planilha em uso.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 27",
          "nota": "A IN não define o termo; a planilha homologada (ou readequada) em uso é o aprovado para execução."
        }
      }
    },
    "tetos": [
      {
        "codigo": "administracao",
        "descricao": "Custos de administração, incluindo tarifas necessárias",
        "grupos": [
          "administracao"
        ],
        "percentual": 15,
        "base": "valor_projeto",
        "proporcionalAoCaptado": true,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 22, caput e III",
          "citacao": "tarifas bancárias cujo adimplemento se faz necessário à realização de tais atividades"
        }
      },
      {
        "codigo": "acessibilidade_divulgacao",
        "descricao": "Acessibilidade, comunicação e divulgação acessíveis",
        "grupos": [
          "divulgacao"
        ],
        "percentual": 20,
        "base": "valor_projeto",
        "proporcionalAoCaptado": true,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 20, caput",
          "citacao": "não poderá ultrapassar o limite de 20% (vinte por cento) do valor do projeto"
        }
      },
      {
        "codigo": "captacao",
        "descricao": "Remuneração de captação",
        "grupos": [
          "captacao"
        ],
        "percentual": 10,
        "base": "valor_projeto",
        "teto": 150000,
        "proporcionalAoCaptado": true,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 19, caput e §§ 1º e 2º",
          "citacao": "limitada a 10% (dez por cento) do valor do projeto e ao teto de R$ 150.000,00",
          "nota": "Paga proporcionalmente às parcelas captadas, sem contar saldo transferido; por ano em planos plurianuais e territórios criativos."
        }
      },
      {
        "codigo": "direitos_autorais",
        "descricao": "Direitos autorais e conexos",
        "grupos": [
          "direitos"
        ],
        "percentual": 10,
        "base": "valor_aprovado_execucao",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 27",
          "citacao": "até o limite de 10% (dez por cento) sobre o valor aprovado para execução"
        }
      }
    ],
    "regras": [
      {
        "codigo": "direitos_exibicao",
        "descricao": "Direitos de exibição até 20% do valor aprovado para execução (40% em VOD independente).",
        "severidade": "alerta",
        "parametros": {
          "percentual": 20,
          "percentualVod": 40
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 28"
        }
      },
      {
        "codigo": "caches",
        "descricao": "Cachê por apresentação: R$ 25 mil (artista individual), R$ 50 mil (grupo), R$ 5 mil por músico e R$ 25 mil para o maestro (orquestra), R$ 5 mil (palestrante). Acima disso, recurso não incentivado ou aprovação da CNIC.",
        "severidade": "alerta",
        "parametros": {
          "individual": 25000,
          "grupo": 50000,
          "musico": 5000,
          "maestro": 25000,
          "palestrante": 5000
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 26, I a IV e parágrafo único",
          "citacao": "O limite para previsão de pagamento de cachês com recursos incentivados, por apresentação"
        }
      },
      {
        "codigo": "valor_por_beneficiario",
        "descricao": "Valor por pessoa beneficiada até R$ 300, em projetos com bilheteria ou venda.",
        "severidade": "alerta",
        "parametros": {
          "valor": 300
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 16",
          "citacao": "será de até R$ 300,00 (trezentos reais)"
        }
      },
      {
        "codigo": "limite_por_projeto",
        "descricao": "Limite por projeto: R$ 500 mil (pessoa física) e R$ 1,5 milhão (pessoa jurídica); R$ 6 milhões ou R$ 15 milhões nas tipologias dos arts. 12 e 13, dentro da carteira; exceções do art. 14.",
        "severidade": "info",
        "parametros": {
          "pessoaFisica": 500000,
          "pessoaJuridica": 1500000
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "arts. 11 a 14"
        }
      },
      {
        "codigo": "tiragem_livro",
        "descricao": "Tiragem de livro até 3.000 exemplares; acima disso, decide a CNIC.",
        "severidade": "info",
        "parametros": {
          "exemplares": 3000
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 25"
        }
      },
      {
        "codigo": "tetos_audiovisual",
        "descricao": "Tetos por produto audiovisual (curta R$ 350 mil, games R$ 1,5 milhão, VOD R$ 2 milhões e outros), superáveis com edital ou contrato que assegure 50%.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 31, caput e §§ 2º e 3º"
        }
      },
      {
        "codigo": "bem_permanente",
        "descricao": "Bem permanente só se for mais econômico ou indispensável e estiver previsto na planilha, com a destinação declarada.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 30"
        }
      },
      {
        "codigo": "custos_artistico_culturais",
        "descricao": "Projetos sociais, educativos, ambientais, esportivos e gastronômicos: só os custos artístico-culturais são aprovados.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 18"
        }
      }
    ]
  },
  "alteracoes": {
    "janela": {
      "aPartirDe": "liberacao",
      "ate": "fim_execucao",
      "descricao": "Depois da liberação para execução e até o fim do período de execução, sem mudar o objeto nem o produto principal.",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 64, caput",
        "citacao": "Após a liberação para execução e até o final do período de execução"
      }
    },
    "tipos": {
      "remanejamento": {
        "permitido": true,
        "classificacao": "administrativa",
        "condicoes": [
          {
            "tipo": "mantem_grupos",
            "grupos": [
              "administracao",
              "divulgacao",
              "captacao"
            ],
            "descricao": "Não muda o valor aprovado dos custos vinculados (administração, acessibilidade e divulgação) nem da captação.",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 3º, II",
              "citacao": "não poderá implicar em alteração do valor aprovado para os custos vinculados e remuneração para captação de recursos"
            }
          }
        ],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Depois do remanejamento, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "arts. 19, 20 e 22"
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 64, § 3º, I e II",
          "citacao": "prescindirão da prévia autorização do Ministério da Cultura os remanejamentos [...] que não alterem o valor do projeto"
        }
      },
      "complementacao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "captado_minimo",
            "percentual": 50,
            "base": "valor_homologado_execucao",
            "severidade": "bloqueio",
            "descricao": "Ter captado ao menos 50% do valor homologado para execução.",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 4º",
              "citacao": "desde que o projeto tenha captado, no mínimo, 50% (cinquenta por cento) do valor homologado para execução"
            }
          },
          {
            "tipo": "acumulado_maximo",
            "percentual": 50,
            "base": "valor_homologado_execucao",
            "severidade": "bloqueio",
            "descricao": "As complementações somam até 50% do valor homologado.",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 4º, I"
            }
          },
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "A complementação respeita os tetos da IN.",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 4º, IV"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "detalhamento",
            "descricao": "Detalhe as ações e os custos adicionais.",
            "severidade": "info",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 4º, II"
            }
          },
          {
            "codigo": "reinclusao",
            "descricao": "Não reinclua itens retirados na análise do MinC.",
            "severidade": "info",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 4º, III"
            }
          }
        ],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 64, § 4º"
        }
      },
      "reducao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "acumulado_maximo",
            "percentual": 50,
            "base": "valor_total_projeto",
            "severidade": "bloqueio",
            "descricao": "As reduções somam até 50% do valor total do projeto.",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 5º, II",
              "citacao": "nem representar diminuição superior a 50% (cinquenta por cento) do valor total do projeto",
              "nota": "A IN não diz se o limite é cumulativo; o manual diz que é, e a soma das reduções é a leitura conservadora."
            }
          },
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Depois da redução, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "arts. 19, 20 e 22"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "detalhamento",
            "descricao": "Liste os itens retirados ou reduzidos e redimensione o escopo.",
            "severidade": "info",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 5º, III e IV"
            }
          },
          {
            "codigo": "execucao_proporcional",
            "descricao": "Para só executar menos, sem itens novos, a execução proporcional dispensa o pedido de redução.",
            "severidade": "info",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 6º"
            }
          },
          {
            "codigo": "selecao_publica",
            "descricao": "Projeto de seleção pública homologada não pode ser reduzido.",
            "severidade": "info",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 64, § 5º, V"
            }
          }
        ],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 64, § 5º"
        }
      },
      "inclusao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Com o item novo, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "arts. 19, 20 e 22"
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 36–37 e 44–48",
          "nota": "O remanejamento sem autorização vale para os itens da planilha aprovada; incluir item é readequação, analisada pelo MinC."
        }
      }
    },
    "alertasPorItem": [
      {
        "tipo": "variacao_item",
        "percentual": 50,
        "descricao": "No Salic, mudar mais de 50% do valor aprovado do item pode exigir readequação. A IN 29 não fixa esse limite.",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 36",
          "aConfirmar": true
        }
      },
      {
        "tipo": "item_ja_alterado",
        "descricao": "O Salic não deixa remanejar de novo item já readequado.",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 36"
        }
      }
    ],
    "prazoAnalise": "analiseAlteracao",
    "silencioAprova": true,
    "regras": [
      {
        "codigo": "inadimplencia_trava",
        "descricao": "Inadimplência ou inabilitação cautelar impedem pedidos de alteração.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 83, parágrafo único, II; art. 84, § 1º, III"
        }
      },
      {
        "codigo": "mudanca_de_local",
        "descricao": "Mudar o local exige planilha, plano de distribuição, acessibilidade e cronograma atualizados, sem descontinuar a gratuidade.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 64, § 2º"
        }
      },
      {
        "codigo": "mudanca_de_nome",
        "descricao": "Mudar o nome do projeto exige anuência do autor da obra, se houver.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 64, § 1º"
        }
      },
      {
        "codigo": "uso_de_rendimentos",
        "descricao": "Usar rendimentos dispensa pedido enquanto captado mais rendimentos não passarem do valor aprovado para execução.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 64, § 10"
        }
      },
      {
        "codigo": "uma_por_vez",
        "descricao": "No Salic, só uma alteração fica em edição por vez, e uma em análise bloqueia outra do mesmo tipo.",
        "severidade": "info",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 32"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 64"
    }
  },
  "fornecedores": {
    "limites": [
      {
        "codigo": "fornecedor",
        "descricao": "Pagamentos a um mesmo fornecedor",
        "escopo": "fornecedor",
        "base": "valor_captado",
        "faixas": [
          {
            "percentual": 20,
            "severidade": "bloqueio",
            "consequencia": "Pagamento acima do limite por fornecedor"
          }
        ],
        "excecoes": [
          {
            "descricao": "Elaboração de projetos executivos",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 24, I"
            }
          },
          {
            "descricao": "Conservação e restauro de bens tombados, acautelados ou de reconhecido valor cultural",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 24, II"
            }
          },
          {
            "descricao": "Construção, reforma, requalificação ou adequação de equipamentos culturais",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 24, III"
            }
          },
          {
            "descricao": "Serviços gráficos de livros artísticos, literários ou humanísticos",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 24, IV"
            }
          },
          {
            "descricao": "Energia elétrica",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 24, V"
            }
          }
        ],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 24, caput",
          "citacao": "Um mesmo fornecedor não poderá ter pagamento acima de 20% (vinte por cento) do valor captado",
          "nota": "A IN não define \"mesmo fornecedor\"; agrupar pelo CNPJ raiz. O Módulo II fala em 20% dos valores executados."
        }
      },
      {
        "codigo": "proponente",
        "descricao": "Remuneração do proponente e partes relacionadas",
        "escopo": "proponente_e_relacionados",
        "base": "valor_captado",
        "faixas": [
          {
            "percentual": 20,
            "severidade": "bloqueio",
            "consequencia": "Remuneração do proponente acima do limite"
          }
        ],
        "excecoes": [
          {
            "descricao": "Grupos artísticos familiares, corpos artísticos estáveis e coletivos que atuem na execução: sem limite percentual, com justificativa",
            "fonte": {
              "documento": "IN MinC 29/2026",
              "dispositivo": "art. 23, § 2º, I"
            }
          }
        ],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 23, caput",
          "citacao": "os valores das remunerações não ultrapassem 20%",
          "nota": "Só por serviço previsto no orçamento analítico."
        }
      },
      {
        "codigo": "proponente_pf_mei",
        "descricao": "Remuneração do proponente pessoa física ou MEI",
        "escopo": "proponente_pf_mei",
        "base": "valor_captado",
        "faixas": [
          {
            "percentual": 30,
            "severidade": "bloqueio",
            "consequencia": "Remuneração do proponente acima do limite"
          }
        ],
        "excecoes": [],
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 23, § 2º, II",
          "citacao": "limitado a até 30% (trinta por cento) do valor captado"
        }
      }
    ],
    "partesRelacionadas": {
      "descricao": "Cônjuge, companheiro, empresa coligada e empresa com sócio em comum entram no limite do proponente.",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 23, § 1º",
        "citacao": "serão computados no limite do proponente previsto no caput"
      }
    },
    "regras": [
      {
        "codigo": "servico_ao_incentivador",
        "descricao": "Pagar, com a captação ou outra rubrica, serviço prestado ao incentivador é vantagem indevida.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 19, § 3º; art. 33, IV"
        }
      },
      {
        "codigo": "fornecimento_pelo_incentivador",
        "descricao": "Fornecimento pelo incentivador com economicidade ou exclusividade não é vantagem indevida.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 66"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 23 e 24"
    }
  },
  "contas": {
    "contas": [
      {
        "tipo": "captacao",
        "descricao": "Conta captação, bloqueada, onde o incentivador deposita",
        "abertaPor": "orgao"
      },
      {
        "tipo": "movimento",
        "descricao": "Conta movimento, de livre movimentação, para executar o projeto",
        "abertaPor": "orgao"
      }
    ],
    "bancos": [
      "Banco do Brasil"
    ],
    "descricao": "Conta captação e conta movimento, abertas pelo MinC no Banco do Brasil, vinculadas ao CPF ou CNPJ do proponente.",
    "tarifas": {
      "regra": "isentas",
      "descricao": "As contas do projeto são isentas de tarifas; tarifa necessária à atividade administrativa entra nos custos de administração.",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 53, caput; art. 22, III",
        "citacao": "isentas de tarifas bancárias"
      }
    },
    "liberacao": {
      "descricao": "Liberação para execução depois da homologação, ao captar 20% do valor total do projeto, contando rendimentos, recursos de outro projeto e doações em bens ou serviços. Planos anuais e plurianuais: 1/12 a 1/48. Exceções: restauro urgente e contrato de patrocínio.",
      "percentualMinimo": 20,
      "base": "valor_total_projeto",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 56, caput e §§ 1º e 2º",
        "citacao": "será liberado para execução quando atingir 20% (vinte por cento) do valor total do projeto"
      }
    },
    "rendimentos": {
      "aplicacao": "automatica",
      "contamComoCaptado": true,
      "uso": "Usados no projeto sem pedido enquanto captado mais rendimentos não passarem do valor aprovado para execução; contam para os 20% da liberação e voltam ao FNC com o saldo.",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 54, § 2º; art. 56; art. 64, § 10; art. 68, IV",
        "citacao": "serão automaticamente investidos em fundo de aplicação financeira de curto prazo"
      }
    },
    "saldo": {
      "descricao": "O saldo remanescente pode ser transferido uma vez para outro projeto do mesmo proponente com captação vigente; sem pedido, aprovação ou efetivação em 20 dias, vai ao FNC.",
      "prazo": null,
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 61 e § 2º",
        "citacao": "não seja efetivado no prazo de até 20 (vinte) dias, o saldo remanescente será recolhido ao Fundo Nacional da Cultura"
      }
    },
    "regras": [
      {
        "codigo": "cadin_cnd",
        "descricao": "Cada transferência da captação para o movimento passa pela consulta ao CADIN e à CND.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 57"
        }
      },
      {
        "codigo": "captacao_fora_do_prazo",
        "descricao": "Captação depositada fora do prazo da Portaria é desconsiderada.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 54, § 3º"
        }
      },
      {
        "codigo": "captacao_acima",
        "descricao": "Captação acima do aprovado admite complementação ou transferência, com anuência dos incentivadores PJ.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 54, § 4º"
        }
      },
      {
        "codigo": "doacao_em_bens",
        "descricao": "Doação ou patrocínio em bens e serviços exige rubrica, carta do patrocinador e valor até o aprovado na rubrica.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 54, §§ 7º e 8º"
        }
      },
      {
        "codigo": "bloqueio_judicial",
        "descricao": "Bloqueio judicial ou penhora: 20 dias para desbloquear ou restituir, sob pena de inadimplência.",
        "severidade": "alerta",
        "parametros": {
          "dias": 20
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 55"
        }
      },
      {
        "codigo": "contas_inativas",
        "descricao": "Contas sem saldo nem movimento por 36 meses são encerradas.",
        "severidade": "info",
        "parametros": {
          "meses": 36
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 53, § 3º"
        }
      },
      {
        "codigo": "bloqueio_fim_execucao",
        "descricao": "O MinC bloqueia as contas no fim da execução, mas o art. 69 dá 60 dias para concluir pagamentos: pagamento depois do fim da execução precisa do fato gerador no prazo.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "arts. 69 e 70",
          "aConfirmar": true
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 53 a 61",
      "citacao": "abertas pelo Ministério da Cultura, exclusivamente no Banco do Brasil"
    }
  },
  "pagamentos": {
    "meiosPermitidos": [
      "pix",
      "ted",
      "doc",
      "boleto",
      "debito_automatico"
    ],
    "meiosVedados": [],
    "descricao": "Só mecanismos formais de pagamento, como PIX e TED. A IN não veda saque nem cheque; o Salic ainda lista os dois. Saque, cheque e cartão pedem justificativa.",
    "documentoFiscal": [
      {
        "codigo": "documento_anexo",
        "descricao": "Cada débito tem nota fiscal, recibo, RPCI, fatura ou contracheque anexado no Salic, com cotação nos casos exigidos e licitação se o proponente for público.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 68, I a III"
        }
      },
      {
        "codigo": "consulta_nfe",
        "descricao": "Autorizar o MinC, como terceiro, a consultar documentos fiscais eletrônicos.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 68, parágrafo único"
        }
      },
      {
        "codigo": "em_nome_do_proponente",
        "descricao": "Documento em nome do proponente, com descrição igual à da planilha e retenções de ISS, INSS e IR quando houver.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual do Proponente, Módulo III (MinC, 2026)",
          "dispositivo": "p. 28–29",
          "nota": "Exigência do manual, não da IN."
        }
      },
      {
        "codigo": "data_de_emissao",
        "descricao": "Emissão depois da Portaria de captação e até o fim da execução.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual do Proponente, Módulo III (MinC, 2026)",
          "dispositivo": "p. 29"
        }
      },
      {
        "codigo": "numero_do_pagamento",
        "descricao": "O número do documento de pagamento no comprovante é igual ao do lançamento no extrato, sem ponto nem vírgula.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 29 e 59"
        }
      },
      {
        "codigo": "pronac_na_nota",
        "descricao": "A IN não exige o Pronac na nota fiscal.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "Anexo I, XIV, b, XV e XVI"
        }
      }
    ],
    "regras": [
      {
        "codigo": "saque_cheque_cartao",
        "descricao": "Saque, espécie, cheque e cartão não estão previstos: exigir justificativa.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 58; Anexo I, XVI",
          "aConfirmar": true
        }
      },
      {
        "codigo": "recurso_proprio",
        "descricao": "Pagar com recurso próprio só sem saldo e para item aprovado; o ressarcimento vai só para conta do próprio proponente.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 59 e parágrafo único"
        }
      },
      {
        "codigo": "estorno",
        "descricao": "Pagamento equivocado é estornado à conta movimento.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 60"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 58",
      "citacao": "exclusivamente por meio de mecanismos formais de pagamento, como PIX e TED",
      "aConfirmar": true,
      "nota": "\"Como PIX e TED\" é exemplificativo: boleto e débito de guia são meios formais. Outros meios geram alerta, não bloqueio."
    }
  },
  "despesas": {
    "periodo": {
      "descricao": "Despesas entre a publicação da Portaria de captação e o fim da execução; as anteriores à liberação são ressarcíveis, as anteriores à Portaria nunca. Pagamentos até 60 dias depois do fim da vigência; despesa fora do prazo gera ressalva, salvo fato gerador no prazo.",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 47, §§ 1º a 3º; art. 69; art. 76, II, h"
      }
    },
    "vedadas": [
      {
        "codigo": "taxa_administracao",
        "descricao": "Taxa de administração ou similar",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, I"
        }
      },
      {
        "codigo": "agente_publico",
        "descricao": "Pagamento a agente público ou político, salvo LDO ou lei específica",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, II"
        }
      },
      {
        "codigo": "captacao_vedada",
        "descricao": "Captação em projeto de edital com incentivo exclusivo, de instituição criada pelo incentivador ou em obra de bem tombado do proponente",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, III, a e b, e § 2º, k"
        }
      },
      {
        "codigo": "servico_ao_incentivador",
        "descricao": "Serviços prestados ao incentivador",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, IV"
        }
      },
      {
        "codigo": "sem_relacao_com_objeto",
        "descricao": "Despesa sem relação direta, necessária e comprovada com o objeto",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, V"
        }
      },
      {
        "codigo": "taxi_alimentacao_pessoal",
        "descricao": "Táxi ou aplicativo fora da localidade ou como gasto pessoal; alimentação como gasto pessoal",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, § 2º, a e b"
        }
      },
      {
        "codigo": "produto_de_outro_projeto",
        "descricao": "Compra de produtos de outro projeto incentivado",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, § 2º, c"
        }
      },
      {
        "codigo": "estrutura_permanente",
        "descricao": "Estrutura permanente ou residencial, contas domésticas e locação permanente fora de plano anual",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, § 2º, d e e"
        }
      },
      {
        "codigo": "passagem_nao_aprovada",
        "descricao": "Passagens para trechos não aprovados; primeira classe ou executiva sem recurso não incentivado ou aprovação da CNIC",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, § 2º, f e h"
        }
      },
      {
        "codigo": "festas_vip",
        "descricao": "Convites, camarotes, espaços VIP, festas, coquetéis e bufê",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, § 2º, g"
        }
      },
      {
        "codigo": "midia_audiovisual",
        "descricao": "Espaço de rádio e TV no audiovisual, salvo divulgação do produto principal",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, § 2º, i"
        }
      },
      {
        "codigo": "bem_permanente_administracao",
        "descricao": "Bem permanente do proponente nos custos de administração",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, § 2º, j"
        }
      },
      {
        "codigo": "imagem_agente_politico",
        "descricao": "Difusão da imagem de agente político",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 32, I"
        }
      }
    ],
    "regras": [
      {
        "codigo": "anterior_a_portaria",
        "descricao": "Despesa anterior à Portaria de captação não é ressarcida.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 47, § 3º"
        }
      },
      {
        "codigo": "onus_da_prova",
        "descricao": "A pertinência das despesas é ônus do proponente.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 33, § 1º; art. 69, § 6º"
        }
      },
      {
        "codigo": "cotacoes",
        "descricao": "Cópia das cotações de preços nas hipóteses da IN.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 68, II"
        }
      },
      {
        "codigo": "equipe_e_encargos",
        "descricao": "Contador com registro no conselho, advogado pela tabela da OAB, encargos e benefícios do profissional da cultura.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 17, §§ 2º a 4º"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 33 e 47"
    }
  },
  "porte": {
    "base": "valor_captado",
    "faixas": [
      {
        "nome": "pequeno",
        "ate": 750000
      },
      {
        "nome": "medio",
        "ate": 5000000
      },
      {
        "nome": "grande",
        "ate": null
      }
    ],
    "regras": [
      {
        "codigo": "analise_por_inconformidade",
        "descricao": "Pequeno e médio porte: análise financeira só das inconformidades do Relatório de Execução Financeira; grande porte pode ter verificação ampliada.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 74, §§ 1º e 2º"
        }
      },
      {
        "codigo": "verificacao_ampliada",
        "descricao": "Em qualquer porte, verificação ampliada com apontamentos de fiscalização, diligências de controle, denúncias fundadas ou inconformidades não sanadas até o fim da execução.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 75"
        }
      },
      {
        "codigo": "ate_200_mil",
        "descricao": "Até R$ 200 mil, a avaliação do objeto pode ser substituída pela validação in loco do monitoramento, se não houver inconformidade de objeto não sanada.",
        "severidade": "info",
        "parametros": {
          "valor": 200000
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 73, §§ 3º e 4º",
          "aConfirmar": true,
          "nota": "A IN não diz se a base é o captado ou o aprovado."
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 72, parágrafo único",
      "citacao": "pequeno porte: aqueles com captação até R$ 750.000,00"
    }
  },
  "objeto": {
    "descricao": "Relatório final com a comprovação do objeto, metas propostas × resultados, produtos, acessibilidade e democratização, peças de divulgação e bens; em captação parcial, a análise considera a proporção entre captado e executado.",
    "regras": [
      {
        "codigo": "metas_resultados",
        "descricao": "Comparativo de metas propostas e resultados, a partir do cronograma físico.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, II"
        }
      },
      {
        "codigo": "evidencias",
        "descricao": "Comprovação da realização do objeto com evidências: exemplar, fotos, listas de presença, arquivos digitais, registro audiovisual.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, I e III"
        }
      },
      {
        "codigo": "objetivos_mensuraveis",
        "descricao": "Objetivos específicos mensuráveis e comprovados na prestação de contas.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 37"
        }
      },
      {
        "codigo": "captacao_parcial",
        "descricao": "Em captação parcial, a análise considera a proporção entre captado e executado e entre as contrapartidas.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 73, § 1º"
        }
      },
      {
        "codigo": "acessibilidade",
        "descricao": "Medidas de acessibilidade comprovadas; sem elas, a prestação é aprovada com ressalvas.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, IV; art. 76, II, g"
        }
      },
      {
        "codigo": "cotas_distribuicao",
        "descricao": "Plano de distribuição: até 10% para patrocinadores, até 10% promocional do proponente, no mínimo 10% gratuito social ou educativo e no mínimo 20% vendido a até R$ 50.",
        "severidade": "bloqueio",
        "parametros": {
          "patrocinadoresMax": 10,
          "proponenteMax": 10,
          "socialMin": 10,
          "popularMin": 20,
          "precoPopular": 50
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 41, I a IV",
          "citacao": "mínimo de 20% (vinte por cento) para comercialização em valores que não ultrapassem R$ 50,00"
        }
      },
      {
        "codigo": "preco_medio",
        "descricao": "Fora das cotas, preço médio do ingresso inteiro até R$ 250.",
        "severidade": "bloqueio",
        "parametros": {
          "valor": 250
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 41, § 3º"
        }
      },
      {
        "codigo": "meia_entrada",
        "descricao": "Meia-entrada de estudantes em ao menos 40% dos ingressos vendidos; idosos, ID Jovem e pessoas com deficiência em todos.",
        "severidade": "alerta",
        "parametros": {
          "estudantesMin": 40
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 41, § 2º"
        }
      },
      {
        "codigo": "receita_prevista",
        "descricao": "Receita prevista até o valor total do projeto.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 41, § 4º"
        }
      },
      {
        "codigo": "ampliacao_de_acesso",
        "descricao": "Ao menos uma medida de ampliação de acesso.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 42"
        }
      },
      {
        "codigo": "contrapartida_social",
        "descricao": "Com venda, ações formativas para ao menos 10% do público do produto principal, entre 20 e 500 beneficiários da rede pública.",
        "severidade": "bloqueio",
        "parametros": {
          "percentual": 10,
          "minimo": 20,
          "maximo": 500
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 44, § 1º"
        }
      },
      {
        "codigo": "vale_cultura",
        "descricao": "Atividades permanentes aceitam Vale-Cultura.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 41, § 6º"
        }
      },
      {
        "codigo": "alteracao_do_plano",
        "descricao": "Alterar o plano de distribuição sem prejuízo da democratização leva a aprovação com ressalvas.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 76, II, f"
        }
      },
      {
        "codigo": "deposito_legal",
        "descricao": "Obra audiovisual e produtos fora do Salic são entregues no suporte original, com depósito na Cinemateca e depósito legal na FBN quando couber.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, §§ 2º a 5º"
        }
      },
      {
        "codigo": "bens",
        "descricao": "Relação de bens móveis, obras de arte e imóveis, termo de aceitação de obra e recibo do destinatário de bem doado.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, VI a X"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 41 a 44, 69 e 73"
    }
  },
  "divulgacao": {
    "marcas": [
      "Lei de Incentivo à Cultura (Lei Rouanet)",
      "Ministério da Cultura",
      "Governo Federal"
    ],
    "aprovacaoPrevia": {
      "exigida": true,
      "prazo": "aprovacaoPeca",
      "silencioAprova": true,
      "descricao": "Material de divulgação e leiaute das marcas submetidos ao MinC antes de circular; sem resposta em 5 dias úteis, o material está aprovado.",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 21, §§ 2º e 3º",
        "citacao": "Previamente à sua circulação, o material de divulgação e o leiaute de aplicação das marcas nos produtos deverão ser submetidos ao Ministério da Cultura"
      }
    },
    "defeso": {
      "descricao": "A partir de 04/07/2026 e até as eleições: marca da Lei Rouanet e assinatura do MinC próprias do período, sem a marca do Governo Federal; a expressão \"Ministério da Cultura apresenta\" continua.",
      "fonte": {
        "documento": "Manual de Uso das Marcas do Pronac, versão defeso (jun/2026)",
        "dispositivo": "p. 1 a 8",
        "aConfirmar": true,
        "nota": "O manual não fixa a data de fim; o calendário regulatório guarda o defeso."
      }
    },
    "regras": [
      {
        "codigo": "marcas_em_todas_as_pecas",
        "descricao": "Marcas em todas as peças de divulgação, qualquer que seja a fonte do recurso e quem divulga.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 21, §§ 1º e 4º"
        }
      },
      {
        "codigo": "expressao_apresenta",
        "descricao": "\"Ministério da Cultura apresenta\" em primeiro lugar, em impressos, mídias digitais, rádio, TV, cinema e espetáculos.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Uso das Marcas do Pronac (jan/2026)",
          "dispositivo": "p. 7–8"
        }
      },
      {
        "codigo": "posicao_da_marca",
        "descricao": "Marca da Lei Rouanet à esquerda no bloco (ou no topo), sem status de participação; Governo Federal por último.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Uso das Marcas do Pronac (jan/2026)",
          "dispositivo": "p. 15, 19, 27 a 29"
        }
      },
      {
        "codigo": "reducao_minima",
        "descricao": "Redução mínima de 3,5 cm no impresso e 200 px no digital.",
        "severidade": "alerta",
        "parametros": {
          "cm": 3.5,
          "px": 200
        },
        "fonte": {
          "documento": "Manual de Uso das Marcas do Pronac (jan/2026)",
          "dispositivo": "p. 39",
          "aConfirmar": true
        }
      },
      {
        "codigo": "ressalva_por_marca",
        "descricao": "Não cumprir o Manual de Uso da Marca leva a aprovação com ressalvas.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 76, II, c"
        }
      },
      {
        "codigo": "marca_do_patrocinador",
        "descricao": "Marca do patrocinador, conforme as regras do MinC, não é vantagem indevida.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 66, VII"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 21"
    }
  },
  "envio": {
    "sistema": "Salic",
    "descricao": "Relatório final do objeto e comprovação financeira enviados juntos no Salic, em até 60 dias do fim da vigência; o botão de envio só libera sem pendências.",
    "documentos": [
      {
        "codigo": "relatorio_objeto",
        "descricao": "Relatório de cumprimento do objeto, com evidências, metas × resultados e produtos",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, I a III"
        }
      },
      {
        "codigo": "acessibilidade_democratizacao",
        "descricao": "Medidas de acessibilidade e de democratização do acesso",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, IV"
        }
      },
      {
        "codigo": "pecas_divulgacao",
        "descricao": "Amostras ou registros das peças do plano de divulgação",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, V"
        }
      },
      {
        "codigo": "bens",
        "descricao": "Relação de bens móveis, obras de arte e imóveis, com a cotação do art. 30",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, VI e VII"
        }
      },
      {
        "codigo": "aceitacao_obra",
        "descricao": "Termo de aceitação definitiva da obra",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, VIII"
        }
      },
      {
        "codigo": "aprovacao_patrimonio",
        "descricao": "Aprovação dos órgãos de patrimônio, em projetos de restauro",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, IX"
        }
      },
      {
        "codigo": "recibo_doacao_bem",
        "descricao": "Recibo do destinatário de bem permanente doado a entidade pública cultural",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 69, X"
        }
      },
      {
        "codigo": "comprovantes_despesa",
        "descricao": "Notas fiscais, recibos, RPCI, faturas e contracheques de cada débito",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 68, III"
        }
      },
      {
        "codigo": "cotacoes",
        "descricao": "Cópias das cotações, nas hipóteses da IN",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 68, II"
        }
      },
      {
        "codigo": "licitacao",
        "descricao": "Licitação, dispensa ou inexigibilidade, se o proponente for da administração pública",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 68, I"
        }
      },
      {
        "codigo": "recolhimento_fnc",
        "descricao": "Comprovante de recolhimento ao FNC do saldo e dos rendimentos, ou da transferência do saldo",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 68, IV; art. 61"
        }
      }
    ],
    "modelos": [
      {
        "codigo": "gru_fnc",
        "nome": "GRU de recolhimento ao FNC",
        "formato": "PagTesouro",
        "arquivo": null,
        "fonte": {
          "documento": "Manual do Proponente, Módulo III (MinC, 2026)",
          "dispositivo": "p. 31"
        }
      }
    ],
    "regras": [
      {
        "codigo": "etapas_lancadas",
        "descricao": "Etapas executadas lançadas em Etapas de Trabalho.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 62–63"
        }
      },
      {
        "codigo": "locais_comprovados",
        "descricao": "Todos os itens do local de realização comprovados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 62–63"
        }
      },
      {
        "codigo": "itens_comprovados",
        "descricao": "Itens orçamentários usados comprovados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 62–63"
        }
      },
      {
        "codigo": "sem_diligencia_aberta",
        "descricao": "Nenhuma diligência sem resposta.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 62–63"
        }
      },
      {
        "codigo": "sem_readequacao_em_analise",
        "descricao": "Nenhuma readequação em análise ou aberta.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 62–63"
        }
      },
      {
        "codigo": "aportes_validados",
        "descricao": "Todos os aportes validados no Salic.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 62–63"
        }
      },
      {
        "codigo": "saldo_liquidado",
        "descricao": "Nenhum saldo remanescente: recolhido ao FNC ou transferido.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 62–63"
        }
      },
      {
        "codigo": "anexos",
        "descricao": "Anexos em PDF de até 5 MB.",
        "severidade": "alerta",
        "parametros": {
          "mb": 5
        },
        "fonte": {
          "documento": "Manual do Proponente, Módulo III (MinC, 2026)",
          "dispositivo": "p. 12 e 44"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 68 e 69"
    }
  },
  "posEnvio": {
    "resultados": [
      {
        "resultado": "aprovada",
        "descricao": "Execução integral, ampliada ou parcial proporcional à captação; inadequações sanadas.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 76, I, a a e"
        }
      },
      {
        "resultado": "aprovada_ressalvas",
        "descricao": "Inadequações financeiras sem dolo, alteração sem anuência, marca fora do manual, falta de cessão de direitos, mudança de conteúdo ou do plano de distribuição, acessibilidade não comprovada ou despesa fora do prazo.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 76, II, a a h"
        }
      },
      {
        "resultado": "reprovada",
        "descricao": "Omissão no dever de prestar contas, descumprimento do objeto ou dano ao erário; reprovação por objeto reprova toda a execução financeira.",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 76, III e § 1º"
        }
      }
    ],
    "devolucao": {
      "descricao": "Recolhimento ao FNC: saldo e rendimentos no encerramento; valores irregulares em 20 dias do registro da reprovação.",
      "atualizacao": "Índice da caderneta de poupança desde o fim do prazo de captação; juros depois da mora.",
      "gru": [
        {
          "unidadeGestora": "340034",
          "gestao": null,
          "codigo": "019473",
          "referencia": "Número do Pronac",
          "fonte": {
            "documento": "Manual do Proponente, Módulo III (MinC, 2026)",
            "dispositivo": "p. 31",
            "nota": "Órgão arrecadador 34902 (Fundo Nacional de Cultura); serviço 019473 – FNC, recursos decorrentes de não aplicação de incentivos fiscais."
          }
        }
      ],
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "arts. 68, IV, e 77"
      }
    },
    "regras": [
      {
        "codigo": "analise_preditiva",
        "descricao": "No dia seguinte ao envio, a análise preditiva abre diligência de 20 dias com os apontamentos do Compliance.",
        "severidade": "alerta",
        "parametros": {
          "dias": 20
        },
        "fonte": {
          "documento": "Manual do Proponente, Módulo II (MinC, ago/2026)",
          "dispositivo": "p. 64"
        }
      },
      {
        "codigo": "diligencia_suspende",
        "descricao": "Diligência suspende os prazos de análise.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 95, § 1º"
        }
      },
      {
        "codigo": "prescricao",
        "descricao": "Análise além de 6 meses do envio inicia a prescrição quinquenal; interrompida, a contagem passa a 3 anos.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 71, parágrafo único; art. 80, § 4º"
        }
      },
      {
        "codigo": "acoes_compensatorias",
        "descricao": "Durante o prazo recursal, pedir ações compensatórias implica renúncia ao recurso e suspende a mora.",
        "severidade": "info",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 78, § 4º"
        }
      },
      {
        "codigo": "inadimplencia",
        "descricao": "Omissão em diligência gera inadimplência, que impede prorrogações, alterações e novos projetos até o recolhimento.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "arts. 83 e 88"
        }
      },
      {
        "codigo": "inabilitacao",
        "descricao": "Inabilitação por 3 anos depois do prazo recursal ou do recurso indeferido, extensível a corresponsáveis.",
        "severidade": "info",
        "parametros": {
          "anos": 3
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "arts. 79 e 86, §§ 1º e 2º"
        }
      },
      {
        "codigo": "cobranca",
        "descricao": "CADIN e SIAFI, PGFN em até 90 dias e TCE em até 120 dias (omissão) ou 360 dias (demais).",
        "severidade": "info",
        "parametros": {
          "pgfn": 90,
          "tceOmissao": 120,
          "tceDemais": 360
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 79; art. 90, § 1º"
        }
      },
      {
        "codigo": "reabertura",
        "descricao": "Contas aprovadas podem ser reabertas uma vez, em até 2 anos da aprovação.",
        "severidade": "info",
        "parametros": {
          "anos": 2
        },
        "fonte": {
          "documento": "IN MinC 29/2026",
          "dispositivo": "art. 81, § 1º"
        }
      }
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 71 a 91"
    }
  },
  "guarda": {
    "marco": "fim_vigencia",
    "quantidade": 5,
    "unidade": "anos",
    "prorrogaParaDiaUtil": false,
    "descricao": "Manter a documentação do projeto e apresentá-la ao MinC e aos órgãos de controle; não descartar com análise, recurso, cobrança ou reabertura em curso.",
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 82",
      "citacao": "pelo prazo de 5 (cinco) anos, contados do final da sua vigência"
    }
  }
}$regime$::jsonb,
  $fontes$[
  {
    "documento": "IN MinC 29/2026 (gov.br, com a IN 34)",
    "url": "https://www.gov.br/cultura/pt-br/acesso-a-informacao/legislacao-e-normativas/instrucao-normativa-minc-no-29-de-29-de-janeiro-de-2026"
  },
  {
    "documento": "IN MinC 29/2026 (DOU de 30/01/2026)",
    "url": "https://www.in.gov.br/web/dou/-/instrucao-normativa-minc-n-29-de-29-de-janeiro-de-2026-684187391"
  },
  {
    "documento": "IN MinC 34/2026 (DOU de 14/08/2026)",
    "url": "https://www.in.gov.br/web/dou/-/instrucao-normativa-minc-n-34-de-11-de-agosto-de-2026-725487667"
  }
]$fontes$::jsonb,
  $checklist$[
  {
    "codigo": "relatorio_objeto",
    "descricao": "Relatório de cumprimento do objeto, com evidências, metas × resultados e produtos",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 69, I a III"
    }
  },
  {
    "codigo": "acessibilidade_democratizacao",
    "descricao": "Medidas de acessibilidade e de democratização do acesso",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 69, IV"
    }
  },
  {
    "codigo": "pecas_divulgacao",
    "descricao": "Amostras ou registros das peças do plano de divulgação",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 69, V"
    }
  },
  {
    "codigo": "bens",
    "descricao": "Relação de bens móveis, obras de arte e imóveis, com a cotação do art. 30",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 69, VI e VII"
    }
  },
  {
    "codigo": "aceitacao_obra",
    "descricao": "Termo de aceitação definitiva da obra",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 69, VIII"
    }
  },
  {
    "codigo": "aprovacao_patrimonio",
    "descricao": "Aprovação dos órgãos de patrimônio, em projetos de restauro",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 69, IX"
    }
  },
  {
    "codigo": "recibo_doacao_bem",
    "descricao": "Recibo do destinatário de bem permanente doado a entidade pública cultural",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 69, X"
    }
  },
  {
    "codigo": "comprovantes_despesa",
    "descricao": "Notas fiscais, recibos, RPCI, faturas e contracheques de cada débito",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 68, III"
    }
  },
  {
    "codigo": "cotacoes",
    "descricao": "Cópias das cotações, nas hipóteses da IN",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 68, II"
    }
  },
  {
    "codigo": "licitacao",
    "descricao": "Licitação, dispensa ou inexigibilidade, se o proponente for da administração pública",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 68, I"
    }
  },
  {
    "codigo": "recolhimento_fnc",
    "descricao": "Comprovante de recolhimento ao FNC do saldo e dos rendimentos, ou da transferência do saldo",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 68, IV; art. 61"
    }
  }
]$checklist$::jsonb,
  $modelos$[
  {
    "codigo": "gru_fnc",
    "nome": "GRU de recolhimento ao FNC",
    "formato": "PagTesouro",
    "arquivo": null,
    "fonte": {
      "documento": "Manual do Proponente, Módulo III (MinC, 2026)",
      "dispositivo": "p. 31"
    }
  }
]$modelos$::jsonb,
  now()
)
on conflict (codigo, versao) do nothing;

-- Lei de Incentivo ao Esporte — Portaria MESP 10/2026 (versão 1)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'lie_p10_2026' and versao < 1 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, vigente_ate, status, parametros, fontes, checklist_envio, modelos_saida, publicado_em)
values (
  'lie_p10_2026', 1, 'Lei de Incentivo ao Esporte — Portaria MESP 10/2026', 'esporte', 'esporte',
  'federal', 'Ministério do Esporte', 'SLI e SEI', 'LC 222/2025; Decreto 12.861/2026; Portaria MESP 10/2026',
  '2026-03-04'::date, null, 'publicado',
  $regime${
  "codigo": "lie_p10_2026",
  "versao": 1,
  "nome": "Lei de Incentivo ao Esporte — Portaria MESP 10/2026",
  "area": "esporte",
  "mecanismo": "esporte",
  "esfera": "federal",
  "orgao": "Ministério do Esporte",
  "sistemaOficial": "SLI e SEI",
  "normaReferencia": "LC 222/2025; Decreto 12.861/2026; Portaria MESP 10/2026",
  "vigenteDesde": "2026-03-04",
  "identificadorOficial": {
    "tipo": "sli",
    "rotulo": "Nº do projeto no SLI"
  },
  "fontes": [
    {
      "documento": "LC 222/2025 (Planalto)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp222.htm"
    },
    {
      "documento": "Decreto 12.861/2026 (Planalto)",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12861.htm"
    },
    {
      "documento": "Portaria MESP 10/2026 (DOU de 04/03/2026)",
      "url": "https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578"
    },
    {
      "documento": "Modelos e manuais da LIE (MESP)",
      "url": "https://www.gov.br/esporte/pt-br/acoes-e-programas-1/lei-de-incentivo-ao-esporte/modelos-e-manuais-3"
    }
  ],
  "aplicabilidade": {
    "criterio": "protocolo_projeto",
    "desde": "2026-03-04",
    "ate": null,
    "descricao": "Projetos protocolados no SLI a partir de 04/03/2026, data de publicação e vigência da Portaria 10. Os protocolados antes seguem a Portaria 424/2020.",
    "sucede": [
      "lie_p424_2020"
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 102 a 104",
      "citacao": "Os projetos protocolados sob a égide da Portaria MC nº 424, de 22 de junho de 2020, terão sua análise, acompanhamento e prestação de contas regidos pelas disposições nela previstas",
      "aConfirmar": true,
      "nota": "O corte em 04/03/2026 é leitura dos arts. 102 a 104; a portaria não escreve a data."
    }
  },
  "prazos": {
    "prestacaoFinal": {
      "descricao": "Apresentar a prestação de contas final (PCF) por protocolo digital",
      "responsavel": "proponente",
      "marco": "fim_vigencia",
      "quantidade": 60,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 67; Decreto 12.861/2026, art. 33",
        "citacao": "Até 60 dias contados do término da vigência do Termo de Compromisso ou do Termo Aditivo",
        "nota": "Dias corridos, do dia seguinte à cientificação, com prorrogação para o primeiro dia útil (arts. 99 e 101)."
      }
    },
    "respostaDiligencia": {
      "descricao": "Suprir documentos ou informações pedidos em diligência da PCF (improrrogável)",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 68, §§ 3º e 4º",
        "nota": "A diligência chega por e-mail e o recebimento é confirmado em 1 dia útil."
      }
    },
    "analisePrestacao": {
      "descricao": "Análise técnica e análise financeira da PCF (cada uma)",
      "responsavel": "orgao",
      "marco": "envio_prestacao",
      "quantidade": 360,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 82",
        "nota": "360 dias para a técnica (DPPIE) e 360 para a financeira (CGPC), contados do recebimento."
      }
    },
    "analisePrestacaoParcial": {
      "descricao": "Relatório de acompanhamento da prestação parcial (PCP)",
      "responsavel": "orgao",
      "marco": "envio_prestacao",
      "quantidade": 60,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 66",
        "nota": "O prazo para durante a diligência; a PCP não julga o mérito nem a parte financeira."
      }
    },
    "recurso": {
      "descricao": "Pedido de reconsideração (único) da rejeição do objeto ou da parte financeira",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 5,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 71, §§ 2º e 3º; art. 80, §§ 5º e 6º"
      }
    },
    "recursoAdministrativo": {
      "descricao": "Recurso administrativo depois da reconsideração indeferida (Lei 9.784/1999)",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 10,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 71, § 3º; art. 80, § 6º"
      }
    },
    "devolucao": {
      "descricao": "Recolher os valores depois da reprovação, com rendimentos e atualização",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 45,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 80",
        "nota": "Atualização pela IN TCU 71/2012 (§ 3º); sem recolhimento, TCE."
      }
    },
    "devolucaoRessalva": {
      "descricao": "Recolher os remanescentes na aprovação com ressalva por cumprimento parcial ou no arquivamento",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 80, § 4º"
      }
    },
    "transferenciaSaldo": {
      "descricao": "Pedir a transferência do saldo remanescente para outro projeto da entidade",
      "responsavel": "proponente",
      "marco": "fim_vigencia",
      "quantidade": 60,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 57, § 2º",
        "nota": "Uma única vez, para projeto da mesma entidade em captação; senão, GRU."
      }
    },
    "esclarecimentoDivulgacao": {
      "descricao": "Esclarecer descumprimento do plano de divulgação (PDLIE)",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 5,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 93"
      }
    }
  },
  "prestacaoParcial": {
    "modalidades": [
      "a_criterio_do_orgao",
      "por_parcela"
    ],
    "descricao": "A PCP é pedida a critério da DPPIE e é obrigatória antes de cada parcela quando a liberação é parcelada; vai pelo SEI, nos formulários da DPPIE.",
    "prazo": "analisePrestacaoParcial",
    "regras": [
      {
        "codigo": "pcp_por_parcela",
        "descricao": "Com liberação parcelada, a PCP do período é condição para a parcela seguinte.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 37; art. 65, § 2º"
        }
      },
      {
        "codigo": "pcp_pelo_sei",
        "descricao": "PCP pelo SEI, com nº do processo, nome do projeto e os documentos I a XI; itens I a VII nos formulários da DPPIE.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65 e § 1º"
        }
      },
      {
        "codigo": "pcp_sem_merito",
        "descricao": "A análise da PCP não aprova o projeto nem julga a parte financeira, que fica para a PCF.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 66"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 64 a 66; Decreto 12.861/2026, art. 33, § 3º"
    }
  },
  "orcamento": {
    "estrutura": {
      "niveis": [
        "Atividade-fim ou atividade-meio",
        "Ação",
        "Item"
      ],
      "descricao": "Orçamento analítico por ação (1, 2...; atividade-meio com prefixo M) e item, cada um com quantidade × duração × valor unitário; elaboração e captação em linha própria, fora da atividade-meio.",
      "fonte": {
        "documento": "Planilha Orçamentária (modelo oficial do MESP)",
        "dispositivo": "colunas A a H e rodapé (H47, H63 a H68)"
      }
    },
    "grupos": [
      {
        "codigo": "execucao",
        "rotulo": "Atividade-fim",
        "descricao": "Ações da atividade-fim, inclusive o pessoal indispensável a ela.",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 12, § 1º"
        }
      },
      {
        "codigo": "administracao",
        "rotulo": "Atividade-meio",
        "descricao": "Despesas administrativas da atividade-meio, inclusive os encargos delas.",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 12, caput e §§ 1º e 2º"
        }
      },
      {
        "codigo": "elaboracao",
        "rotulo": "Elaboração e captação",
        "descricao": "Despesas de produção (elaboração do projeto e captação), fora da atividade-meio.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 26"
        }
      }
    ],
    "bases": {
      "valor_atividade_fim": {
        "descricao": "Total da atividade-fim, a base que os modelos oficiais usam para os 15% de atividade-meio.",
        "soma": [
          "execucao"
        ],
        "exceto": [],
        "fonte": {
          "documento": "Planilha Orçamentária (modelo oficial do MESP)",
          "dispositivo": "H64 = H63/H47 (\"Porcentagem da Atividade Meio x Fim (Até 15%)\")"
        }
      },
      "valor_projeto": {
        "descricao": "Atividade-fim mais atividade-meio, a base de elaboração e captação.",
        "soma": [
          "execucao",
          "administracao"
        ],
        "exceto": [],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 26 e §§ 1º a 3º"
        }
      },
      "valor_total_projeto": {
        "descricao": "Total geral: fim, meio e elaboração e captação.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Planilha Orçamentária (modelo oficial do MESP)",
          "dispositivo": "D68 \"TOTAL GERAL\""
        }
      }
    },
    "tetos": [
      {
        "codigo": "atividade_meio",
        "descricao": "Despesas administrativas (atividade-meio)",
        "grupos": [
          "administracao"
        ],
        "percentual": 15,
        "base": "valor_atividade_fim",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 12; Planilha Orçamentária, H64",
          "citacao": "ficam limitadas a 15% (quinze por cento) do orçamento total",
          "nota": "O Decreto fala em orçamento total; os modelos oficiais calculam meio ÷ fim, o critério da área técnica e o mais restritivo."
        }
      },
      {
        "codigo": "elaboracao_captacao",
        "descricao": "Elaboração e captação",
        "grupos": [
          "elaboracao"
        ],
        "percentual": 10,
        "base": "valor_projeto",
        "teto": 100000,
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 26 e §§ 1º a 3º",
          "nota": "10% na formação esportiva; 7% no esporte para toda a vida, 5% na excelência e 15% no projeto todo no N, NE ou CO (regra elaboracao_por_nivel). Até a prestação guardar o nível, a tela confere os 10%."
        }
      }
    ],
    "regras": [
      {
        "codigo": "elaboracao_por_nivel",
        "descricao": "Elaboração e captação até 10% (formação), 7% (toda a vida), 5% (excelência) ou 15% (projeto executado só no N, NE ou CO) de fim + meio, até R$ 100 mil.",
        "severidade": "bloqueio",
        "parametros": {
          "formacao": 10,
          "todaVida": 7,
          "excelencia": 5,
          "norteNordesteCentroOeste": 15,
          "teto": 100000
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 26 e §§ 1º a 3º"
        }
      },
      {
        "codigo": "sem_valor_fechado",
        "descricao": "Todo item tem quantidade × duração × valor unitário; é proibido lançar valor fechado.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 7º, V"
        }
      },
      {
        "codigo": "encargos_proprios",
        "descricao": "Encargos em item próprio e salário marcado como bruto ou líquido; encargo não autorizado na admissibilidade não entra.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 7º, IX; art. 44, §§ 2º e 3º"
        }
      },
      {
        "codigo": "media_de_orcamentos",
        "descricao": "Na proposta, cada despesa até a média de 3 orçamentos ou a tabela de referência.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 7º, § 4º"
        }
      },
      {
        "codigo": "receitas_no_orcamento",
        "descricao": "Receitas do projeto (bilheteria, inscrições) entram no orçamento e revertem ao projeto.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 15; Portaria MESP 10/2026, art. 7º, § 3º"
        }
      },
      {
        "codigo": "limite_de_captacao",
        "descricao": "Captação por projeto: até R$ 5 milhões (excelência) e R$ 2,5 milhões (toda a vida); formação sem limite; até 6 projetos por ano por CNPJ raiz.",
        "severidade": "info",
        "parametros": {
          "excelencia": 5000000,
          "todaVida": 2500000,
          "projetosPorAno": 6
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 14; Decreto 12.861/2026, art. 23"
        }
      }
    ]
  },
  "alteracoes": {
    "janela": {
      "aPartirDe": "assinatura_termo",
      "ate": "fim_execucao",
      "descricao": "Durante a vigência do Termo de Compromisso; a conta movimento só é usada depois da assinatura.",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 20, § 3º; arts. 52 e 53"
      }
    },
    "tipos": {
      "remanejamento": {
        "permitido": true,
        "classificacao": "administrativa",
        "condicoes": [
          {
            "tipo": "pedido_numero",
            "numeros": [
              2
            ],
            "descricao": "É o segundo pedido de remanejamento: só ele pode ser feito sem anuência prévia.",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 52, § 1º",
              "aConfirmar": true,
              "nota": "Leitura de \"somente no segundo remanejamento sem a necessidade de prévia anuência\": o primeiro pede aprovação."
            }
          },
          {
            "tipo": "movido_ate",
            "percentual": 20,
            "base": "valor_total_projeto",
            "acumulado": false,
            "descricao": "Move até 20% do valor total do projeto, sem passar do total aprovado na ATO.",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 52, §§ 1º e 2º"
            }
          }
        ],
        "requisitos": [
          {
            "tipo": "maximo_pedidos",
            "quantidade": 2,
            "severidade": "bloqueio",
            "descricao": "Até dois pedidos de remanejamento.",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 52, caput"
            }
          },
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "O remanejamento respeita os 15% de atividade-meio aprovados na ATO.",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 52, § 5º"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "comunicar_em_5_dias",
            "descricao": "Feito sem anuência, comunique à DPPIE em 5 dias e envie a documentação atualizada.",
            "severidade": "alerta",
            "parametros": {
              "dias": 5
            },
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 52, § 1º"
            }
          },
          {
            "codigo": "encargos_fixos",
            "descricao": "É proibido mudar o percentual de encargos.",
            "severidade": "bloqueio",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 52, § 7º"
            }
          },
          {
            "codigo": "tres_orcamentos",
            "descricao": "Se o valor unitário de um item subir, junte 3 orçamentos novos.",
            "severidade": "alerta",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 46, § 3º"
            }
          },
          {
            "codigo": "documentos_do_pedido",
            "descricao": "Ofício com justificativa, Descrição do Plano de Trabalho, planilha de remanejamento e planilha orçamentária atualizada.",
            "severidade": "info",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 54"
            }
          },
          {
            "codigo": "justificar_na_pcf",
            "descricao": "Na PCF, junte comprovantes e justificativas de toda alteração; o mérito é analisado ali.",
            "severidade": "info",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 52, § 8º"
            }
          }
        ],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 52"
        }
      },
      "complementacao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "maximo_pedidos",
            "quantidade": 1,
            "severidade": "bloqueio",
            "descricao": "Uma única readequação (captação depois de iniciada a execução).",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 53"
            }
          },
          {
            "tipo": "antecedencia",
            "quantidade": 90,
            "unidade": "dias_corridos",
            "severidade": "bloqueio",
            "descricao": "Pedido até 90 dias antes do fim do Termo de Compromisso.",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 53, § 1º"
            }
          },
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "A readequação respeita os tetos.",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 52, § 5º; art. 26"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "termo_aditivo",
            "descricao": "Depende de parecer técnico e da CTLIE, e é formalizada por Termo Aditivo assinado antes do fim do Termo.",
            "severidade": "info",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 53"
            }
          },
          {
            "codigo": "sem_item_nao_autorizado",
            "descricao": "É proibido incluir item que não foi autorizado.",
            "severidade": "alerta",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 53"
            }
          }
        ],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 53"
        }
      },
      "reducao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Depois da redução, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "Decreto 12.861/2026",
              "dispositivo": "art. 12"
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 43",
          "nota": "A P10 não trata de redução; qualquer outra alteração do plano de trabalho depende de autorização prévia da DPPIE."
        }
      },
      "inclusao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Com o item novo, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "Decreto 12.861/2026",
              "dispositivo": "art. 12"
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 43; art. 52, § 3º",
          "nota": "O remanejamento só mexe em itens já previstos; item novo é alteração do plano de trabalho."
        }
      }
    },
    "alertasPorItem": [],
    "prazoAnalise": null,
    "silencioAprova": false,
    "regras": [
      {
        "codigo": "local_de_execucao",
        "descricao": "O local de execução só muda com anuência prévia; sem ela, é inexecução.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 42"
        }
      },
      {
        "codigo": "outra_alteracao",
        "descricao": "Qualquer outra alteração do plano de trabalho precisa de autorização prévia da DPPIE.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 43"
        }
      },
      {
        "codigo": "prorrogacao",
        "descricao": "Prorrogação pedida até 30 dias antes do fim do Termo, no máximo duas, cada uma por Termo Aditivo assinado antes do vencimento.",
        "severidade": "alerta",
        "parametros": {
          "diasAntes": 30,
          "maximo": 2
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 56"
        }
      },
      {
        "codigo": "uso_de_rendimentos",
        "descricao": "Usar a aplicação financeira pede pedido formal com o valor exato a sair da conta captação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 55"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 42 a 56"
    }
  },
  "fornecedores": {
    "limites": [],
    "partesRelacionadas": {
      "descricao": "Patrocínio ou doação a projeto que beneficie pessoa vinculada ao incentivador não é dedutível; membros da entidade só recebem por função específica aprovada.",
      "fonte": {
        "documento": "LC 222/2025",
        "dispositivo": "art. 3º, § 2º, e art. 5º; Decreto 12.861/2026, art. 2º, §§ 5º e 6º; Portaria MESP 10/2026, art. 58, V"
      }
    },
    "regras": [
      {
        "codigo": "credor_ligado_ao_incentivador",
        "descricao": "Credor ligado ao incentivador (sócio, parente até o 3º grau, coligada) gera alerta.",
        "severidade": "alerta",
        "fonte": {
          "documento": "LC 222/2025",
          "dispositivo": "art. 5º; Decreto 12.861/2026, art. 2º, §§ 5º e 6º"
        }
      },
      {
        "codigo": "intermediacao",
        "descricao": "É vedado transferir a execução do objeto a terceiros; a sanção é a rescisão do Termo.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 13; Portaria MESP 10/2026, art. 59, III"
        }
      },
      {
        "codigo": "subcontratacao",
        "descricao": "Subcontratação só de atividade acessória prevista no plano, sob supervisão direta; nunca gestão, coordenação ou direção.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 13, §§ 3º e 6º"
        }
      },
      {
        "codigo": "contratacao_de_pessoal",
        "descricao": "Pessoal por RPA, CLT ou PJ especializada não exclusiva, com remuneração pela pesquisa de mercado ou pela tabela de referência da DPPIE.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 44 e § 1º"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 44, 58 e 59",
      "nota": "A LIE não fixa limite percentual por fornecedor nem por parte relacionada."
    }
  },
  "contas": {
    "contas": [
      {
        "tipo": "captacao",
        "descricao": "Conta CAPTAÇÃO, bloqueada, só para os aportes dos incentivadores",
        "abertaPor": "orgao"
      },
      {
        "tipo": "movimento",
        "descricao": "Conta MOVIMENTO, sob a gerência do MESP, usada depois do Termo de Compromisso",
        "abertaPor": "orgao"
      }
    ],
    "bancos": [
      "Banco do Brasil",
      "Caixa Econômica Federal"
    ],
    "descricao": "Duas contas abertas pela DPPIE em nome do proponente, exclusivas do projeto; só conta como incentivo o que foi depositado na CAPTAÇÃO.",
    "tarifas": {
      "regra": "norma_silente",
      "descricao": "A LC, o Decreto, a Portaria e os modelos não dizem se tarifa bancária é despesa elegível.",
      "fonte": {
        "documento": "LC 222/2025, Decreto 12.861/2026 e Portaria MESP 10/2026",
        "dispositivo": "texto integral, sem regra sobre tarifas"
      }
    },
    "liberacao": {
      "descricao": "Da CAPTAÇÃO para a MOVIMENTO, integral ou em parcelas, conforme a DPPIE, depois do Termo de Compromisso; cada parcela nova depende da PCP.",
      "percentualMinimo": null,
      "base": null,
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 20, § 3º; art. 37; art. 65, § 2º"
      }
    },
    "rendimentos": {
      "aplicacao": "obrigatoria",
      "contamComoCaptado": false,
      "uso": "Só em ações do projeto, com pedido formal e justificativa no RCO; o proponente repõe o rendimento do período sem aplicação.",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 28 e §§ 1º a 5º; arts. 54 e 55"
      }
    },
    "saldo": {
      "descricao": "Transferência única, em 60 dias do encerramento, para outro projeto da entidade em captação; senão, GRU. Proibida se a PCF não for apresentada ou for rejeitada.",
      "prazo": "transferenciaSaldo",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 57, §§ 1º a 3º; art. 67, §§ 4º a 6º"
      }
    },
    "regras": [
      {
        "codigo": "conta_exclusiva",
        "descricao": "Conta exclusiva do projeto, por onde circulam todos os recursos captados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "arts. 30 e 31, §§ 1º a 3º; LC 222/2025, art. 11"
        }
      },
      {
        "codigo": "deposito_identificado",
        "descricao": "Aporte só com CPF ou CNPJ do depositante, direto na CAPTAÇÃO, com recibo emitido no SLI.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 20, §§ 2º e 10; art. 27"
        }
      },
      {
        "codigo": "captar_acima",
        "descricao": "É proibido captar mais que o autorizado; o excedente vai ao Tesouro.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "LC 222/2025",
          "dispositivo": "art. 10, parágrafo único; Portaria MESP 10/2026, art. 22, § 2º"
        }
      },
      {
        "codigo": "estorno",
        "descricao": "Depósito feito por engano: estorno ou correção em até 60 dias do depósito, senão GRU.",
        "severidade": "alerta",
        "parametros": {
          "dias": 60
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 23 e 25"
        }
      },
      {
        "codigo": "bloqueio_judicial",
        "descricao": "Bloqueio judicial é informado de imediato, sob pena de arquivamento; a reposição cabe ao proponente.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 20, §§ 7º e 8º"
        }
      },
      {
        "codigo": "autorizacao_ao_banco",
        "descricao": "Autorização irrevogável ao banco para cumprir as determinações da DPPIE.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 20, § 1º; art. 21"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 20 a 28"
    }
  },
  "pagamentos": {
    "meiosPermitidos": null,
    "meiosVedados": [
      "saque"
    ],
    "descricao": "Qualquer operação bancária autorizada pelo Banco Central que identifique a destinação e o credor; saque em dinheiro é proibido em qualquer hipótese.",
    "documentoFiscal": [
      {
        "codigo": "em_nome_da_entidade",
        "descricao": "Comprovantes emitidos única e exclusivamente em nome da entidade proponente.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 41"
        }
      },
      {
        "codigo": "numero_sli",
        "descricao": "Número do projeto no SLI em todos os comprovantes de despesa.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 41, § 1º"
        }
      },
      {
        "codigo": "carimbo_e_atesto",
        "descricao": "Carimbo na frente da nota (Nº SLI, Ministério do Esporte) e atesto de recebimento no verso, com data e assinatura.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Modelo de carimbos (MESP, 2023)",
          "dispositivo": "frente e verso; Portaria MESP 10/2026, art. 49, III",
          "nota": "O carimbo publicado ainda cita a Lei 11.438/2006, revogada; o texto da lei fica configurável."
        }
      },
      {
        "codigo": "nota_discriminada",
        "descricao": "Nota, fatura ou recibo discriminando o serviço ou produto, guardados frente e verso.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 78"
        }
      },
      {
        "codigo": "recibo_de_diarias",
        "descricao": "Diárias comprovadas por recibo assinado pelo usuário, com identificação e CPF.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 41, § 2º"
        }
      },
      {
        "codigo": "retencoes",
        "descricao": "Pagamento a pessoa física com IR, INSS e ISS retidos e recolhidos.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 76; Formulário PCP/PCF, aba PAGAMENTOS, instrução 5"
        }
      },
      {
        "codigo": "traducao",
        "descricao": "Documento em língua estrangeira com tradução juramentada.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 98"
        }
      }
    ],
    "regras": [
      {
        "codigo": "um_comprovante_por_debito",
        "descricao": "Cada débito na conta MOVIMENTO tem um comprovante.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 39"
        }
      },
      {
        "codigo": "ate_o_aprovado",
        "descricao": "Compra ou contratação sem novos orçamentos até o valor aprovado por item ou ação; acima, remanejamento.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 46"
        }
      },
      {
        "codigo": "processo_de_compra",
        "descricao": "Cada compra com cotação ou justificativa, escolha do fornecedor e do preço, comprovante de recebimento e documento contábil.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 49"
        }
      },
      {
        "codigo": "contrato",
        "descricao": "Contrato com objeto, regime, prazos, preço, pagamento, reajuste, direitos e multas, início e fim.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 50"
        }
      },
      {
        "codigo": "pregao",
        "descricao": "Entidade pública segue a Lei 14.133, com pregão para bens e serviços comuns.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 51"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 38 e 39",
      "citacao": "Saque em dinheiro é proibido em qualquer hipótese"
    }
  },
  "despesas": {
    "periodo": {
      "descricao": "Da assinatura do Termo de Compromisso ao fim da vigência; despesa fora dela é ressarcida com multa adicional de 5%, por GRU.",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 40; art. 80, § 7º; Decreto 12.861/2026, art. 29, § 3º"
      }
    },
    "vedadas": [
      {
        "codigo": "taxa_administracao",
        "descricao": "Taxa de administração, de gerência ou similar",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, I"
        }
      },
      {
        "codigo": "agente_publico",
        "descricao": "Pagamento a agente público da ativa por serviço, inclusive consultoria",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, II"
        }
      },
      {
        "codigo": "clube_de_servidores",
        "descricao": "Despesa em favor de clubes ou associações de servidores públicos",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, III"
        }
      },
      {
        "codigo": "vantagem_ao_patrocinador",
        "descricao": "Despesa que gere vantagem financeira ou material ao patrocinador",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, IV; Decreto 12.861/2026, art. 34, I; LC 222/2025, art. 20, I"
        }
      },
      {
        "codigo": "membros_da_entidade",
        "descricao": "Despesa em benefício de membros da entidade, salvo função específica aprovada",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, V"
        }
      },
      {
        "codigo": "imovel",
        "descricao": "Compra de imóvel",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, VI"
        }
      },
      {
        "codigo": "atleta_profissional",
        "descricao": "Remuneração de atleta profissional",
        "fonte": {
          "documento": "LC 222/2025",
          "dispositivo": "art. 6º, § 2º; Decreto 12.861/2026, art. 6º; Portaria MESP 10/2026, art. 59, I"
        }
      },
      {
        "codigo": "equipe_profissional",
        "descricao": "Manutenção ou organização de equipes profissionais de alto rendimento e de competições profissionais",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 6º, § 2º; Portaria MESP 10/2026, art. 59, II"
        }
      },
      {
        "codigo": "espaco_publicitario",
        "descricao": "Compra de espaço publicitário em qualquer meio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 14"
        }
      },
      {
        "codigo": "cobranca_de_beneficiarios",
        "descricao": "Cobrar qualquer valor dos beneficiários em projeto de atividade regular",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 16"
        }
      },
      {
        "codigo": "so_manutencao",
        "descricao": "Projeto só de despesas administrativas de manutenção da entidade",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 32, I"
        }
      },
      {
        "codigo": "beneficio_de_convencao",
        "descricao": "Benefícios de convenção coletiva não aprovados na admissibilidade",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 44, § 4º"
        }
      }
    ],
    "regras": [
      {
        "codigo": "pessoal_na_vigencia",
        "descricao": "Remuneração de pessoal limitada ao período de vigência, segregada no plano e aprovada antes.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 45"
        }
      },
      {
        "codigo": "bolsa_auxilio",
        "descricao": "Bolsa auxílio só para beneficiários do nível excelência.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 13"
        }
      },
      {
        "codigo": "crc_excelencia",
        "descricao": "No nível excelência, CRC válida durante toda a execução; vencida, 30 dias para a nova, senão pagamentos suspensos e ressarcimento.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 31"
        }
      },
      {
        "codigo": "tabela_de_referencia",
        "descricao": "Remuneração e diárias pela tabela de referência da DPPIE (a publicada é de 2020).",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 44, § 1º",
          "aConfirmar": true,
          "nota": "Não se sabe se as tabelas de 2020 continuam a referência vigente."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 40, 58 e 59"
    }
  },
  "porte": {
    "lacuna": "nao_se_aplica",
    "motivo": "A LIE não classifica projetos por porte. O que muda regras é o nível da manifestação esportiva (formação, toda a vida, excelência), que define o limite de elaboração e captação e o de captação por projeto.",
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 14 e 26"
    }
  },
  "objeto": {
    "descricao": "Relatório de Cumprimento do Objeto (RCO) com metas qualitativas e quantitativas da ATO, indicadores, instrumentos de verificação e percentual de atingimento; beneficiados, grade de atividades, eventos e fotos, inclusive de acessibilidade.",
    "regras": [
      {
        "codigo": "metas_da_ato",
        "descricao": "As metas são as aprovadas na Análise Técnica e Orçamentária; não as altere no relatório.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Modelo RCO 2026 (MESP)",
          "dispositivo": "seção III"
        }
      },
      {
        "codigo": "percentual_de_atingimento",
        "descricao": "Cada meta com indicador, instrumento de verificação, resultado e percentual de atingimento.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Modelo RCO 2026 (MESP)",
          "dispositivo": "seção III"
        }
      },
      {
        "codigo": "rede_publica",
        "descricao": "Na formação esportiva regular, ao menos 50% de alunos da rede pública.",
        "severidade": "bloqueio",
        "parametros": {
          "percentual": 50
        },
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 18"
        }
      },
      {
        "codigo": "acessibilidade",
        "descricao": "Acessibilidade para idosos e pessoas com deficiência, com fotos nos locais aprovados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 17; Portaria MESP 10/2026, arts. 11 e 68, XV"
        }
      },
      {
        "codigo": "beneficiados",
        "descricao": "Relação de beneficiados, com total feminino e masculino igual ao número listado.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "aba BENEFICIADOS"
        }
      },
      {
        "codigo": "ingressos_nao_distribuidos",
        "descricao": "O valor de ingressos não distribuídos (doação do tipo b) é restituído na PCF.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 11, § 2º"
        }
      },
      {
        "codigo": "receitas_revertidas",
        "descricao": "Inscrições e outras receitas revertidas integralmente ao projeto e mostradas no relatório de receita e despesa.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, § 5º; art. 7º, § 3º"
        }
      },
      {
        "codigo": "avaliacao_de_resultados",
        "descricao": "O MESP verifica resultados, custos estimados × reais e repercussão, e pode usar peritos.",
        "severidade": "info",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 32"
        }
      },
      {
        "codigo": "visita_tecnica",
        "descricao": "Visita técnica, presencial ou virtual, a qualquer tempo.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 61 e 62"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 65 e 68"
    }
  },
  "divulgacao": {
    "marcas": [
      "Selo da Lei de Incentivo ao Esporte",
      "Ministério do Esporte",
      "Governo Federal",
      "Bandeira Nacional"
    ],
    "aprovacaoPrevia": {
      "exigida": true,
      "prazo": null,
      "silencioAprova": false,
      "descricao": "O plano de divulgação (PDLIE) é aprovado pela ASCOM antes do Termo de Compromisso, e as peças finalizadas vão à ASCOM por e-mail, em PDF ou JPG, nomeadas pela peça.",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 35, I; art. 91, § 4º; modelo PDLIE 2026"
      }
    },
    "defeso": {
      "descricao": "De 04/07/2026 ao primeiro turno (04/10) ou ao segundo (25/10): sem a marca do Governo Federal; a assinatura é o selo LIE, \"MINISTÉRIO DO ESPORTE\" e a Bandeira.",
      "fonte": {
        "documento": "Manual de assinatura no período eleitoral (SICOM, jun/2026)",
        "dispositivo": "p. 2 a 6; Manual de Divulgação da LIE, versão defeso",
        "aConfirmar": true,
        "nota": "Nenhuma norma da DPPIE trata da análise do PDLIE no defeso; é leitura dos dois manuais."
      }
    },
    "regras": [
      {
        "codigo": "exposicao_equivalente",
        "descricao": "Selo e marca do Governo Federal com exposição equivalente à do maior patrocinador.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 90, § 2º"
        }
      },
      {
        "codigo": "selo_a_cada_insercao",
        "descricao": "Para cada inserção de nome, marca ou produto de patrocinador, o selo LIE e as marcas do MESP e do Governo Federal com igual exposição.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 92"
        }
      },
      {
        "codigo": "marcas_sem_distorcao",
        "descricao": "Proibido distorcer marcas, alterar cores ou posições e desobedecer a proporção.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 93"
        }
      },
      {
        "codigo": "comprovacao",
        "descricao": "Comprovação da divulgação por fotos, filmagens, gravações e peças.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 94"
        }
      },
      {
        "codigo": "reincidencia",
        "descricao": "Descumprir o PDLIE leva a esclarecimento em 5 dias; reincidência pode impedir novos projetos por até 24 meses.",
        "severidade": "alerta",
        "parametros": {
          "meses": 24
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 93"
        }
      },
      {
        "codigo": "expressao_apresenta",
        "descricao": "\"O Governo Federal por meio do Ministério do Esporte via Lei de Incentivo ao Esporte apresenta:\" em primeiro lugar.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Divulgação da LIE, versão defeso (jul/2026)",
          "dispositivo": "p. 14"
        }
      },
      {
        "codigo": "tamanho_minimo",
        "descricao": "Selo de no mínimo 2,3 × 1,6 cm no impresso e 63 × 45 px no digital; uniforme com selo de 8 cm no peito e assinatura de 20 cm nas costas; boné com 5 cm.",
        "severidade": "alerta",
        "parametros": {
          "cmLargura": 2.3,
          "cmAltura": 1.6,
          "px": 63,
          "uniformeCm": 8,
          "costasCm": 20,
          "beneCm": 5
        },
        "fonte": {
          "documento": "Manual de Divulgação da LIE, versão defeso (jul/2026)",
          "dispositivo": "p. 6 e 15 a 18"
        }
      },
      {
        "codigo": "patrocinador_no_titulo",
        "descricao": "Patrocinador no título do projeto só se o MESP aparecer como apresentador em todos os meios; não vale para doador.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 12"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 90 a 94; LC 222/2025, art. 18"
    }
  },
  "envio": {
    "sistema": "SEI (PCP) e protocolo digital (PCF)",
    "descricao": "PCP pelo SEI e PCF por protocolo digital, com o formulário PCP/PCF de 10 abas e o Relatório de Cumprimento do Objeto; o Transferegov não recebe a prestação da LIE.",
    "documentos": [
      {
        "codigo": "rco",
        "descricao": "Relatório de Cumprimento do Objeto (modelo RCO)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, I; art. 68, I"
        }
      },
      {
        "codigo": "recursos_humanos",
        "descricao": "Relação de pessoal contratado (aba RECURSOS HUMANOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, II; art. 68, II"
        }
      },
      {
        "codigo": "beneficiados",
        "descricao": "Relação de beneficiários (aba BENEFICIADOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, III; art. 68, III"
        }
      },
      {
        "codigo": "receita_e_despesa",
        "descricao": "Relatório de receitas e despesas, execução físico-financeira e pagamentos (abas RECEITA E DESPESA, EXECUTADO e PAGAMENTOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, IV; art. 68, IV"
        }
      },
      {
        "codigo": "eventos",
        "descricao": "Calendário de eventos (aba EVENTOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, V; art. 68, XI"
        }
      },
      {
        "codigo": "grade",
        "descricao": "Grade horária das atividades de cada núcleo (aba GRADE)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, VI; art. 68, XII"
        }
      },
      {
        "codigo": "grade_rh",
        "descricao": "Grade horária dos recursos humanos (modelo próprio)",
        "em": [
          "parcial"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, VII"
        }
      },
      {
        "codigo": "divulgacao",
        "descricao": "Comprovação da divulgação (PDLIE) e da execução",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, VIII; art. 68, X"
        }
      },
      {
        "codigo": "fotos_materiais",
        "descricao": "Fotos dos materiais e equipamentos adquiridos",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, IX; art. 68, XIII"
        }
      },
      {
        "codigo": "fotos_reportagens",
        "descricao": "Fotos e reportagens do andamento ou da realização",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, X; art. 68, XIV"
        }
      },
      {
        "codigo": "certidoes",
        "descricao": "Certidões de regularidade fiscal, tributária e trabalhista",
        "em": [
          "parcial"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, XI"
        }
      },
      {
        "codigo": "a_executar",
        "descricao": "Cronograma físico-financeiro a executar (aba A EXECUTAR)",
        "em": [
          "parcial"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "aba A EXECUTAR"
        }
      },
      {
        "codigo": "extratos",
        "descricao": "Extratos das contas CAPTAÇÃO e MOVIMENTO, do recebimento ao último pagamento",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, V"
        }
      },
      {
        "codigo": "rendimentos",
        "descricao": "Demonstrativo de rendimentos das duas contas",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, VI",
          "nota": "O modelo RCO pede o demonstrativo também na PCP."
        }
      },
      {
        "codigo": "gru_ou_transferencia",
        "descricao": "Comprovante de GRU ou do pedido de transferência do saldo",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, VII"
        }
      },
      {
        "codigo": "comprovantes_despesa",
        "descricao": "Cópia dos comprovantes de despesa, com a documentação de compras e contratos",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, VIII"
        }
      },
      {
        "codigo": "bens",
        "descricao": "Relação de bens permanentes adquiridos, produzidos ou construídos (aba BENS ADQUIRIDOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, IX"
        }
      },
      {
        "codigo": "fotos_acessibilidade",
        "descricao": "Fotos que comprovem a acessibilidade nos locais aprovados",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, XV"
        }
      },
      {
        "codigo": "diarias",
        "descricao": "Demonstrativo de diárias e passagens, um por evento (aba DIÁRIAS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "Modelo RCO 2026 (MESP)",
          "dispositivo": "item IV, n"
        }
      }
    ],
    "modelos": [
      {
        "codigo": "formulario_pcp_pcf",
        "nome": "Formulário PCP/PCF 2026 (10 abas)",
        "formato": "xls",
        "arquivo": "lie/formulario-pcp-pcf-2026.xls",
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "abas RECEITA E DESPESA a DIÁRIAS"
        }
      },
      {
        "codigo": "rco",
        "nome": "Relatório de Cumprimento do Objeto 2026",
        "formato": "docx",
        "arquivo": "lie/modelo-rco-2026.docx",
        "fonte": {
          "documento": "Modelo RCO 2026 (MESP)",
          "dispositivo": "seções I a VI"
        }
      },
      {
        "codigo": "carimbos",
        "nome": "Carimbo da nota fiscal (frente e verso)",
        "formato": "doc",
        "arquivo": "lie/modelo-carimbos-2023.doc",
        "fonte": {
          "documento": "Modelo de carimbos (MESP, 2023)",
          "dispositivo": "frente e verso"
        }
      },
      {
        "codigo": "planilha_orcamentaria",
        "nome": "Planilha Orçamentária",
        "formato": "xls",
        "arquivo": "lie/planilha-orcamentaria.xls",
        "fonte": {
          "documento": "Planilha Orçamentária (modelo oficial do MESP)",
          "dispositivo": "aba Planilha Orçamentária"
        }
      },
      {
        "codigo": "planilha_remanejamento",
        "nome": "Planilha de remanejamento e readequação (Modelo I)",
        "formato": "xls",
        "arquivo": "lie/planilha-remanejamento-readequacao.xls",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 54"
        }
      },
      {
        "codigo": "gru",
        "nome": "Orientações para recolhimento ao Tesouro (GRU)",
        "formato": "pdf",
        "arquivo": "lie/orientacoes-recolhimento-tesouro.pdf",
        "fonte": {
          "documento": "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)",
          "dispositivo": "p. 1 a 3"
        }
      }
    ],
    "regras": [
      {
        "codigo": "formularios_obrigatorios",
        "descricao": "Itens I a IV da PCF e I a VII da PCP nos formulários da DPPIE.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, § 1º; art. 68, § 2º"
        }
      },
      {
        "codigo": "marcador_parcial_final",
        "descricao": "Marcador PARCIAL/FINAL coerente em todas as abas que o têm; A EXECUTAR só na PCP.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "células E1/E2, J1/J2, H1/H2, I1/I2, M1/M2, G1/G2 e K1/K2"
        }
      },
      {
        "codigo": "numeracao_do_plano",
        "descricao": "Ações numeradas como no Plano de Trabalho; atividade-meio com prefixo M.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "instruções das abas"
        }
      },
      {
        "codigo": "responsabilidade_do_contador",
        "descricao": "Contador e proponente respondem civil, penal e administrativamente pelas informações.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, § 1º"
        }
      },
      {
        "codigo": "arquivos",
        "descricao": "PDF pesquisável com OCR, até 25 MB, com assinatura manual ou digital válida.",
        "severidade": "alerta",
        "parametros": {
          "mb": 25
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 5º e 6º, §§ 3º e 4º",
          "aConfirmar": true,
          "nota": "Regra escrita para a apresentação do projeto; estendida à prestação por cautela."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 65 a 68"
    }
  },
  "posEnvio": {
    "resultados": [
      {
        "resultado": "aprovada",
        "descricao": "Aplicação regular e avaliação técnica satisfatória.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 79"
        }
      },
      {
        "resultado": "aprovada_ressalvas",
        "descricao": "Contas regulares e avaliação técnica insatisfatória, sem prejuízo ao erário nem descumprimento do objeto.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 79"
        }
      },
      {
        "resultado": "aprovada_parcialmente",
        "descricao": "Avaliação técnica satisfatória, com irregularidades nas contas e prejuízo ao erário.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 79"
        }
      },
      {
        "resultado": "reprovada",
        "descricao": "Contas irregulares no Parecer de Avaliação Final, qualquer que seja o resultado técnico.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 79"
        }
      }
    ],
    "devolucao": {
      "descricao": "GRU paga só no Banco do Brasil: saldo na PCF, reprovação em 45 dias, ressalva por cumprimento parcial em 30 dias e despesa fora da vigência com multa de 5%.",
      "atualizacao": "IN TCU 71/2012, com os índices do TCU; pagamento em atraso com mora, multa e juros calculados pelo MESP.",
      "gru": [
        {
          "unidadeGestora": "180076",
          "gestao": "00001",
          "codigo": "18004-1",
          "referencia": "Número do processo, sem caracteres especiais",
          "fonte": {
            "documento": "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)",
            "dispositivo": "p. 1 a 3",
            "aConfirmar": true,
            "nota": "O exemplo do próprio PDF mostra UG 180002; não há orientação de 2026. UG e código ficam configuráveis."
          }
        }
      ],
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 80 e §§ 3º, 4º e 7º"
      }
    },
    "regras": [
      {
        "codigo": "duas_analises",
        "descricao": "Análise técnica pela DPPIE (objeto, divulgação, acessibilidade) e financeira pela CGPC (Parecer de Avaliação Final).",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 71 a 74"
        }
      },
      {
        "codigo": "diligencia_por_email",
        "descricao": "Diligência por e-mail, com confirmação de recebimento em 1 dia útil; descumprida, leva a arquivamento ou indeferimento.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, § 4º; art. 100"
        }
      },
      {
        "codigo": "pcf_fora_do_prazo",
        "descricao": "PCF fora do prazo: a DPPIE recolhe o saldo e recomenda TCE, o SLI é suspenso e os outros projetos ficam paralisados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 67, §§ 3º e 4º; art. 83; Decreto 12.861/2026, art. 33, § 2º"
        }
      },
      {
        "codigo": "tce",
        "descricao": "TCE por PC não apresentada, inexecução, desvio, despesa impugnada, uso indevido de rendimentos, saldo não devolvido ou falta de documentos; CADIN e envio ao TCU em 180 dias.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 84 e 88"
        }
      },
      {
        "codigo": "prescricao",
        "descricao": "Sanções prescrevem em 5 anos da apresentação da PCF; o ressarcimento não prescreve.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 81"
        }
      },
      {
        "codigo": "multa_vantagem",
        "descricao": "Vantagem indevida: multa de 2 vezes o valor e rescisão com devolução integral.",
        "severidade": "info",
        "fonte": {
          "documento": "LC 222/2025",
          "dispositivo": "arts. 20 e 21; Decreto 12.861/2026, arts. 34 e 35"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 71 a 88"
    }
  },
  "guarda": {
    "marco": "registro_decisao",
    "quantidade": 10,
    "unidade": "anos",
    "prorrogaParaDiaUtil": false,
    "descricao": "Originais na sede, à disposição do MESP e dos órgãos de controle, contados da avaliação da PCF.",
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 46, § 1º, 69, 70 e 77; IN RFB 1.131/2011, art. 36"
    }
  }
}$regime$::jsonb,
  $fontes$[
  {
    "documento": "LC 222/2025 (Planalto)",
    "url": "https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp222.htm"
  },
  {
    "documento": "Decreto 12.861/2026 (Planalto)",
    "url": "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/D12861.htm"
  },
  {
    "documento": "Portaria MESP 10/2026 (DOU de 04/03/2026)",
    "url": "https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578"
  },
  {
    "documento": "Modelos e manuais da LIE (MESP)",
    "url": "https://www.gov.br/esporte/pt-br/acoes-e-programas-1/lei-de-incentivo-ao-esporte/modelos-e-manuais-3"
  }
]$fontes$::jsonb,
  $checklist$[
  {
    "codigo": "rco",
    "descricao": "Relatório de Cumprimento do Objeto (modelo RCO)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, I; art. 68, I"
    }
  },
  {
    "codigo": "recursos_humanos",
    "descricao": "Relação de pessoal contratado (aba RECURSOS HUMANOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, II; art. 68, II"
    }
  },
  {
    "codigo": "beneficiados",
    "descricao": "Relação de beneficiários (aba BENEFICIADOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, III; art. 68, III"
    }
  },
  {
    "codigo": "receita_e_despesa",
    "descricao": "Relatório de receitas e despesas, execução físico-financeira e pagamentos (abas RECEITA E DESPESA, EXECUTADO e PAGAMENTOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, IV; art. 68, IV"
    }
  },
  {
    "codigo": "eventos",
    "descricao": "Calendário de eventos (aba EVENTOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, V; art. 68, XI"
    }
  },
  {
    "codigo": "grade",
    "descricao": "Grade horária das atividades de cada núcleo (aba GRADE)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, VI; art. 68, XII"
    }
  },
  {
    "codigo": "grade_rh",
    "descricao": "Grade horária dos recursos humanos (modelo próprio)",
    "em": [
      "parcial"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, VII"
    }
  },
  {
    "codigo": "divulgacao",
    "descricao": "Comprovação da divulgação (PDLIE) e da execução",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, VIII; art. 68, X"
    }
  },
  {
    "codigo": "fotos_materiais",
    "descricao": "Fotos dos materiais e equipamentos adquiridos",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, IX; art. 68, XIII"
    }
  },
  {
    "codigo": "fotos_reportagens",
    "descricao": "Fotos e reportagens do andamento ou da realização",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, X; art. 68, XIV"
    }
  },
  {
    "codigo": "certidoes",
    "descricao": "Certidões de regularidade fiscal, tributária e trabalhista",
    "em": [
      "parcial"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, XI"
    }
  },
  {
    "codigo": "a_executar",
    "descricao": "Cronograma físico-financeiro a executar (aba A EXECUTAR)",
    "em": [
      "parcial"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
      "dispositivo": "aba A EXECUTAR"
    }
  },
  {
    "codigo": "extratos",
    "descricao": "Extratos das contas CAPTAÇÃO e MOVIMENTO, do recebimento ao último pagamento",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, V"
    }
  },
  {
    "codigo": "rendimentos",
    "descricao": "Demonstrativo de rendimentos das duas contas",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, VI",
      "nota": "O modelo RCO pede o demonstrativo também na PCP."
    }
  },
  {
    "codigo": "gru_ou_transferencia",
    "descricao": "Comprovante de GRU ou do pedido de transferência do saldo",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, VII"
    }
  },
  {
    "codigo": "comprovantes_despesa",
    "descricao": "Cópia dos comprovantes de despesa, com a documentação de compras e contratos",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, VIII"
    }
  },
  {
    "codigo": "bens",
    "descricao": "Relação de bens permanentes adquiridos, produzidos ou construídos (aba BENS ADQUIRIDOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, IX"
    }
  },
  {
    "codigo": "fotos_acessibilidade",
    "descricao": "Fotos que comprovem a acessibilidade nos locais aprovados",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, XV"
    }
  },
  {
    "codigo": "diarias",
    "descricao": "Demonstrativo de diárias e passagens, um por evento (aba DIÁRIAS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "Modelo RCO 2026 (MESP)",
      "dispositivo": "item IV, n"
    }
  }
]$checklist$::jsonb,
  $modelos$[
  {
    "codigo": "formulario_pcp_pcf",
    "nome": "Formulário PCP/PCF 2026 (10 abas)",
    "formato": "xls",
    "arquivo": "lie/formulario-pcp-pcf-2026.xls",
    "fonte": {
      "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
      "dispositivo": "abas RECEITA E DESPESA a DIÁRIAS"
    }
  },
  {
    "codigo": "rco",
    "nome": "Relatório de Cumprimento do Objeto 2026",
    "formato": "docx",
    "arquivo": "lie/modelo-rco-2026.docx",
    "fonte": {
      "documento": "Modelo RCO 2026 (MESP)",
      "dispositivo": "seções I a VI"
    }
  },
  {
    "codigo": "carimbos",
    "nome": "Carimbo da nota fiscal (frente e verso)",
    "formato": "doc",
    "arquivo": "lie/modelo-carimbos-2023.doc",
    "fonte": {
      "documento": "Modelo de carimbos (MESP, 2023)",
      "dispositivo": "frente e verso"
    }
  },
  {
    "codigo": "planilha_orcamentaria",
    "nome": "Planilha Orçamentária",
    "formato": "xls",
    "arquivo": "lie/planilha-orcamentaria.xls",
    "fonte": {
      "documento": "Planilha Orçamentária (modelo oficial do MESP)",
      "dispositivo": "aba Planilha Orçamentária"
    }
  },
  {
    "codigo": "planilha_remanejamento",
    "nome": "Planilha de remanejamento e readequação (Modelo I)",
    "formato": "xls",
    "arquivo": "lie/planilha-remanejamento-readequacao.xls",
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 54"
    }
  },
  {
    "codigo": "gru",
    "nome": "Orientações para recolhimento ao Tesouro (GRU)",
    "formato": "pdf",
    "arquivo": "lie/orientacoes-recolhimento-tesouro.pdf",
    "fonte": {
      "documento": "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)",
      "dispositivo": "p. 1 a 3"
    }
  }
]$modelos$::jsonb,
  now()
)
on conflict (codigo, versao) do nothing;

-- Lei de Incentivo ao Esporte — Portaria 424/2020 (versão 1)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'lie_p424_2020' and versao < 1 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, vigente_ate, status, parametros, fontes, checklist_envio, modelos_saida, publicado_em)
values (
  'lie_p424_2020', 1, 'Lei de Incentivo ao Esporte — Portaria 424/2020', 'esporte', 'esporte',
  'federal', 'Ministério do Esporte', 'SLI', 'LC 222/2025; Portaria MC 424/2020, com as alterações até a Portaria MESP 33/2025',
  '2020-06-23'::date, '2026-03-03'::date, 'publicado',
  $regime${
  "codigo": "lie_p424_2020",
  "versao": 1,
  "nome": "Lei de Incentivo ao Esporte — Portaria 424/2020",
  "area": "esporte",
  "mecanismo": "esporte",
  "esfera": "federal",
  "orgao": "Ministério do Esporte",
  "sistemaOficial": "SLI",
  "normaReferencia": "LC 222/2025; Portaria MC 424/2020, com as alterações até a Portaria MESP 33/2025",
  "vigenteDesde": "2020-06-23",
  "identificadorOficial": {
    "tipo": "sli",
    "rotulo": "Nº do projeto no SLI"
  },
  "fontes": [
    {
      "documento": "Portaria 424/2020 (DOU de 23/06/2020)",
      "url": "https://www.in.gov.br/web/dou/-/portaria-n-424-de-22-de-junho-de-2020-262970445"
    },
    {
      "documento": "Portaria MESP 33/2025 (altera a P424)",
      "url": "https://www.in.gov.br/web/dou/-/portaria-mesp-n-33-de-10-de-abril-de-2025-623708571"
    },
    {
      "documento": "Portaria MESP 10/2026, art. 102 (transição)",
      "url": "https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578"
    },
    {
      "documento": "LC 222/2025 (Planalto)",
      "url": "https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp222.htm"
    }
  ],
  "aplicabilidade": {
    "criterio": "protocolo_projeto",
    "desde": "2020-06-23",
    "ate": "2026-03-03",
    "descricao": "Projetos protocolados no SLI antes de 04/03/2026: análise, acompanhamento e prestação de contas pela P424, observado o normativo vigente no protocolo e a LC 222/2025.",
    "sucede": [],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 102",
      "citacao": "terão sua análise, acompanhamento e prestação de contas regidos pelas disposições nela previstas",
      "aConfirmar": true,
      "nota": "O corte em 03/03/2026 é leitura dos arts. 102 a 104 da P10."
    }
  },
  "prazos": {
    "prestacaoFinal": {
      "descricao": "Apresentar a prestação de contas final (PCF) por protocolo digital",
      "responsavel": "proponente",
      "marco": "fim_vigencia",
      "quantidade": 60,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 67; Decreto 12.861/2026, art. 33",
        "citacao": "Até 60 dias contados do término da vigência do Termo de Compromisso ou do Termo Aditivo",
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Dias corridos, do dia seguinte à cientificação, com prorrogação para o primeiro dia útil (arts. 99 e 101).",
        "aConfirmar": true
      }
    },
    "respostaDiligencia": {
      "descricao": "Suprir documentos ou informações pedidos em diligência da PCF (improrrogável)",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria 424/2020",
        "dispositivo": "art. 72, § 3º"
      }
    },
    "analisePrestacao": {
      "descricao": "Análise técnica e análise financeira da PCF (cada uma)",
      "responsavel": "orgao",
      "marco": "envio_prestacao",
      "quantidade": 360,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria 424/2020, na redação da Portaria MESP 33/2025",
        "dispositivo": "prazo de análise da PCF",
        "aConfirmar": true,
        "nota": "A redação original dava 360 dias para a técnica e 180 para a financeira; a fonte não registra o artigo."
      }
    },
    "analisePrestacaoParcial": {
      "descricao": "Relatório de acompanhamento da prestação parcial (PCP)",
      "responsavel": "orgao",
      "marco": "envio_prestacao",
      "quantidade": 60,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 66",
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O prazo para durante a diligência; a PCP não julga o mérito nem a parte financeira.",
        "aConfirmar": true
      }
    },
    "recurso": {
      "descricao": "Pedido de reconsideração à CGPC, do dia seguinte ao recebimento da decisão",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria 424/2020",
        "dispositivo": "art. 84, § 5º"
      }
    },
    "devolucao": {
      "descricao": "Recolher os valores depois da reprovação, com rendimentos e atualização",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 45,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 80",
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Atualização pela IN TCU 71/2012 (§ 3º); sem recolhimento, TCE.",
        "aConfirmar": true
      }
    },
    "devolucaoRessalva": {
      "descricao": "Recolher os remanescentes na aprovação com ressalva por cumprimento parcial ou no arquivamento",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 80, § 4º",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "transferenciaSaldo": {
      "descricao": "Pedir a transferência do saldo remanescente para outro projeto da entidade",
      "responsavel": "proponente",
      "marco": "fim_vigencia",
      "quantidade": 120,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria 424/2020",
        "dispositivo": "art. 60, § 2º"
      }
    },
    "esclarecimentoDivulgacao": {
      "descricao": "Esclarecer descumprimento do plano de divulgação (PDLIE)",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 5,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 93",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "notificacaoOmissao": {
      "descricao": "Apresentar a PCF ou recolher depois da notificação do DIFE por omissão, sob pena de TCE",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Portaria 424/2020",
        "dispositivo": "art. 71, § 3º"
      }
    }
  },
  "prestacaoParcial": {
    "modalidades": [
      "a_criterio_do_orgao",
      "por_parcela"
    ],
    "descricao": "A PCP é pedida a critério da DPPIE e é obrigatória antes de cada parcela quando a liberação é parcelada; vai pelo SEI, nos formulários da DPPIE.",
    "prazo": "analisePrestacaoParcial",
    "regras": [
      {
        "codigo": "pcp_por_parcela",
        "descricao": "Com liberação parcelada, a PCP do período é condição para a parcela seguinte.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 37; art. 65, § 2º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "pcp_pelo_sei",
        "descricao": "PCP pelo SEI, com nº do processo, nome do projeto e os documentos I a XI; itens I a VII nos formulários da DPPIE.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65 e § 1º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "pcp_sem_merito",
        "descricao": "A análise da PCP não aprova o projeto nem julga a parte financeira, que fica para a PCF.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 66",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 64 a 66; Decreto 12.861/2026, art. 33, § 3º",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "orcamento": {
    "estrutura": {
      "niveis": [
        "Atividade-fim ou atividade-meio",
        "Ação",
        "Item"
      ],
      "descricao": "Orçamento analítico por ação (1, 2...; atividade-meio com prefixo M) e item, cada um com quantidade × duração × valor unitário; elaboração e captação em linha própria, fora da atividade-meio.",
      "fonte": {
        "documento": "Planilha Orçamentária (modelo oficial do MESP)",
        "dispositivo": "colunas A a H e rodapé (H47, H63 a H68)",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "grupos": [
      {
        "codigo": "execucao",
        "rotulo": "Atividade-fim",
        "descricao": "Ações da atividade-fim, inclusive o pessoal indispensável a ela.",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 12, § 1º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "administracao",
        "rotulo": "Atividade-meio",
        "descricao": "Despesas administrativas da atividade-meio, inclusive os encargos delas.",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 12, caput e §§ 1º e 2º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "elaboracao",
        "rotulo": "Elaboração e captação",
        "descricao": "Despesas de produção (elaboração do projeto e captação), fora da atividade-meio.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 26",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "bases": {
      "valor_atividade_fim": {
        "descricao": "Total da atividade-fim, a base que os modelos oficiais usam para os 15% de atividade-meio.",
        "soma": [
          "execucao"
        ],
        "exceto": [],
        "fonte": {
          "documento": "Planilha Orçamentária (modelo oficial do MESP)",
          "dispositivo": "H64 = H63/H47 (\"Porcentagem da Atividade Meio x Fim (Até 15%)\")",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      "valor_projeto": {
        "descricao": "Atividade-fim mais atividade-meio, a base de elaboração e captação.",
        "soma": [
          "execucao",
          "administracao"
        ],
        "exceto": [],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 26 e §§ 1º a 3º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      "valor_total_projeto": {
        "descricao": "Total geral: fim, meio e elaboração e captação.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Planilha Orçamentária (modelo oficial do MESP)",
          "dispositivo": "D68 \"TOTAL GERAL\"",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    },
    "tetos": [
      {
        "codigo": "atividade_meio",
        "descricao": "Despesas administrativas (atividade-meio)",
        "grupos": [
          "administracao"
        ],
        "percentual": 15,
        "base": "valor_atividade_fim",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 12; Planilha Orçamentária, H64",
          "citacao": "ficam limitadas a 15% (quinze por cento) do orçamento total",
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O Decreto fala em orçamento total; os modelos oficiais calculam meio ÷ fim, o critério da área técnica e o mais restritivo.",
          "aConfirmar": true
        }
      },
      {
        "codigo": "elaboracao_captacao",
        "descricao": "Elaboração e captação",
        "grupos": [
          "elaboracao"
        ],
        "percentual": 10,
        "base": "valor_captado",
        "teto": 100000,
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria 424/2020",
          "dispositivo": "art. 26 e § 1º",
          "nota": "Mesmos percentuais por manifestação (educacional 10%, participação 7%, rendimento 5%, N/NE/CO 15%) e teto de R$ 100 mil, sobre o valor efetivamente captado, sem rendimentos."
        }
      }
    ],
    "regras": [
      {
        "codigo": "elaboracao_por_nivel",
        "descricao": "Elaboração e captação até 10% (educacional), 7% (participação), 5% (rendimento) ou 15% (projeto só no N, NE ou CO) do valor efetivamente captado, sem rendimentos, até R$ 100 mil.",
        "severidade": "bloqueio",
        "parametros": {
          "educacional": 10,
          "participacao": 7,
          "rendimento": 5,
          "norteNordesteCentroOeste": 15,
          "teto": 100000
        },
        "fonte": {
          "documento": "Portaria 424/2020",
          "dispositivo": "art. 26 e § 1º"
        }
      },
      {
        "codigo": "sem_valor_fechado",
        "descricao": "Todo item tem quantidade × duração × valor unitário; é proibido lançar valor fechado.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 7º, V",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "encargos_proprios",
        "descricao": "Encargos em item próprio e salário marcado como bruto ou líquido; encargo não autorizado na admissibilidade não entra.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 7º, IX; art. 44, §§ 2º e 3º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "media_de_orcamentos",
        "descricao": "Na proposta, cada despesa até a média de 3 orçamentos ou a tabela de referência.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 7º, § 4º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "receitas_no_orcamento",
        "descricao": "Receitas do projeto (bilheteria, inscrições) entram no orçamento e revertem ao projeto.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 15; Portaria MESP 10/2026, art. 7º, § 3º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "limite_de_captacao",
        "descricao": "Captação por projeto: até R$ 5 milhões (excelência) e R$ 2,5 milhões (toda a vida); formação sem limite; até 6 projetos por ano por CNPJ raiz.",
        "severidade": "info",
        "parametros": {
          "excelencia": 5000000,
          "todaVida": 2500000,
          "projetosPorAno": 6
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 14; Decreto 12.861/2026, art. 23",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ]
  },
  "alteracoes": {
    "janela": {
      "aPartirDe": "assinatura_termo",
      "ate": "fim_execucao",
      "descricao": "Durante a vigência do Termo de Compromisso; a conta movimento só é usada depois da assinatura.",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 20, § 3º; arts. 52 e 53",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "tipos": {
      "remanejamento": {
        "permitido": true,
        "classificacao": "administrativa",
        "condicoes": [
          {
            "tipo": "movido_ate",
            "percentual": 20,
            "base": "valor_total_projeto",
            "acumulado": false,
            "descricao": "Move até 20%, em qualquer um dos dois pedidos, comunicando em 5 dias.",
            "fonte": {
              "documento": "Portaria 424/2020, na redação da Portaria MESP 33/2025",
              "dispositivo": "art. 57"
            }
          },
          {
            "tipo": "mantem_grupos",
            "grupos": [
              "elaboracao"
            ],
            "descricao": "Não muda o valor de elaboração e captação, que exige aprovação prévia.",
            "fonte": {
              "documento": "Portaria 424/2020, na redação da Portaria MESP 33/2025",
              "dispositivo": "art. 57"
            }
          }
        ],
        "requisitos": [
          {
            "tipo": "maximo_pedidos",
            "quantidade": 2,
            "severidade": "bloqueio",
            "descricao": "Até dois remanejamentos.",
            "fonte": {
              "documento": "Portaria 424/2020, na redação da Portaria MESP 33/2025",
              "dispositivo": "art. 57"
            }
          },
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "O remanejamento respeita os 15% de atividade-meio.",
            "fonte": {
              "documento": "Portaria 424/2020, na redação da Portaria MESP 33/2025",
              "dispositivo": "art. 57"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "comunicar_em_5_dias",
            "descricao": "Feito sem anuência, comunique em 5 dias.",
            "severidade": "alerta",
            "parametros": {
              "dias": 5
            },
            "fonte": {
              "documento": "Portaria 424/2020, na redação da Portaria MESP 33/2025",
              "dispositivo": "art. 57"
            }
          },
          {
            "codigo": "tres_orcamentos",
            "descricao": "Se o valor unitário de um item subir, junte 3 orçamentos novos.",
            "severidade": "alerta",
            "fonte": {
              "documento": "Tutorial de remanejamento e readequação (MESP, 2023)",
              "dispositivo": "valor unitário"
            }
          }
        ],
        "fonte": {
          "documento": "Portaria 424/2020, na redação da Portaria MESP 33/2025",
          "dispositivo": "art. 57"
        }
      },
      "complementacao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "maximo_pedidos",
            "quantidade": 1,
            "severidade": "bloqueio",
            "descricao": "Uma única readequação.",
            "fonte": {
              "documento": "Tutorial de remanejamento e readequação (MESP, 2023)",
              "dispositivo": "art. 57-A, § 1º (citado)",
              "aConfirmar": true
            }
          },
          {
            "tipo": "antecedencia",
            "quantidade": 60,
            "unidade": "dias_corridos",
            "severidade": "alerta",
            "descricao": "Pedido até 60 dias antes do fim do Termo.",
            "fonte": {
              "documento": "Tutorial de remanejamento e readequação (MESP, 2023)",
              "dispositivo": "art. 57-A, § 1º (citado)",
              "aConfirmar": true,
              "nota": "Não foi achado no DOU o ato que incluiu o art. 57-A."
            }
          },
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "A readequação respeita os tetos.",
            "fonte": {
              "documento": "Portaria 424/2020",
              "dispositivo": "art. 26; art. 57"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "termo_aditivo",
            "descricao": "Depende de parecer técnico e da CTLIE, e é formalizada por Termo Aditivo assinado antes do fim do Termo.",
            "severidade": "info",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 53",
              "aConfirmar": true,
              "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
            }
          },
          {
            "codigo": "sem_item_nao_autorizado",
            "descricao": "É proibido incluir item que não foi autorizado.",
            "severidade": "alerta",
            "fonte": {
              "documento": "Portaria MESP 10/2026",
              "dispositivo": "art. 53",
              "aConfirmar": true,
              "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
            }
          }
        ],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 53",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      "reducao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Depois da redução, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "Decreto 12.861/2026",
              "dispositivo": "art. 12",
              "aConfirmar": true,
              "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 43",
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. A P10 não trata de redução; qualquer outra alteração do plano de trabalho depende de autorização prévia da DPPIE.",
          "aConfirmar": true
        }
      },
      "inclusao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Com o item novo, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "Decreto 12.861/2026",
              "dispositivo": "art. 12",
              "aConfirmar": true,
              "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 43; art. 52, § 3º",
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O remanejamento só mexe em itens já previstos; item novo é alteração do plano de trabalho.",
          "aConfirmar": true
        }
      }
    },
    "alertasPorItem": [],
    "prazoAnalise": null,
    "silencioAprova": false,
    "regras": [
      {
        "codigo": "local_de_execucao",
        "descricao": "O local de execução só muda com anuência prévia; sem ela, é inexecução.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 42",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "outra_alteracao",
        "descricao": "Qualquer outra alteração do plano de trabalho precisa de autorização prévia da DPPIE.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 43",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "prorrogacao",
        "descricao": "Prorrogação pedida até 30 dias antes do fim do Termo, no máximo duas, cada uma por Termo Aditivo assinado antes do vencimento.",
        "severidade": "alerta",
        "parametros": {
          "diasAntes": 30,
          "maximo": 2
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 56",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "uso_de_rendimentos",
        "descricao": "Usar a aplicação financeira pede pedido formal com o valor exato a sair da conta captação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 55",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 42 a 56",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "fornecedores": {
    "limites": [],
    "partesRelacionadas": {
      "descricao": "Patrocínio ou doação a projeto que beneficie pessoa vinculada ao incentivador não é dedutível; membros da entidade só recebem por função específica aprovada.",
      "fonte": {
        "documento": "LC 222/2025",
        "dispositivo": "art. 3º, § 2º, e art. 5º; Decreto 12.861/2026, art. 2º, §§ 5º e 6º; Portaria MESP 10/2026, art. 58, V",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "regras": [
      {
        "codigo": "credor_ligado_ao_incentivador",
        "descricao": "Credor ligado ao incentivador (sócio, parente até o 3º grau, coligada) gera alerta.",
        "severidade": "alerta",
        "fonte": {
          "documento": "LC 222/2025",
          "dispositivo": "art. 5º; Decreto 12.861/2026, art. 2º, §§ 5º e 6º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "intermediacao",
        "descricao": "É vedado transferir a execução do objeto a terceiros; a sanção é a rescisão do Termo.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 13; Portaria MESP 10/2026, art. 59, III",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "subcontratacao",
        "descricao": "Subcontratação só de atividade acessória prevista no plano, sob supervisão direta; nunca gestão, coordenação ou direção.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 13, §§ 3º e 6º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "contratacao_de_pessoal",
        "descricao": "Pessoal por RPA, CLT ou PJ especializada não exclusiva, com remuneração pela pesquisa de mercado ou pela tabela de referência da DPPIE.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 44 e § 1º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 44, 58 e 59",
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. A LIE não fixa limite percentual por fornecedor nem por parte relacionada.",
      "aConfirmar": true
    }
  },
  "contas": {
    "contas": [
      {
        "tipo": "captacao",
        "descricao": "Conta CAPTAÇÃO, bloqueada, só para os aportes dos incentivadores",
        "abertaPor": "orgao"
      },
      {
        "tipo": "movimento",
        "descricao": "Conta MOVIMENTO, sob a gerência do MESP, usada depois do Termo de Compromisso",
        "abertaPor": "orgao"
      }
    ],
    "bancos": [
      "Banco do Brasil",
      "Caixa Econômica Federal"
    ],
    "descricao": "Duas contas abertas pela DPPIE em nome do proponente, exclusivas do projeto; só conta como incentivo o que foi depositado na CAPTAÇÃO.",
    "tarifas": {
      "regra": "norma_silente",
      "descricao": "A LC, o Decreto, a Portaria e os modelos não dizem se tarifa bancária é despesa elegível.",
      "fonte": {
        "documento": "LC 222/2025, Decreto 12.861/2026 e Portaria MESP 10/2026",
        "dispositivo": "texto integral, sem regra sobre tarifas",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "liberacao": {
      "descricao": "Da CAPTAÇÃO para a MOVIMENTO, integral ou em parcelas, conforme a DPPIE, depois do Termo de Compromisso; cada parcela nova depende da PCP.",
      "percentualMinimo": null,
      "base": null,
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 20, § 3º; art. 37; art. 65, § 2º",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "rendimentos": {
      "aplicacao": "obrigatoria",
      "contamComoCaptado": false,
      "uso": "Poupança se o uso for em um mês ou mais, fundo de curto prazo se em menos; rendimentos não pagam despesa administrativa, elaboração e captação nem pessoal sem autorização.",
      "fonte": {
        "documento": "Portaria 424/2020",
        "dispositivo": "art. 29, §§ 1º a 3º"
      }
    },
    "saldo": {
      "descricao": "Transferência do saldo para outro projeto da entidade em até 120 dias; senão, GRU.",
      "prazo": "transferenciaSaldo",
      "fonte": {
        "documento": "Portaria 424/2020",
        "dispositivo": "art. 60, § 2º"
      }
    },
    "regras": [
      {
        "codigo": "conta_exclusiva",
        "descricao": "Conta exclusiva do projeto, por onde circulam todos os recursos captados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "arts. 30 e 31, §§ 1º a 3º; LC 222/2025, art. 11",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "captar_acima",
        "descricao": "É proibido captar mais que o autorizado; o excedente vai ao Tesouro.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "LC 222/2025",
          "dispositivo": "art. 10, parágrafo único; Portaria MESP 10/2026, art. 22, § 2º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "estorno",
        "descricao": "Depósito feito por engano: estorno ou correção em até 60 dias do depósito, senão GRU.",
        "severidade": "alerta",
        "parametros": {
          "dias": 60
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 23 e 25",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "bloqueio_judicial",
        "descricao": "Bloqueio judicial é informado de imediato, sob pena de arquivamento; a reposição cabe ao proponente.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 20, §§ 7º e 8º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "autorizacao_ao_banco",
        "descricao": "Autorização irrevogável ao banco para cumprir as determinações da DPPIE.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 20, § 1º; art. 21",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "recibo_aprovado",
        "descricao": "Recibo de captação em 3 vias; o DIFE aprova o recibo e só então o recurso é liberado; captação informada em 3 dias úteis.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria 424/2020",
          "dispositivo": "art. 27"
        }
      },
      {
        "codigo": "extratos_mensais",
        "descricao": "Extratos mensais das contas.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria 424/2020",
          "dispositivo": "art. 21, § 6º"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 20 a 28",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "pagamentos": {
    "meiosPermitidos": null,
    "meiosVedados": [
      "saque"
    ],
    "descricao": "Qualquer operação bancária autorizada pelo Banco Central que identifique a destinação e o credor; saque em dinheiro é proibido em qualquer hipótese.",
    "documentoFiscal": [
      {
        "codigo": "em_nome_da_entidade",
        "descricao": "Comprovantes emitidos única e exclusivamente em nome da entidade proponente.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 41",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "numero_sli",
        "descricao": "Número do projeto no SLI em todos os comprovantes de despesa.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 41, § 1º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "carimbo_e_atesto",
        "descricao": "Carimbo na frente da nota (Nº SLI, Ministério do Esporte) e atesto de recebimento no verso, com data e assinatura.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Modelo de carimbos (MESP, 2023)",
          "dispositivo": "frente e verso; Portaria MESP 10/2026, art. 49, III",
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O carimbo publicado ainda cita a Lei 11.438/2006, revogada; o texto da lei fica configurável.",
          "aConfirmar": true
        }
      },
      {
        "codigo": "nota_discriminada",
        "descricao": "Nota, fatura ou recibo discriminando o serviço ou produto, guardados frente e verso.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 78",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "recibo_de_diarias",
        "descricao": "Diárias comprovadas por recibo assinado pelo usuário, com identificação e CPF.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 41, § 2º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "retencoes",
        "descricao": "Pagamento a pessoa física com IR, INSS e ISS retidos e recolhidos.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 76; Formulário PCP/PCF, aba PAGAMENTOS, instrução 5",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "traducao",
        "descricao": "Documento em língua estrangeira com tradução juramentada.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 98",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "regras": [
      {
        "codigo": "um_comprovante_por_debito",
        "descricao": "Cada débito na conta MOVIMENTO tem um comprovante.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 39",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "ate_o_aprovado",
        "descricao": "Compra ou contratação sem novos orçamentos até o valor aprovado por item ou ação; acima, remanejamento.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 46",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "processo_de_compra",
        "descricao": "Cada compra com cotação ou justificativa, escolha do fornecedor e do preço, comprovante de recebimento e documento contábil.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 49",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "contrato",
        "descricao": "Contrato com objeto, regime, prazos, preço, pagamento, reajuste, direitos e multas, início e fim.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 50",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "pregao",
        "descricao": "Entidade pública segue a Lei 14.133, com pregão para bens e serviços comuns.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 51",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 38 e 39",
      "citacao": "Saque em dinheiro é proibido em qualquer hipótese",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "despesas": {
    "periodo": {
      "descricao": "Da assinatura do Termo de Compromisso ao fim da vigência; despesa fora dela é ressarcida (sem a multa de 5% da P10).",
      "fonte": {
        "documento": "Portaria 424/2020",
        "dispositivo": "art. 46"
      }
    },
    "vedadas": [
      {
        "codigo": "taxa_administracao",
        "descricao": "Taxa de administração, de gerência ou similar",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, I",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "agente_publico",
        "descricao": "Pagamento a agente público da ativa por serviço, inclusive consultoria",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, II",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "clube_de_servidores",
        "descricao": "Despesa em favor de clubes ou associações de servidores públicos",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, III",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "vantagem_ao_patrocinador",
        "descricao": "Despesa que gere vantagem financeira ou material ao patrocinador",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, IV; Decreto 12.861/2026, art. 34, I; LC 222/2025, art. 20, I",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "membros_da_entidade",
        "descricao": "Despesa em benefício de membros da entidade, salvo função específica aprovada",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, V",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "imovel",
        "descricao": "Compra de imóvel",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 58, VI",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "atleta_profissional",
        "descricao": "Remuneração de atleta profissional",
        "fonte": {
          "documento": "LC 222/2025",
          "dispositivo": "art. 6º, § 2º; Decreto 12.861/2026, art. 6º; Portaria MESP 10/2026, art. 59, I",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "equipe_profissional",
        "descricao": "Manutenção ou organização de equipes profissionais de alto rendimento e de competições profissionais",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 6º, § 2º; Portaria MESP 10/2026, art. 59, II",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "espaco_publicitario",
        "descricao": "Compra de espaço publicitário em qualquer meio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 14",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "cobranca_de_beneficiarios",
        "descricao": "Cobrar qualquer valor dos beneficiários em projeto de atividade regular",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 16",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "so_manutencao",
        "descricao": "Projeto só de despesas administrativas de manutenção da entidade",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 32, I",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "beneficio_de_convencao",
        "descricao": "Benefícios de convenção coletiva não aprovados na admissibilidade",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 44, § 4º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "regras": [
      {
        "codigo": "pessoal_na_vigencia",
        "descricao": "Remuneração de pessoal limitada ao período de vigência, segregada no plano e aprovada antes.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 45",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "bolsa_auxilio",
        "descricao": "Bolsa auxílio só para beneficiários do nível excelência.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 13",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "crc_excelencia",
        "descricao": "No nível excelência, CRC válida durante toda a execução; vencida, 30 dias para a nova, senão pagamentos suspensos e ressarcimento.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 31",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "tabela_de_referencia",
        "descricao": "Remuneração e diárias pela tabela de referência da DPPIE (a publicada é de 2020).",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 44, § 1º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Não se sabe se as tabelas de 2020 continuam a referência vigente."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 40, 58 e 59",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "porte": {
    "lacuna": "nao_se_aplica",
    "motivo": "A LIE não classifica projetos por porte. O que muda regras é o nível da manifestação esportiva (formação, toda a vida, excelência), que define o limite de elaboração e captação e o de captação por projeto.",
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 14 e 26",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "objeto": {
    "descricao": "Relatório de Cumprimento do Objeto (RCO) com metas qualitativas e quantitativas da ATO, indicadores, instrumentos de verificação e percentual de atingimento; beneficiados, grade de atividades, eventos e fotos, inclusive de acessibilidade.",
    "regras": [
      {
        "codigo": "metas_da_ato",
        "descricao": "As metas são as aprovadas na Análise Técnica e Orçamentária; não as altere no relatório.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Modelo RCO 2026 (MESP)",
          "dispositivo": "seção III",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "percentual_de_atingimento",
        "descricao": "Cada meta com indicador, instrumento de verificação, resultado e percentual de atingimento.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Modelo RCO 2026 (MESP)",
          "dispositivo": "seção III",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "rede_publica",
        "descricao": "Na formação esportiva regular, ao menos 50% de alunos da rede pública.",
        "severidade": "bloqueio",
        "parametros": {
          "percentual": 50
        },
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 18",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "acessibilidade",
        "descricao": "Acessibilidade para idosos e pessoas com deficiência, com fotos nos locais aprovados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 17; Portaria MESP 10/2026, arts. 11 e 68, XV",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "beneficiados",
        "descricao": "Relação de beneficiados, com total feminino e masculino igual ao número listado.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "aba BENEFICIADOS",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "ingressos_nao_distribuidos",
        "descricao": "O valor de ingressos não distribuídos (doação do tipo b) é restituído na PCF.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 11, § 2º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "receitas_revertidas",
        "descricao": "Inscrições e outras receitas revertidas integralmente ao projeto e mostradas no relatório de receita e despesa.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, § 5º; art. 7º, § 3º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "avaliacao_de_resultados",
        "descricao": "O MESP verifica resultados, custos estimados × reais e repercussão, e pode usar peritos.",
        "severidade": "info",
        "fonte": {
          "documento": "Decreto 12.861/2026",
          "dispositivo": "art. 32",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "visita_tecnica",
        "descricao": "Visita técnica, presencial ou virtual, a qualquer tempo.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 61 e 62",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 65 e 68",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "divulgacao": {
    "marcas": [
      "Selo da Lei de Incentivo ao Esporte",
      "Ministério do Esporte",
      "Governo Federal",
      "Bandeira Nacional"
    ],
    "aprovacaoPrevia": {
      "exigida": true,
      "prazo": null,
      "silencioAprova": false,
      "descricao": "O plano de divulgação (PDLIE) é aprovado pela ASCOM antes do Termo de Compromisso, e as peças finalizadas vão à ASCOM por e-mail, em PDF ou JPG, nomeadas pela peça.",
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 35, I; art. 91, § 4º; modelo PDLIE 2026",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "defeso": {
      "descricao": "De 04/07/2026 ao primeiro turno (04/10) ou ao segundo (25/10): sem a marca do Governo Federal; a assinatura é o selo LIE, \"MINISTÉRIO DO ESPORTE\" e a Bandeira.",
      "fonte": {
        "documento": "Manual de assinatura no período eleitoral (SICOM, jun/2026)",
        "dispositivo": "p. 2 a 6; Manual de Divulgação da LIE, versão defeso",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Nenhuma norma da DPPIE trata da análise do PDLIE no defeso; é leitura dos dois manuais."
      }
    },
    "regras": [
      {
        "codigo": "exposicao_equivalente",
        "descricao": "Selo e marca do Governo Federal com exposição equivalente à do maior patrocinador.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 90, § 2º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "selo_a_cada_insercao",
        "descricao": "Para cada inserção de nome, marca ou produto de patrocinador, o selo LIE e as marcas do MESP e do Governo Federal com igual exposição.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 92",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "marcas_sem_distorcao",
        "descricao": "Proibido distorcer marcas, alterar cores ou posições e desobedecer a proporção.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 93",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "comprovacao",
        "descricao": "Comprovação da divulgação por fotos, filmagens, gravações e peças.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 94",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "reincidencia",
        "descricao": "Descumprir o PDLIE leva a esclarecimento em 5 dias; reincidência pode impedir novos projetos por até 24 meses.",
        "severidade": "alerta",
        "parametros": {
          "meses": 24
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 93",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "expressao_apresenta",
        "descricao": "\"O Governo Federal por meio do Ministério do Esporte via Lei de Incentivo ao Esporte apresenta:\" em primeiro lugar.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Divulgação da LIE, versão defeso (jul/2026)",
          "dispositivo": "p. 14",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "tamanho_minimo",
        "descricao": "Selo de no mínimo 2,3 × 1,6 cm no impresso e 63 × 45 px no digital; uniforme com selo de 8 cm no peito e assinatura de 20 cm nas costas; boné com 5 cm.",
        "severidade": "alerta",
        "parametros": {
          "cmLargura": 2.3,
          "cmAltura": 1.6,
          "px": 63,
          "uniformeCm": 8,
          "costasCm": 20,
          "beneCm": 5
        },
        "fonte": {
          "documento": "Manual de Divulgação da LIE, versão defeso (jul/2026)",
          "dispositivo": "p. 6 e 15 a 18",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "patrocinador_no_titulo",
        "descricao": "Patrocinador no título do projeto só se o MESP aparecer como apresentador em todos os meios; não vale para doador.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 12",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 90 a 94; LC 222/2025, art. 18",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "envio": {
    "sistema": "Sistema eletrônico, remessa postal ou e-mail",
    "descricao": "PCF com as peças do art. 72 (13 incisos) por sistema eletrônico, remessa postal ou e-mail; os modelos oficiais são os mesmos da P10.",
    "documentos": [
      {
        "codigo": "rco",
        "descricao": "Relatório de Cumprimento do Objeto (modelo RCO)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, I; art. 68, I",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "recursos_humanos",
        "descricao": "Relação de pessoal contratado (aba RECURSOS HUMANOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, II; art. 68, II",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "beneficiados",
        "descricao": "Relação de beneficiários (aba BENEFICIADOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, III; art. 68, III",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "receita_e_despesa",
        "descricao": "Relatório de receitas e despesas, execução físico-financeira e pagamentos (abas RECEITA E DESPESA, EXECUTADO e PAGAMENTOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, IV; art. 68, IV",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "eventos",
        "descricao": "Calendário de eventos (aba EVENTOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, V; art. 68, XI",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "grade",
        "descricao": "Grade horária das atividades de cada núcleo (aba GRADE)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, VI; art. 68, XII",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "grade_rh",
        "descricao": "Grade horária dos recursos humanos (modelo próprio)",
        "em": [
          "parcial"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, VII",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "divulgacao",
        "descricao": "Comprovação da divulgação (PDLIE) e da execução",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, VIII; art. 68, X",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "fotos_materiais",
        "descricao": "Fotos dos materiais e equipamentos adquiridos",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, IX; art. 68, XIII",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "fotos_reportagens",
        "descricao": "Fotos e reportagens do andamento ou da realização",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, X; art. 68, XIV",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "certidoes",
        "descricao": "Certidões de regularidade fiscal, tributária e trabalhista",
        "em": [
          "parcial"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, XI",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "a_executar",
        "descricao": "Cronograma físico-financeiro a executar (aba A EXECUTAR)",
        "em": [
          "parcial"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "aba A EXECUTAR",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "extratos",
        "descricao": "Extratos das contas CAPTAÇÃO e MOVIMENTO, do recebimento ao último pagamento",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, V",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "rendimentos",
        "descricao": "Demonstrativo de rendimentos das duas contas",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, VI",
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O modelo RCO pede o demonstrativo também na PCP.",
          "aConfirmar": true
        }
      },
      {
        "codigo": "gru_ou_transferencia",
        "descricao": "Comprovante de GRU ou do pedido de transferência do saldo",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, VII",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "comprovantes_despesa",
        "descricao": "Cópia dos comprovantes de despesa, com a documentação de compras e contratos",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, VIII",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "bens",
        "descricao": "Relação de bens permanentes adquiridos, produzidos ou construídos (aba BENS ADQUIRIDOS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, IX",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "diarias",
        "descricao": "Demonstrativo de diárias e passagens, um por evento (aba DIÁRIAS)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "Modelo RCO 2026 (MESP)",
          "dispositivo": "item IV, n",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "modelos": [
      {
        "codigo": "formulario_pcp_pcf",
        "nome": "Formulário PCP/PCF 2026 (10 abas)",
        "formato": "xls",
        "arquivo": "lie/formulario-pcp-pcf-2026.xls",
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "abas RECEITA E DESPESA a DIÁRIAS",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "rco",
        "nome": "Relatório de Cumprimento do Objeto 2026",
        "formato": "docx",
        "arquivo": "lie/modelo-rco-2026.docx",
        "fonte": {
          "documento": "Modelo RCO 2026 (MESP)",
          "dispositivo": "seções I a VI",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "carimbos",
        "nome": "Carimbo da nota fiscal (frente e verso)",
        "formato": "doc",
        "arquivo": "lie/modelo-carimbos-2023.doc",
        "fonte": {
          "documento": "Modelo de carimbos (MESP, 2023)",
          "dispositivo": "frente e verso",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "planilha_orcamentaria",
        "nome": "Planilha Orçamentária",
        "formato": "xls",
        "arquivo": "lie/planilha-orcamentaria.xls",
        "fonte": {
          "documento": "Planilha Orçamentária (modelo oficial do MESP)",
          "dispositivo": "aba Planilha Orçamentária",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "planilha_remanejamento",
        "nome": "Planilha de remanejamento e readequação (Modelo I)",
        "formato": "xls",
        "arquivo": "lie/planilha-remanejamento-readequacao.xls",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 54",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "gru",
        "nome": "Orientações para recolhimento ao Tesouro (GRU)",
        "formato": "pdf",
        "arquivo": "lie/orientacoes-recolhimento-tesouro.pdf",
        "fonte": {
          "documento": "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)",
          "dispositivo": "p. 1 a 3",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "regras": [
      {
        "codigo": "formularios_obrigatorios",
        "descricao": "Itens I a IV da PCF e I a VII da PCP nos formulários da DPPIE.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 65, § 1º; art. 68, § 2º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "marcador_parcial_final",
        "descricao": "Marcador PARCIAL/FINAL coerente em todas as abas que o têm; A EXECUTAR só na PCP.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "células E1/E2, J1/J2, H1/H2, I1/I2, M1/M2, G1/G2 e K1/K2",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "numeracao_do_plano",
        "descricao": "Ações numeradas como no Plano de Trabalho; atividade-meio com prefixo M.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
          "dispositivo": "instruções das abas",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "responsabilidade_do_contador",
        "descricao": "Contador e proponente respondem civil, penal e administrativamente pelas informações.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, § 1º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "arquivos",
        "descricao": "PDF pesquisável com OCR, até 25 MB, com assinatura manual ou digital válida.",
        "severidade": "alerta",
        "parametros": {
          "mb": 25
        },
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 5º e 6º, §§ 3º e 4º",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. Regra escrita para a apresentação do projeto; estendida à prestação por cautela."
        }
      }
    ],
    "fonte": {
      "documento": "Portaria 424/2020",
      "dispositivo": "arts. 69, 71 e 72"
    }
  },
  "posEnvio": {
    "resultados": [
      {
        "resultado": "aprovada",
        "descricao": "Aplicação regular e avaliação técnica satisfatória.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 79",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "resultado": "aprovada_ressalvas",
        "descricao": "Contas regulares e avaliação técnica insatisfatória, sem prejuízo ao erário nem descumprimento do objeto.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 79",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "resultado": "aprovada_parcialmente",
        "descricao": "Avaliação técnica satisfatória, com irregularidades nas contas e prejuízo ao erário.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 79",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "resultado": "reprovada",
        "descricao": "Contas irregulares no Parecer de Avaliação Final, qualquer que seja o resultado técnico.",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 79",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      }
    ],
    "devolucao": {
      "descricao": "GRU paga só no Banco do Brasil: saldo na PCF, reprovação em 45 dias, ressalva por cumprimento parcial em 30 dias e despesa fora da vigência com multa de 5%.",
      "atualizacao": "IN TCU 71/2012, com os índices do TCU; pagamento em atraso com mora, multa e juros calculados pelo MESP.",
      "gru": [
        {
          "unidadeGestora": "180076",
          "gestao": "00001",
          "codigo": "18004-1",
          "referencia": "Número do processo, sem caracteres especiais",
          "fonte": {
            "documento": "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)",
            "dispositivo": "p. 1 a 3",
            "aConfirmar": true,
            "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O exemplo do próprio PDF mostra UG 180002; não há orientação de 2026. UG e código ficam configuráveis."
          }
        }
      ],
      "fonte": {
        "documento": "Portaria MESP 10/2026",
        "dispositivo": "art. 80 e §§ 3º, 4º e 7º",
        "aConfirmar": true,
        "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
      }
    },
    "regras": [
      {
        "codigo": "duas_analises",
        "descricao": "Análise técnica pela DPPIE (objeto, divulgação, acessibilidade) e financeira pela CGPC (Parecer de Avaliação Final).",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 71 a 74",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "diligencia_por_email",
        "descricao": "Diligência por e-mail, com confirmação de recebimento em 1 dia útil; descumprida, leva a arquivamento ou indeferimento.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 68, § 4º; art. 100",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "tce",
        "descricao": "TCE por PC não apresentada, inexecução, desvio, despesa impugnada, uso indevido de rendimentos, saldo não devolvido ou falta de documentos; CADIN e envio ao TCU em 180 dias.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "arts. 84 e 88",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "prescricao",
        "descricao": "Sanções prescrevem em 5 anos da apresentação da PCF; o ressarcimento não prescreve.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria MESP 10/2026",
          "dispositivo": "art. 81",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "multa_vantagem",
        "descricao": "Vantagem indevida: multa de 2 vezes o valor e rescisão com devolução integral.",
        "severidade": "info",
        "fonte": {
          "documento": "LC 222/2025",
          "dispositivo": "arts. 20 e 21; Decreto 12.861/2026, arts. 34 e 35",
          "aConfirmar": true,
          "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
        }
      },
      {
        "codigo": "pcf_fora_do_prazo",
        "descricao": "PCF não apresentada: o DIFE dá 30 dias para apresentar ou recolher, sob pena de TCE.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria 424/2020",
          "dispositivo": "art. 71, § 3º"
        }
      }
    ],
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 71 a 88",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  "guarda": {
    "marco": "registro_decisao",
    "quantidade": 10,
    "unidade": "anos",
    "prorrogaParaDiaUtil": false,
    "descricao": "Originais na sede, à disposição do MESP e dos órgãos de controle, contados da avaliação da PCF.",
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "arts. 46, § 1º, 69, 70 e 77; IN RFB 1.131/2011, art. 36",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  }
}$regime$::jsonb,
  $fontes$[
  {
    "documento": "Portaria 424/2020 (DOU de 23/06/2020)",
    "url": "https://www.in.gov.br/web/dou/-/portaria-n-424-de-22-de-junho-de-2020-262970445"
  },
  {
    "documento": "Portaria MESP 33/2025 (altera a P424)",
    "url": "https://www.in.gov.br/web/dou/-/portaria-mesp-n-33-de-10-de-abril-de-2025-623708571"
  },
  {
    "documento": "Portaria MESP 10/2026, art. 102 (transição)",
    "url": "https://www.in.gov.br/web/dou/-/portaria-mesp-n-10-de-3-de-marco-de-2026-690209578"
  },
  {
    "documento": "LC 222/2025 (Planalto)",
    "url": "https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp222.htm"
  }
]$fontes$::jsonb,
  $checklist$[
  {
    "codigo": "rco",
    "descricao": "Relatório de Cumprimento do Objeto (modelo RCO)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, I; art. 68, I",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "recursos_humanos",
    "descricao": "Relação de pessoal contratado (aba RECURSOS HUMANOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, II; art. 68, II",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "beneficiados",
    "descricao": "Relação de beneficiários (aba BENEFICIADOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, III; art. 68, III",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "receita_e_despesa",
    "descricao": "Relatório de receitas e despesas, execução físico-financeira e pagamentos (abas RECEITA E DESPESA, EXECUTADO e PAGAMENTOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, IV; art. 68, IV",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "eventos",
    "descricao": "Calendário de eventos (aba EVENTOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, V; art. 68, XI",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "grade",
    "descricao": "Grade horária das atividades de cada núcleo (aba GRADE)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, VI; art. 68, XII",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "grade_rh",
    "descricao": "Grade horária dos recursos humanos (modelo próprio)",
    "em": [
      "parcial"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, VII",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "divulgacao",
    "descricao": "Comprovação da divulgação (PDLIE) e da execução",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, VIII; art. 68, X",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "fotos_materiais",
    "descricao": "Fotos dos materiais e equipamentos adquiridos",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, IX; art. 68, XIII",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "fotos_reportagens",
    "descricao": "Fotos e reportagens do andamento ou da realização",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, X; art. 68, XIV",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "certidoes",
    "descricao": "Certidões de regularidade fiscal, tributária e trabalhista",
    "em": [
      "parcial"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 65, XI",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "a_executar",
    "descricao": "Cronograma físico-financeiro a executar (aba A EXECUTAR)",
    "em": [
      "parcial"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
      "dispositivo": "aba A EXECUTAR",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "extratos",
    "descricao": "Extratos das contas CAPTAÇÃO e MOVIMENTO, do recebimento ao último pagamento",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, V",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "rendimentos",
    "descricao": "Demonstrativo de rendimentos das duas contas",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, VI",
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido. O modelo RCO pede o demonstrativo também na PCP.",
      "aConfirmar": true
    }
  },
  {
    "codigo": "gru_ou_transferencia",
    "descricao": "Comprovante de GRU ou do pedido de transferência do saldo",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, VII",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "comprovantes_despesa",
    "descricao": "Cópia dos comprovantes de despesa, com a documentação de compras e contratos",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, VIII",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "bens",
    "descricao": "Relação de bens permanentes adquiridos, produzidos ou construídos (aba BENS ADQUIRIDOS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 68, IX",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "diarias",
    "descricao": "Demonstrativo de diárias e passagens, um por evento (aba DIÁRIAS)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "Modelo RCO 2026 (MESP)",
      "dispositivo": "item IV, n",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  }
]$checklist$::jsonb,
  $modelos$[
  {
    "codigo": "formulario_pcp_pcf",
    "nome": "Formulário PCP/PCF 2026 (10 abas)",
    "formato": "xls",
    "arquivo": "lie/formulario-pcp-pcf-2026.xls",
    "fonte": {
      "documento": "Formulário PCP/PCF 2026 (modelo oficial do MESP)",
      "dispositivo": "abas RECEITA E DESPESA a DIÁRIAS",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "rco",
    "nome": "Relatório de Cumprimento do Objeto 2026",
    "formato": "docx",
    "arquivo": "lie/modelo-rco-2026.docx",
    "fonte": {
      "documento": "Modelo RCO 2026 (MESP)",
      "dispositivo": "seções I a VI",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "carimbos",
    "nome": "Carimbo da nota fiscal (frente e verso)",
    "formato": "doc",
    "arquivo": "lie/modelo-carimbos-2023.doc",
    "fonte": {
      "documento": "Modelo de carimbos (MESP, 2023)",
      "dispositivo": "frente e verso",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "planilha_orcamentaria",
    "nome": "Planilha Orçamentária",
    "formato": "xls",
    "arquivo": "lie/planilha-orcamentaria.xls",
    "fonte": {
      "documento": "Planilha Orçamentária (modelo oficial do MESP)",
      "dispositivo": "aba Planilha Orçamentária",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "planilha_remanejamento",
    "nome": "Planilha de remanejamento e readequação (Modelo I)",
    "formato": "xls",
    "arquivo": "lie/planilha-remanejamento-readequacao.xls",
    "fonte": {
      "documento": "Portaria MESP 10/2026",
      "dispositivo": "art. 54",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  },
  {
    "codigo": "gru",
    "nome": "Orientações para recolhimento ao Tesouro (GRU)",
    "formato": "pdf",
    "arquivo": "lie/orientacoes-recolhimento-tesouro.pdf",
    "fonte": {
      "documento": "Orientações para recolhimento de valores ao Tesouro (MESP, 2023)",
      "dispositivo": "p. 1 a 3",
      "aConfirmar": true,
      "nota": "Conferido na Portaria MESP 10/2026; na Portaria 424/2020 o dispositivo equivalente não foi conferido."
    }
  }
]$modelos$::jsonb,
  now()
)
on conflict (codigo, versao) do nothing;

-- PRONON e PRONAS/PCD — Anexo LXXXVI-A (versão 1)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'pronon_pronas_lxxxvi_a_2025' and versao < 1 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, vigente_ate, status, parametros, fontes, checklist_envio, modelos_saida, publicado_em)
values (
  'pronon_pronas_lxxxvi_a_2025', 1, 'PRONON e PRONAS/PCD — Anexo LXXXVI-A', 'saude', 'saude',
  'federal', 'Ministério da Saúde', 'Transferegov', 'Lei 12.715/2012; Decreto 7.988/2013; Anexo LXXXVI-A da PRC GM/MS 5/2017 (Portaria GM/MS 8.031/2025)',
  '2025-09-08'::date, null, 'publicado',
  $regime${
  "codigo": "pronon_pronas_lxxxvi_a_2025",
  "versao": 1,
  "nome": "PRONON e PRONAS/PCD — Anexo LXXXVI-A",
  "area": "saude",
  "mecanismo": "saude",
  "esfera": "federal",
  "orgao": "Ministério da Saúde",
  "sistemaOficial": "Transferegov",
  "normaReferencia": "Lei 12.715/2012; Decreto 7.988/2013; Anexo LXXXVI-A da PRC GM/MS 5/2017 (Portaria GM/MS 8.031/2025)",
  "vigenteDesde": "2025-09-08",
  "identificadorOficial": {
    "tipo": "nup",
    "rotulo": "NUP do processo"
  },
  "fontes": [
    {
      "documento": "Portaria GM/MS 8.031/2025 (DOU de 08/09/2025)",
      "url": "https://www.in.gov.br/web/dou/-/portaria-gm/ms-n-8.031-de-5-de-setembro-de-2025-653608142"
    },
    {
      "documento": "PRC GM/MS 5/2017 compilada (Saúde Legis)",
      "url": "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0005_03_10_2017_comp.html"
    },
    {
      "documento": "Lei 12.715/2012 (Planalto)",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12715.htm"
    },
    {
      "documento": "Decreto 7.988/2013 (Planalto)",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7988.htm"
    },
    {
      "documento": "Edital 3/2025 (Pronon), com a minuta do Termo de Compromisso",
      "url": "https://www.gov.br/saude/pt-br/acesso-a-informacao/participacao-social/chamamentos-publicos/2025/chamamento-publico-no-03-2025-se-pronon/edital"
    }
  ],
  "aplicabilidade": {
    "criterio": "ato_praticado",
    "desde": "2025-09-08",
    "ate": null,
    "descricao": "Vale desde a publicação da Portaria 8.031/2025, que revogou o Anexo LXXXVI. Desde abr/2026 o MS aplica o novo anexo também aos atos de projetos aprovados em 2024 e 2025 (readequações e a prestação de 2025); as obrigações do Termo de Compromisso assinado continuam.",
    "sucede": [
      "pronon_pronas_lxxxvi_2017"
    ],
    "fonte": {
      "documento": "Portaria GM/MS 8.031/2025",
      "dispositivo": "arts. 3º a 5º",
      "nota": "A única regra de transição escrita é a do CMD (art. 3º); a aplicação aos projetos antigos é prática do MS (Portarias SE/MS 922 a 983/2026 e 928/2026)."
    }
  },
  "prazos": {
    "prestacaoFinal": {
      "descricao": "Prestação de contas final, até 30/04 do ano seguinte ao último exercício com execução",
      "responsavel": "proponente",
      "marco": "fim_exercicio",
      "quantidade": 4,
      "unidade": "meses",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 81",
        "nota": "Quatro meses depois de 31/12 do ano em que a execução terminou dão 30/04. O anexo não trata de dia sem expediente; vale a regra geral de prorrogação."
      }
    },
    "prestacaoAnual": {
      "descricao": "Prestação anual de cada exercício com execução, até 30/04 do ano seguinte",
      "responsavel": "proponente",
      "marco": "fim_exercicio",
      "quantidade": 4,
      "unidade": "meses",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 81",
        "nota": "A de 2025 foi prorrogada para 31/05/2026 (Portaria SE/MS 928/2026)."
      }
    },
    "respostaDiligencia": {
      "descricao": "Responder diligência da análise da prestação (por e-mail); o silêncio pode levar à reprovação",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 15,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 86, §§ 2º e 3º",
        "nota": "A diligência suspende o prazo do MS."
      }
    },
    "saneamento": {
      "descricao": "Sanar irregularidade ou omissão na prestação depois da notificação",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 15,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 82"
      }
    },
    "analisePrestacao": {
      "descricao": "Análise da prestação pelo MS, prorrogável por igual período",
      "responsavel": "orgao",
      "marco": "envio_prestacao",
      "quantidade": 150,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 83 e 86"
      }
    },
    "recurso": {
      "descricao": "Recurso a quem decidiu, que tem 10 dias para reconsiderar; última instância é o Secretário-Executivo",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 5,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 94 e 95"
      }
    },
    "devolucao": {
      "descricao": "Recolher por GRU depois da reprovação, atualizado pela poupança desde a captação",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 90",
        "nota": "Sem pagamento nem pedido de parcelamento, segue para TCE."
      }
    },
    "devolucaoSaldo": {
      "descricao": "Devolver saldo e rendimentos ao término, sob pena de TCE imediata (improrrogável)",
      "responsavel": "proponente",
      "marco": "fim_vigencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 71"
      }
    },
    "readequacaoCaptacao": {
      "descricao": "Apresentar a readequação para menor (60% a 99,99% captado) ou para maior (até 20%)",
      "responsavel": "proponente",
      "marco": "fim_captacao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 58 e 59"
      }
    },
    "notificacaoMonitoramento": {
      "descricao": "Esclarecer, cumprir ou justificar o que o monitoramento apontar",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 76, § 5º"
      }
    },
    "complementacaoAlteracao": {
      "descricao": "Complementar o pedido de alteração do plano de trabalho",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 10,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 72, § 2º"
      }
    },
    "certidoes": {
      "descricao": "Enviar as certidões que o MS não conseguiu consultar",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 20,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
        "dispositivo": "cláusula 3ª",
        "nota": "Com irregularidade, o MS pode bloquear as contas."
      }
    },
    "recursoInabilitacao": {
      "descricao": "Recorrer ao Ministro da inabilitação",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 15,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Decreto 7.988/2013",
        "dispositivo": "art. 15"
      }
    }
  },
  "prestacaoParcial": {
    "modalidades": [
      "periodica"
    ],
    "descricao": "Prestação anual de cada exercício com execução, até 30/04 do ano seguinte, com relatório de execução do objeto, relatório de execução financeira, demonstrações contábeis e parecer de auditoria independente; a final vem no ano seguinte ao último exercício.",
    "prazo": "prestacaoAnual",
    "regras": [
      {
        "codigo": "auditoria_anual",
        "descricao": "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente registrada no CRC, todo ano.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 7.988/2013",
          "dispositivo": "art. 22, parágrafo único; Anexo LXXXVI-A, art. 88, III; minuta do TC, cl. 6ª, subcl. 4ª e 5ª"
        }
      },
      {
        "codigo": "excecao_2025",
        "descricao": "A prestação do exercício 2025 vai até 31/05/2026; os demais exercícios seguem 30/04.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria SE/MS 928/2026",
          "dispositivo": "art. 4º"
        }
      },
      {
        "codigo": "monitoramento_anual",
        "descricao": "Relatórios de monitoramento anuais da secretaria finalística, homologados em 45 dias, com resultados, impactos, satisfação e sustentabilidade.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 78 e 79"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 81"
    }
  },
  "orcamento": {
    "estrutura": {
      "niveis": [
        "Custos diretos ou capital",
        "Rubrica",
        "Item"
      ],
      "descricao": "Orçamento analítico com todos os itens, etapas e custos, matriz lógica e cronograma em meses; no modelo dos editais, custeio (custos diretos) e capital (equipamentos e material permanente), com o percentual de cada linha.",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 17, § 1º, IX a XI; Editais 2/2025 e 3/2025, Anexo IV"
      }
    },
    "grupos": [
      {
        "codigo": "execucao",
        "rotulo": "Custos diretos",
        "descricao": "Equipe com encargos, consumo, serviços de terceiros, diárias, passagens, equipamentos e material permanente essenciais.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, I, II e V"
        }
      },
      {
        "codigo": "administracao",
        "rotulo": "Custos indiretos",
        "descricao": "Internet, transporte, combustível, aluguel, telefone, água, energia, gás e contabilidade.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, III"
        }
      },
      {
        "codigo": "elaboracao",
        "rotulo": "Elaboração e captação",
        "descricao": "Elaboração da proposta e captação de recursos.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, IV"
        }
      }
    ],
    "bases": {
      "valor_projeto": {
        "descricao": "Valor do projeto: o orçamento inteiro.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, III",
          "nota": "O anexo não tira grupos do valor do projeto."
        }
      },
      "valor_total_projeto": {
        "descricao": "Montante global do projeto.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, IV"
        }
      }
    },
    "tetos": [
      {
        "codigo": "custos_indiretos",
        "descricao": "Custos indiretos",
        "grupos": [
          "administracao"
        ],
        "percentual": 15,
        "base": "valor_projeto",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, III"
        }
      },
      {
        "codigo": "elaboracao_captacao",
        "descricao": "Elaboração da proposta e captação",
        "grupos": [
          "elaboracao"
        ],
        "percentual": 5,
        "base": "valor_total_projeto",
        "teto": 50000,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, IV"
        }
      }
    ],
    "regras": [
      {
        "codigo": "precos_de_referencia",
        "descricao": "Preços pelo SIGTAP, SIGEM, BPS, PNCP ou outras fontes, ou 3 cotações; equipe pela convenção coletiva e pelos conselhos profissionais.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 41 e § 3º"
        }
      },
      {
        "codigo": "equipamentos",
        "descricao": "Equipamentos com viabilidade e sustentabilidade, normas da Anvisa e preço pelo SIGEM.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 27 a 29"
        }
      },
      {
        "codigo": "medicamentos",
        "descricao": "Medicamentos da RENAME; oncológicos com registro na Anvisa.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 30, § 1º"
        }
      },
      {
        "codigo": "opm",
        "descricao": "Órteses, próteses e meios auxiliares de locomoção só com ações de habilitação e reabilitação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 31"
        }
      },
      {
        "codigo": "prazo_de_execucao",
        "descricao": "Execução em até 24 meses; pesquisa em até 36.",
        "severidade": "alerta",
        "parametros": {
          "meses": 24,
          "mesesPesquisa": 36
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 18"
        }
      },
      {
        "codigo": "reserva_de_contingencia",
        "descricao": "O edital pode prever reserva de contingência entre 5% e 15% do valor global.",
        "severidade": "info",
        "parametros": {
          "minimo": 5,
          "maximo": 15
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 16"
        }
      }
    ]
  },
  "alteracoes": {
    "janela": {
      "aPartirDe": "assinatura_termo",
      "ate": "fim_execucao",
      "descricao": "Durante a execução, que começa com o Termo de Compromisso publicado e o desbloqueio da conta; é vedado executar qualquer alteração antes da autorização formal.",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 50 e 72"
      }
    },
    "tipos": {
      "remanejamento": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "Depois do remanejamento, os custos indiretos e a elaboração continuam dentro dos tetos.",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 21, III e IV"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "termo_de_apostilamento",
            "descricao": "Remanejamento sem alterar o valor global vai por Termo de Apostilamento, sempre com aprovação prévia.",
            "severidade": "bloqueio",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 69, § 2º"
            }
          }
        ],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 69, § 2º, e 72",
          "nota": "O anexo não tem remanejamento livre: toda mudança exige autorização prévia."
        }
      },
      "complementacao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "acumulado_maximo",
            "percentual": 20,
            "base": "valor_homologado_execucao",
            "severidade": "bloqueio",
            "descricao": "Readequação para maior de até 20% do aprovado, a critério do MS.",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 59"
            }
          },
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "A readequação respeita os tetos.",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 21, III e IV"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "pedido_em_30_dias",
            "descricao": "Pedido em 30 dias do fim da captação ou do aviso antecipado de conclusão.",
            "severidade": "alerta",
            "parametros": {
              "dias": 30
            },
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 59"
            }
          },
          {
            "codigo": "excedente_recolhido",
            "descricao": "O que passar de 120% do aprovado é recolhido.",
            "severidade": "alerta",
            "fonte": {
              "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
              "dispositivo": "cl. 2ª, subcl. 2ª"
            }
          },
          {
            "codigo": "termo_aditivo",
            "descricao": "Mudar valores, metas ou prazo durante a execução exige termo aditivo.",
            "severidade": "info",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 72, § 1º"
            }
          }
        ],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 59"
        }
      },
      "reducao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "captado_minimo",
            "percentual": 60,
            "base": "valor_homologado_execucao",
            "severidade": "bloqueio",
            "descricao": "Ter captado ao menos 60% do aprovado; abaixo disso, o projeto é indeferido e o saldo recolhido.",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "arts. 58 e 60, III"
            }
          },
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Depois da redução, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 21, III e IV"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "pedido_em_30_dias",
            "descricao": "Readequação para menor em 30 dias do fim da captação; a execução só começa depois de aprovada (SE em 10 dias, secretaria em 30, portaria em 10).",
            "severidade": "alerta",
            "parametros": {
              "dias": 30
            },
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 58"
            }
          }
        ],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 58"
        }
      },
      "inclusao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Com o item novo, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 21, III e IV"
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 72"
        }
      }
    },
    "alertasPorItem": [],
    "prazoAnalise": null,
    "silencioAprova": false,
    "regras": [
      {
        "codigo": "rendimentos_por_apostilamento",
        "descricao": "Usar rendimentos ou saldos antes do término exige aprovação prévia e Termo de Apostilamento.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 69, § 2º"
        }
      },
      {
        "codigo": "prorrogacao",
        "descricao": "Prorrogação a pedido uma única vez, protocolada até 90 dias antes do fim; de ofício quando o atraso é da administração.",
        "severidade": "alerta",
        "parametros": {
          "diasAntes": 90
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 65, § 2º, e 73"
        }
      },
      {
        "codigo": "suspensao",
        "descricao": "Suspensão a pedido por até 120 dias; depois, o projeto é encerrado.",
        "severidade": "info",
        "parametros": {
          "dias": 120
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 77"
        }
      },
      {
        "codigo": "remanejamento_entre_projetos",
        "descricao": "Remanejamento entre Contas Captação: mesmo CNPJ, programa e ano fiscal, depois do fim da captação e antes da readequação e do Termo.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 61 a 64"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 58, 59, 69 e 72"
    }
  },
  "fornecedores": {
    "limites": [],
    "partesRelacionadas": {
      "descricao": "É vedado captar de entidades vinculadas à proponente; exposição de marca do doador é vantagem indevida.",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 51 e 96, parágrafo único"
      }
    },
    "regras": [
      {
        "codigo": "vantagem_ao_doador",
        "descricao": "Despesa que gere vantagem ao doador é vedada; com dolo, multa de 2 vezes a vantagem.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, IV; Lei 12.715/2012, art. 13"
        }
      },
      {
        "codigo": "unidade_executora",
        "descricao": "A instituição executa o projeto e não transfere as atividades principais.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 76, § 3º; minuta do TC, cl. 9ª"
        }
      },
      {
        "codigo": "intermediacao",
        "descricao": "Intermediação é vedada, salvo a contratação de elaboração do projeto e de captação.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Lei 12.715/2012",
          "dispositivo": "art. 11; minuta do TC, cl. 1ª, subcl. 2ª"
        }
      },
      {
        "codigo": "equipe_ligada_a_acao",
        "descricao": "Equipe do quadro ou contratada só para ações do plano, com relação direta com o objeto.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 20, § 1º"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 20, 51 e 76",
      "nota": "O anexo não fixa limite percentual por fornecedor nem por parte relacionada."
    }
  },
  "contas": {
    "contas": [
      {
        "tipo": "captacao",
        "descricao": "Conta Captação, bloqueada, que recebe as doações",
        "abertaPor": "orgao"
      },
      {
        "tipo": "movimento",
        "descricao": "Conta Movimento, de livre movimentação, só para despesas do projeto",
        "abertaPor": "orgao"
      }
    ],
    "bancos": [
      "Instituição financeira oficial (na prática, Banco do Brasil)"
    ],
    "descricao": "Duas contas por projeto, abertas pelo MS em instituição financeira oficial; a instituição autoriza o banco, de forma irrevogável, a cumprir as ordens do MS.",
    "tarifas": {
      "regra": "isentas",
      "descricao": "A conta é isenta de tarifa, e taxas bancárias, multas e juros são despesas vedadas.",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 66; art. 22, VII"
      }
    },
    "liberacao": {
      "descricao": "A execução só começa com 100% captado e o Termo de Compromisso assinado e publicado; de 60% a 99,99%, readequação para menor; abaixo de 60%, indeferimento. Rendimentos não contam.",
      "percentualMinimo": 100,
      "base": "valor_aprovado_execucao",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 50, 56, 58, 60, III, e 69, § 3º"
      }
    },
    "rendimentos": {
      "aplicacao": "automatica",
      "contamComoCaptado": false,
      "uso": "Aplicação automática em fundo de baixo risco nas duas contas; uso no objeto com autorização prévia e Termo de Apostilamento; devolvidos com o saldo no fim.",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 57, 69, §§ 1º a 3º, 71 e 91"
      }
    },
    "saldo": {
      "descricao": "Saldo e rendimentos da Conta Movimento devolvidos por GRU em 30 dias improrrogáveis ao término, sob pena de TCE; a Conta Captação é recolhida pela SE.",
      "prazo": "devolucaoSaldo",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 60, §§ 1º e 3º; art. 71"
      }
    },
    "regras": [
      {
        "codigo": "captacao_depois_da_publicacao",
        "descricao": "Captação só depois da publicação da aprovação e da notificação de abertura da Conta Captação, dentro do período do ato MF/MS.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 39, 47, § 2º, e 48"
        }
      },
      {
        "codigo": "doacao_em_bens",
        "descricao": "Doações em bens, comodato ou insumos exigem recibos antes da liberação; insumos de doador PJ, com nota, validade de 12 meses e preço até o orçado.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 52 a 56, § 3º"
        }
      },
      {
        "codigo": "recibo_por_deposito",
        "descricao": "Recibo por depósito, em 3 vias, com envio ao MS em 20 dias; desde mar/2026 o doador também emite pelo Transferegov.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 2ª, II, c"
        }
      },
      {
        "codigo": "captacao_acima",
        "descricao": "Acima de 120% do aprovado, o excedente é desconsiderado e recolhido.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 2ª, subcl. 2ª"
        }
      },
      {
        "codigo": "contas_bloqueadas",
        "descricao": "A Conta Captação é bloqueada no fim da captação ou com 100%; as contas são encerradas depois da vigência do Termo.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 47, §§ 3º e 4º"
        }
      },
      {
        "codigo": "recursos_publicos",
        "descricao": "Os recursos são públicos, impenhoráveis e não integram o patrimônio da entidade.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 67"
        }
      },
      {
        "codigo": "regularidade",
        "descricao": "Regularidade fiscal mantida o tempo todo (CRF/FGTS, CND, CEPIM, CADIN, CNDT); com irregularidade, o MS pode bloquear as contas.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 65, §§ 1º e 3º; minuta do TC, cl. 3ª"
        }
      },
      {
        "codigo": "aplicacao_pelo_termo",
        "descricao": "A minuta do Termo fala em aplicação a pedido, em fundo de curto prazo; vale a regra do Termo assinado.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 5ª",
          "aConfirmar": true,
          "nota": "Diverge do anexo (arts. 57 e 69)."
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 47 a 69"
    }
  },
  "pagamentos": {
    "meiosPermitidos": null,
    "meiosVedados": [
      "saque"
    ],
    "descricao": "Qualquer operação bancária autorizada pelo Banco Central que identifique destinação e credor, a partir da Conta Movimento; saque em espécie é vedado.",
    "documentoFiscal": [
      {
        "codigo": "em_nome_da_instituicao",
        "descricao": "Comprovantes emitidos exclusivamente em nome da instituição.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 70"
        }
      },
      {
        "codigo": "nup_em_todos",
        "descricao": "Número do processo administrativo (NUP) em todos os comprovantes.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 70, parágrafo único; minuta do TC, cl. 2ª, II, k"
        }
      },
      {
        "codigo": "relacao_de_pagamentos",
        "descricao": "Relação de pagamentos com credor, número da nota e data, conferida com os comprovantes.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 88, IV"
        }
      },
      {
        "codigo": "discriminacao",
        "descricao": "Discriminação de serviços e produtos e nome do projeto no documento, ou declaração do dirigente nele.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 95, § 1º",
          "aConfirmar": true,
          "nota": "Exigência do regime anterior, mantida como boa prática."
        }
      }
    ],
    "regras": [
      {
        "codigo": "conciliacao",
        "descricao": "Cada débito da Conta Movimento casado com um pagamento da relação.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 88, II"
        }
      },
      {
        "codigo": "conta_exclusiva",
        "descricao": "A Conta Movimento serve exclusivamente às despesas do projeto aprovado.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 68"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 68"
    }
  },
  "despesas": {
    "periodo": {
      "descricao": "Fato gerador a partir da vigência do Termo de Compromisso (salvo elaboração e captação, ressarcíveis) e até o fim do prazo de execução.",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "art. 22, IX; art. 56, § 1º"
      }
    },
    "vedadas": [
      {
        "codigo": "taxa_administracao",
        "descricao": "Taxa de administração",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, I"
        }
      },
      {
        "codigo": "consultoria_de_servidor",
        "descricao": "Pagamento a servidor público por consultoria",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, II"
        }
      },
      {
        "codigo": "clube_de_servidores",
        "descricao": "Clubes e associações de servidores",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, III"
        }
      },
      {
        "codigo": "vantagem_ao_doador",
        "descricao": "Vantagem ao doador",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, IV"
        }
      },
      {
        "codigo": "festas_bufe",
        "descricao": "Festas e bufê, salvo refeições de profissionais e ações educativas",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, V"
        }
      },
      {
        "codigo": "primeira_classe",
        "descricao": "Passagem de primeira classe ou executiva",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, VI"
        }
      },
      {
        "codigo": "taxas_multas_juros",
        "descricao": "Taxas bancárias, multas, juros e correção",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, VII"
        }
      },
      {
        "codigo": "acao_ja_no_sus",
        "descricao": "Ações médico-assistenciais que a instituição já executa pelo SUS",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, VIII; art. 24"
        }
      },
      {
        "codigo": "antes_do_termo",
        "descricao": "Fato gerador anterior à vigência do Termo, salvo elaboração e captação",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, IX"
        }
      },
      {
        "codigo": "custeio_duplo",
        "descricao": "Despesa já custeada por outro instrumento",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, X"
        }
      },
      {
        "codigo": "obras",
        "descricao": "Obras, reformas, ampliações e construções",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 26"
        }
      },
      {
        "codigo": "compra_centralizada",
        "descricao": "Medicamentos de compra centralizada pelo MS",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 30, § 3º"
        }
      },
      {
        "codigo": "procedimentos_com_equipamentos",
        "descricao": "Custear os procedimentos feitos com os equipamentos adquiridos (salvo o previsto no edital)",
        "fonte": {
          "documento": "Edital de Chamamento MS 3/2025",
          "dispositivo": "item 7.4.13"
        }
      }
    ],
    "regras": [
      {
        "codigo": "encargos_da_instituicao",
        "descricao": "Encargos trabalhistas da equipe são responsabilidade exclusiva da instituição, sem vínculo com a administração.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 19 e 20, § 2º"
        }
      },
      {
        "codigo": "sem_sobreposicao_sus",
        "descricao": "Metas e produção não repetem o que é contratado pelo SUS ou usado para o CEBAS.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 24"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 21 a 31"
    }
  },
  "porte": {
    "lacuna": "nao_se_aplica",
    "motivo": "O anexo não classifica projetos por porte: a análise é por resultados, e o financeiro só é examinado quando uma meta falha ou por amostragem.",
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 81, § 3º; art. 88"
    }
  },
  "objeto": {
    "descricao": "Análise por resultados: documentos do plano, resultados esperados × atingidos, metas do período × resultados, ações, comprovantes do objeto, satisfação do público e sustentabilidade; produção médico-assistencial registrada só no CMD.",
    "regras": [
      {
        "codigo": "metas_resultados",
        "descricao": "Resultados esperados × atingidos e metas do período × resultados, com justificativa das metas não cumpridas.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, II, III e VII"
        }
      },
      {
        "codigo": "evidencias",
        "descricao": "Comprovantes do objeto: listas de presença, fotos e vídeos.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, V"
        }
      },
      {
        "codigo": "docentes",
        "descricao": "Em projetos de educação, relação de docentes e lista nominal dos profissionais qualificados, assinada pelo coordenador e pelo dirigente.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, VI"
        }
      },
      {
        "codigo": "satisfacao",
        "descricao": "Pesquisa de satisfação do público-alvo ou declaração de entidade local ou do conselho de saúde.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 79, § 4º; art. 87, IX"
        }
      },
      {
        "codigo": "sustentabilidade",
        "descricao": "Sustentabilidade, quando a instituição fica com os bens.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, X"
        }
      },
      {
        "codigo": "cmd",
        "descricao": "Produção médico-assistencial registrada exclusivamente no CMD, sem registro em outros sistemas do MS.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 74, § 2º; Portaria GM/MS 8.031/2025, art. 3º"
        }
      },
      {
        "codigo": "pesquisa_autorizada",
        "descricao": "Pesquisa com aprovação de CEP, Anvisa e CTNBio antes de começar.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 17, § 1º, VIII"
        }
      },
      {
        "codigo": "insumos_remanescentes",
        "descricao": "Insumos não usados vão ao ente que deu a anuência; para mantê-los, pedir ao gestor 30 dias antes do fim.",
        "severidade": "alerta",
        "parametros": {
          "diasAntes": 30
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 54"
        }
      },
      {
        "codigo": "bens_permanentes",
        "descricao": "Equipamentos e material permanente com identificação do projeto, inventário e destino no fim.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 80; minuta do TC, documento XI"
        }
      },
      {
        "codigo": "dados_de_pacientes",
        "descricao": "Dados de saúde são sensíveis: sem prontuário no sistema, dados criptografados e destruídos ou devolvidos a pedido do MS.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 8ª"
        }
      },
      {
        "codigo": "contrapartida",
        "descricao": "Contrapartida é facultativa; em bens e serviços, com valor identificado no Termo.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 14, § 5º"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 74, 79 e 87"
    }
  },
  "divulgacao": {
    "marcas": [
      "Ministério da Saúde"
    ],
    "aprovacaoPrevia": {
      "exigida": false,
      "prazo": null,
      "silencioAprova": false,
      "descricao": "Nem o anexo nem a minuta do Termo exigem aprovação prévia das peças; o material leva o logotipo e a menção ao MS.",
      "fonte": {
        "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
        "dispositivo": "cl. 2ª, II, s e t",
        "aConfirmar": true
      }
    },
    "defeso": null,
    "regras": [
      {
        "codigo": "logotipo_do_ms",
        "descricao": "Material de comunicação com o logotipo e a menção ao Ministério da Saúde.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 2ª, II, s e t"
        }
      },
      {
        "codigo": "sem_marca_de_doador",
        "descricao": "Exposição de material publicitário dos doadores pela instituição ou pelos usuários é vantagem indevida.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 96, parágrafo único"
        }
      },
      {
        "codigo": "patrocinio_promocional",
        "descricao": "Patrocínio com finalidade promocional depende de ato do Ministro, ainda não publicado.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 100"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 96; minuta do TC, cl. 2ª"
    }
  },
  "envio": {
    "sistema": "Transferegov",
    "descricao": "Prestação anual e final pelo Transferegov, com o relatório de execução financeira extraído do sistema e o parecer de auditoria independente; o Manual Orientativo com os modelos ainda não foi publicado.",
    "documentos": [
      {
        "codigo": "relatorio_objeto",
        "descricao": "Relatório de cumprimento do objeto (execução do objeto)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 81; minuta do TC, cl. 6ª, I"
        }
      },
      {
        "codigo": "relatorio_financeiro",
        "descricao": "Relatório de execução financeira (extraído do Transferegov)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 81 e 88"
        }
      },
      {
        "codigo": "auditoria",
        "descricao": "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente (CRC)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 88, III; Decreto 7.988/2013, art. 22, parágrafo único"
        }
      },
      {
        "codigo": "fisico_financeiro",
        "descricao": "Relatório final de execução físico-financeira",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, II"
        }
      },
      {
        "codigo": "receitas_despesas",
        "descricao": "Relatório de execução de receitas e despesas",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, III"
        }
      },
      {
        "codigo": "relacao_pagamentos",
        "descricao": "Relação de pagamentos",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, IV"
        }
      },
      {
        "codigo": "extrato",
        "descricao": "Extrato da conta, do recebimento ao último pagamento",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, V"
        }
      },
      {
        "codigo": "rendimentos",
        "descricao": "Demonstrativo de rendimentos",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, VI"
        }
      },
      {
        "codigo": "gru",
        "descricao": "Comprovante de GRU do saldo",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, VII; Anexo LXXXVI-A, art. 60, § 2º"
        }
      },
      {
        "codigo": "comprovantes_despesa",
        "descricao": "Cópias dos comprovantes de despesa",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, VIII"
        }
      },
      {
        "codigo": "bens",
        "descricao": "Relação de bens adquiridos ou produzidos",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, IX"
        }
      },
      {
        "codigo": "fotos",
        "descricao": "Fotografias e reportagens",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, X"
        }
      },
      {
        "codigo": "equipamentos",
        "descricao": "Relação de equipamentos e materiais permanentes, com identificação do projeto e inventário físico",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, XI"
        }
      },
      {
        "codigo": "cmd",
        "descricao": "Informações lançadas no CMD",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, XII"
        }
      },
      {
        "codigo": "encerramento_conta",
        "descricao": "Comprovante de encerramento da Conta Movimento",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 6ª, subcl. 5ª, XIII"
        }
      },
      {
        "codigo": "doacao_de_insumos",
        "descricao": "Documentação da doação de insumos remanescentes",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 54, § 1º"
        }
      }
    ],
    "modelos": [],
    "regras": [
      {
        "codigo": "manual_nao_publicado",
        "descricao": "O Manual Orientativo, com os modelos, não foi publicado até 01/10/2026; seguir o anexo, a minuta do Termo e os atos SE/MS.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria GM/MS 8.031/2025",
          "dispositivo": "art. 2º"
        }
      },
      {
        "codigo": "impropriedades_registradas",
        "descricao": "Impropriedades que levam à rejeição ficam registradas no Transferegov e pesam em parcerias futuras.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 81, § 2º"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 81, 85, 87 e 88"
    }
  },
  "posEnvio": {
    "resultados": [
      {
        "resultado": "aprovada",
        "descricao": "Objeto e metas cumpridos integralmente.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 84"
        }
      },
      {
        "resultado": "aprovada_ressalvas",
        "descricao": "Objeto e metas cumpridos, com impropriedade ou falta formal sem dano ao erário.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 84"
        }
      },
      {
        "resultado": "reprovada",
        "descricao": "Omissão, descumprimento injustificado de objetivos ou metas, dano por ato de gestão ilegítimo ou antieconômico, desfalque ou desvio.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 84"
        }
      }
    ],
    "devolucao": {
      "descricao": "GRU para a Conta Única do Tesouro, sem prejuízo ao benefício fiscal do doador: 30 dias da notificação; no término, 30 dias improrrogáveis sob pena de TCE; na aprovação com ressalva por execução parcial, remanescente e rendimentos em 30 dias.",
      "atualizacao": "Na reprovação, índice oficial da poupança desde a captação.",
      "gru": [],
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 60, 71, 90 e 91"
      }
    },
    "regras": [
      {
        "codigo": "analise_por_resultados",
        "descricao": "O financeiro só é examinado quando uma meta não é cumprida ou por amostragem da secretaria finalística.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 81, § 3º; art. 88"
        }
      },
      {
        "codigo": "diligencia_por_email",
        "descricao": "Diligência por e-mail com 15 dias, que suspende o prazo do MS; o silêncio pode levar à reprovação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 86, §§ 2º e 3º"
        }
      },
      {
        "codigo": "inabilitacao",
        "descricao": "Inabilitação por até 3 anos, inclusive por prestação anual ou final não apresentada, final reprovada nos últimos 24 meses ou diligência sem resposta.",
        "severidade": "alerta",
        "parametros": {
          "anos": 3
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 97 e 98, XI"
        }
      },
      {
        "codigo": "tce",
        "descricao": "TCE por não aplicação ou aplicação incorreta, inclusive antes do fim da parceria, com registro no SIAFI.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 76, § 1º, 81, § 1º, 92 e 93"
        }
      },
      {
        "codigo": "omissao_sanavel",
        "descricao": "A omissão pode ser sanada até o julgamento da TCE.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, § 2º"
        }
      },
      {
        "codigo": "rescisao",
        "descricao": "Na rescisão do Termo, restituição integral com atualização, inclusive em aprovação com ressalvas.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 12ª",
          "aConfirmar": true,
          "nota": "Redação mais dura que a do anexo."
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 81 a 95"
    }
  },
  "guarda": {
    "marco": "registro_decisao",
    "quantidade": 5,
    "unidade": "anos",
    "prorrogaParaDiaUtil": false,
    "descricao": "Originais na sede, à disposição do MS e dos órgãos de controle, por no mínimo 5 anos depois da aprovação da prestação de contas.",
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 6ª; cl. 2ª, II, u",
      "nota": "O anexo não trata da guarda; vale o prazo mais longo do Termo."
    }
  }
}$regime$::jsonb,
  $fontes$[
  {
    "documento": "Portaria GM/MS 8.031/2025 (DOU de 08/09/2025)",
    "url": "https://www.in.gov.br/web/dou/-/portaria-gm/ms-n-8.031-de-5-de-setembro-de-2025-653608142"
  },
  {
    "documento": "PRC GM/MS 5/2017 compilada (Saúde Legis)",
    "url": "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0005_03_10_2017_comp.html"
  },
  {
    "documento": "Lei 12.715/2012 (Planalto)",
    "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12715.htm"
  },
  {
    "documento": "Decreto 7.988/2013 (Planalto)",
    "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7988.htm"
  },
  {
    "documento": "Edital 3/2025 (Pronon), com a minuta do Termo de Compromisso",
    "url": "https://www.gov.br/saude/pt-br/acesso-a-informacao/participacao-social/chamamentos-publicos/2025/chamamento-publico-no-03-2025-se-pronon/edital"
  }
]$fontes$::jsonb,
  $checklist$[
  {
    "codigo": "relatorio_objeto",
    "descricao": "Relatório de cumprimento do objeto (execução do objeto)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 81; minuta do TC, cl. 6ª, I"
    }
  },
  {
    "codigo": "relatorio_financeiro",
    "descricao": "Relatório de execução financeira (extraído do Transferegov)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 81 e 88"
    }
  },
  {
    "codigo": "auditoria",
    "descricao": "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente (CRC)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 88, III; Decreto 7.988/2013, art. 22, parágrafo único"
    }
  },
  {
    "codigo": "fisico_financeiro",
    "descricao": "Relatório final de execução físico-financeira",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, II"
    }
  },
  {
    "codigo": "receitas_despesas",
    "descricao": "Relatório de execução de receitas e despesas",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, III"
    }
  },
  {
    "codigo": "relacao_pagamentos",
    "descricao": "Relação de pagamentos",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, IV"
    }
  },
  {
    "codigo": "extrato",
    "descricao": "Extrato da conta, do recebimento ao último pagamento",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, V"
    }
  },
  {
    "codigo": "rendimentos",
    "descricao": "Demonstrativo de rendimentos",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, VI"
    }
  },
  {
    "codigo": "gru",
    "descricao": "Comprovante de GRU do saldo",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, VII; Anexo LXXXVI-A, art. 60, § 2º"
    }
  },
  {
    "codigo": "comprovantes_despesa",
    "descricao": "Cópias dos comprovantes de despesa",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, VIII"
    }
  },
  {
    "codigo": "bens",
    "descricao": "Relação de bens adquiridos ou produzidos",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, IX"
    }
  },
  {
    "codigo": "fotos",
    "descricao": "Fotografias e reportagens",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, X"
    }
  },
  {
    "codigo": "equipamentos",
    "descricao": "Relação de equipamentos e materiais permanentes, com identificação do projeto e inventário físico",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, XI"
    }
  },
  {
    "codigo": "cmd",
    "descricao": "Informações lançadas no CMD",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, XII"
    }
  },
  {
    "codigo": "encerramento_conta",
    "descricao": "Comprovante de encerramento da Conta Movimento",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
      "dispositivo": "cl. 6ª, subcl. 5ª, XIII"
    }
  },
  {
    "codigo": "doacao_de_insumos",
    "descricao": "Documentação da doação de insumos remanescentes",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 54, § 1º"
    }
  }
]$checklist$::jsonb,
  $modelos$[]$modelos$::jsonb,
  now()
)
on conflict (codigo, versao) do nothing;

-- PRONON e PRONAS/PCD — Anexo LXXXVI (anterior) (versão 1)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'pronon_pronas_lxxxvi_2017' and versao < 1 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, vigente_ate, status, parametros, fontes, checklist_envio, modelos_saida, publicado_em)
values (
  'pronon_pronas_lxxxvi_2017', 1, 'PRONON e PRONAS/PCD — Anexo LXXXVI (anterior)', 'saude', 'saude',
  'federal', 'Ministério da Saúde', 'SIPAR (protocolo)', 'Lei 12.715/2012; Decreto 7.988/2013; Anexo LXXXVI da PRC GM/MS 5/2017 (origem na PRT GM/MS 1.550/2014), revogado pela Portaria GM/MS 8.031/2025',
  '2017-09-28'::date, '2025-09-07'::date, 'publicado',
  $regime${
  "codigo": "pronon_pronas_lxxxvi_2017",
  "versao": 1,
  "nome": "PRONON e PRONAS/PCD — Anexo LXXXVI (anterior)",
  "area": "saude",
  "mecanismo": "saude",
  "esfera": "federal",
  "orgao": "Ministério da Saúde",
  "sistemaOficial": "SIPAR (protocolo)",
  "normaReferencia": "Lei 12.715/2012; Decreto 7.988/2013; Anexo LXXXVI da PRC GM/MS 5/2017 (origem na PRT GM/MS 1.550/2014), revogado pela Portaria GM/MS 8.031/2025",
  "vigenteDesde": "2017-09-28",
  "identificadorOficial": {
    "tipo": "nup",
    "rotulo": "Nº do processo (SIPAR)"
  },
  "fontes": [
    {
      "documento": "PRC GM/MS 5/2017 compilada (Anexo LXXXVI, revogado)",
      "url": "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0005_03_10_2017_comp.html"
    },
    {
      "documento": "Portaria GM/MS 8.031/2025 (revoga o Anexo LXXXVI)",
      "url": "https://www.in.gov.br/web/dou/-/portaria-gm/ms-n-8.031-de-5-de-setembro-de-2025-653608142"
    },
    {
      "documento": "Lei 12.715/2012 (Planalto)",
      "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12715.htm"
    }
  ],
  "aplicabilidade": {
    "criterio": "aprovacao_projeto",
    "desde": "2017-09-28",
    "ate": "2025-09-07",
    "descricao": "Projetos aprovados na vigência da PRC 5/2017, para os atos praticados até 07/09/2025. Desde abr/2026 o MS decide os atos desses projetos pelo Anexo LXXXVI-A; as obrigações do Termo de Compromisso assinado continuam. Projetos das Portarias 875/2013 e 1.550/2014 não estão modelados.",
    "sucede": [],
    "fonte": {
      "documento": "Manual de análise contábil e financeira PRONON e PRONAS/PCD (FNS, 2019), Anexo III",
      "dispositivo": "seção 4.0, p. 6",
      "nota": "Corte final pela Portaria GM/MS 8.031/2025, arts. 4º e 5º; a prática posterior está nas Portarias SE/MS 922 a 983/2026."
    }
  },
  "prazos": {
    "prestacaoFinal": {
      "descricao": "Prestação no ano seguinte ao último exercício com execução, até 30/04, com demonstrações contábeis e auditoria",
      "responsavel": "proponente",
      "marco": "fim_exercicio",
      "quantidade": 4,
      "unidade": "meses",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 92, parágrafo único"
      }
    },
    "prestacaoAnual": {
      "descricao": "Demonstrações contábeis, auditoria e relatório de execução até 30/04 de cada ano de execução",
      "responsavel": "proponente",
      "marco": "fim_exercicio",
      "quantidade": 4,
      "unidade": "meses",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 92, parágrafo único"
      }
    },
    "respostaDiligencia": {
      "descricao": "Sanar irregularidade ou omissão na prestação (notificação única)",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 97, § 3º"
      }
    },
    "analisePrestacao": {
      "descricao": "Análise da prestação; o FNS analisava a parte financeira",
      "responsavel": "orgao",
      "marco": "envio_prestacao",
      "quantidade": 90,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 96"
      }
    },
    "recurso": {
      "descricao": "Recurso a quem decidiu, que tem 10 dias para reconsiderar; última instância é o Secretário-Executivo",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 5,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 94 e 95",
        "aConfirmar": true,
        "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
      }
    },
    "devolucao": {
      "descricao": "Recolher por GRU, inclusive na reprovação parcial ou final, depois da notificação do MS",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 88, VII e § 1º"
      }
    },
    "devolucaoSaldo": {
      "descricao": "Recolher por GRU os saldos das contas Captação e Movimento, com rendimentos, depois da notificação do MS",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 88, V, VI e § 1º"
      }
    },
    "readequacaoCaptacao": {
      "descricao": "Apresentar a readequação para menor (60% a 99,99% captado) ou para maior (até 20%)",
      "responsavel": "proponente",
      "marco": "fim_captacao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 58 e 59",
        "aConfirmar": true,
        "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
      }
    },
    "notificacaoMonitoramento": {
      "descricao": "Responder a notificação do monitoramento",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 20,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 89, § 5º"
      }
    },
    "certidoes": {
      "descricao": "Enviar as certidões que o MS não conseguiu consultar",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 20,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
        "dispositivo": "cláusula 3ª",
        "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. Com irregularidade, o MS pode bloquear as contas.",
        "aConfirmar": true
      }
    },
    "recursoInabilitacao": {
      "descricao": "Recorrer ao Ministro da inabilitação",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 15,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Decreto 7.988/2013",
        "dispositivo": "art. 15",
        "aConfirmar": true,
        "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
      }
    }
  },
  "prestacaoParcial": {
    "modalidades": [
      "periodica"
    ],
    "descricao": "Prestação anual até 30/04 de cada ano de execução, com demonstrações contábeis, relatório de auditoria independente e relatório de execução; a final no ano seguinte ao último exercício.",
    "prazo": "prestacaoAnual",
    "regras": [
      {
        "codigo": "auditoria_anual",
        "descricao": "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente registrada no CRC, todo ano.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Decreto 7.988/2013",
          "dispositivo": "art. 22, parágrafo único; Anexo LXXXVI-A, art. 88, III; minuta do TC, cl. 6ª, subcl. 4ª e 5ª",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "excecao_2025",
        "descricao": "A prestação do exercício 2025 vai até 31/05/2026; os demais exercícios seguem 30/04.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria SE/MS 928/2026",
          "dispositivo": "art. 4º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "monitoramento_anual",
        "descricao": "Relatórios de monitoramento anuais da secretaria finalística, homologados em 45 dias, com resultados, impactos, satisfação e sustentabilidade.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 78 e 79",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, parágrafo único"
    }
  },
  "orcamento": {
    "estrutura": {
      "niveis": [
        "Natureza da despesa",
        "Categoria de gasto",
        "Item"
      ],
      "descricao": "Orçamento detalhado com todos os custos, a natureza das despesas e as categorias dos gastos.",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 27"
      }
    },
    "grupos": [
      {
        "codigo": "execucao",
        "rotulo": "Custos do projeto",
        "descricao": "Custos de execução do projeto; o regime não previa custos indiretos.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, I, II e V",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "elaboracao",
        "rotulo": "Elaboração e captação",
        "descricao": "Elaboração da proposta e captação de recursos.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, IV",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    ],
    "bases": {
      "valor_projeto": {
        "descricao": "Valor do projeto: o orçamento inteiro.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, III",
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. O anexo não tira grupos do valor do projeto.",
          "aConfirmar": true
        }
      },
      "valor_total_projeto": {
        "descricao": "Montante global do projeto.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 21, IV",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    },
    "tetos": [
      {
        "codigo": "elaboracao_captacao",
        "descricao": "Elaboração do projeto e captação",
        "grupos": [
          "elaboracao"
        ],
        "percentual": 5,
        "base": "valor_total_projeto",
        "teto": 50000,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 27, § 3º",
          "nota": "Soma até 5% do valor total previsto, com teto de R$ 50 mil."
        }
      }
    ],
    "regras": [
      {
        "codigo": "precos_de_referencia",
        "descricao": "Preços pelo SIGTAP, SIGEM, BPS, PNCP ou outras fontes, ou 3 cotações; equipe pela convenção coletiva e pelos conselhos profissionais.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 41 e § 3º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "equipamentos",
        "descricao": "Equipamentos com viabilidade e sustentabilidade, normas da Anvisa e preço pelo SIGEM.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 27 a 29",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "medicamentos",
        "descricao": "Medicamentos da RENAME; oncológicos com registro na Anvisa.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 30, § 1º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "opm",
        "descricao": "Órteses, próteses e meios auxiliares de locomoção só com ações de habilitação e reabilitação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 31",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "prazo_de_execucao",
        "descricao": "Execução em até 24 meses; pesquisa em até 36.",
        "severidade": "alerta",
        "parametros": {
          "meses": 24,
          "mesesPesquisa": 36
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 18",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "reserva_de_contingencia",
        "descricao": "O edital pode prever reserva de contingência entre 5% e 15% do valor global.",
        "severidade": "info",
        "parametros": {
          "minimo": 5,
          "maximo": 15
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 16",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "sem_custos_indiretos",
        "descricao": "O regime não previa custos indiretos, e a taxa de administração era vedada.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "seção 11 da conferência (antes × agora)",
          "aConfirmar": true
        }
      }
    ]
  },
  "alteracoes": {
    "janela": {
      "aPartirDe": "assinatura_termo",
      "ate": "fim_execucao",
      "descricao": "Durante a execução, que começa com o Termo de Compromisso publicado e o desbloqueio da conta; é vedado executar qualquer alteração antes da autorização formal.",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 50 e 72",
        "aConfirmar": true,
        "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
      }
    },
    "tipos": {
      "remanejamento": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "Depois do remanejamento, os custos indiretos e a elaboração continuam dentro dos tetos.",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 21, III e IV",
              "aConfirmar": true,
              "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "termo_de_apostilamento",
            "descricao": "Remanejamento sem alterar o valor global vai por Termo de Apostilamento, sempre com aprovação prévia.",
            "severidade": "bloqueio",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 69, § 2º",
              "aConfirmar": true,
              "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
            }
          }
        ],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 69, § 2º, e 72",
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. O anexo não tem remanejamento livre: toda mudança exige autorização prévia.",
          "aConfirmar": true
        }
      },
      "complementacao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "acumulado_maximo",
            "percentual": 20,
            "base": "valor_homologado_execucao",
            "severidade": "bloqueio",
            "descricao": "Captação a maior com readequação de até 20% do aprovado.",
            "fonte": {
              "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
              "dispositivo": "art. 70"
            }
          },
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "A readequação respeita os tetos.",
            "fonte": {
              "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
              "dispositivo": "art. 27, § 3º"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "pedido_em_30_dias",
            "descricao": "Pedido em 30 dias do fim da captação ou do aviso antecipado de conclusão.",
            "severidade": "alerta",
            "parametros": {
              "dias": 30
            },
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 59",
              "aConfirmar": true,
              "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
            }
          },
          {
            "codigo": "excedente_recolhido",
            "descricao": "O que passar de 120% do aprovado é recolhido.",
            "severidade": "alerta",
            "fonte": {
              "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
              "dispositivo": "cl. 2ª, subcl. 2ª",
              "aConfirmar": true,
              "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
            }
          },
          {
            "codigo": "termo_aditivo",
            "descricao": "Mudar valores, metas ou prazo durante a execução exige termo aditivo.",
            "severidade": "info",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 72, § 1º",
              "aConfirmar": true,
              "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
            }
          }
        ],
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 70"
        }
      },
      "reducao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "captado_minimo",
            "percentual": 60,
            "base": "valor_homologado_execucao",
            "severidade": "bloqueio",
            "descricao": "Com 60% ou mais captado, readequação para menor; 100% para executar sem readequar.",
            "fonte": {
              "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
              "dispositivo": "arts. 68 e 69"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "pedido_em_30_dias",
            "descricao": "Readequação para menor em 30 dias do fim da captação; a execução só começa depois de aprovada (SE em 10 dias, secretaria em 30, portaria em 10).",
            "severidade": "alerta",
            "parametros": {
              "dias": 30
            },
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 58",
              "aConfirmar": true,
              "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
            }
          }
        ],
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "arts. 68 e 69"
        }
      },
      "inclusao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Com o item novo, os grupos continuam dentro dos tetos.",
            "fonte": {
              "documento": "Anexo LXXXVI-A da PRC 5/2017",
              "dispositivo": "art. 21, III e IV",
              "aConfirmar": true,
              "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 72",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    },
    "alertasPorItem": [],
    "prazoAnalise": null,
    "silencioAprova": false,
    "regras": [
      {
        "codigo": "rendimentos_por_apostilamento",
        "descricao": "Usar rendimentos ou saldos antes do término exige aprovação prévia e Termo de Apostilamento.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 69, § 2º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "suspensao",
        "descricao": "Suspensão a pedido por até 120 dias; depois, o projeto é encerrado.",
        "severidade": "info",
        "parametros": {
          "dias": 120
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 77",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "remanejamento_entre_projetos",
        "descricao": "Remanejamento entre Contas Captação: mesmo CNPJ, programa e ano fiscal, depois do fim da captação e antes da readequação e do Termo.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 61 a 64",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "prorrogacao",
        "descricao": "Pedido de prorrogação até 60 dias antes do fim do prazo.",
        "severidade": "alerta",
        "parametros": {
          "diasAntes": 60
        },
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 86"
        }
      },
      {
        "codigo": "remanejamento_entre_projetos",
        "descricao": "No remanejamento entre projetos, o ganho do beneficiário ficava limitado a 20% do aprovado.",
        "severidade": "alerta",
        "parametros": {
          "percentual": 20
        },
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 75, § 3º"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 58, 59, 69 e 72",
      "aConfirmar": true,
      "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
    }
  },
  "fornecedores": {
    "limites": [],
    "partesRelacionadas": {
      "descricao": "É vedado captar de entidades vinculadas à proponente; exposição de marca do doador é vantagem indevida.",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 51 e 96, parágrafo único",
        "aConfirmar": true,
        "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
      }
    },
    "regras": [
      {
        "codigo": "vantagem_ao_doador",
        "descricao": "Despesa que gere vantagem ao doador é vedada; com dolo, multa de 2 vezes a vantagem.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, IV; Lei 12.715/2012, art. 13",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "unidade_executora",
        "descricao": "A instituição executa o projeto e não transfere as atividades principais.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 76, § 3º; minuta do TC, cl. 9ª",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "intermediacao",
        "descricao": "Intermediação é vedada, salvo a contratação de elaboração do projeto e de captação.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Lei 12.715/2012",
          "dispositivo": "art. 11; minuta do TC, cl. 1ª, subcl. 2ª",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "equipe_ligada_a_acao",
        "descricao": "Equipe do quadro ou contratada só para ações do plano, com relação direta com o objeto.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 20, § 1º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 20, 51 e 76",
      "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. O anexo não fixa limite percentual por fornecedor nem por parte relacionada.",
      "aConfirmar": true
    }
  },
  "contas": {
    "contas": [
      {
        "tipo": "captacao",
        "descricao": "Conta Captação, bloqueada, que recebe as doações",
        "abertaPor": "orgao"
      },
      {
        "tipo": "movimento",
        "descricao": "Conta Movimento, de livre movimentação, só para despesas do projeto",
        "abertaPor": "orgao"
      }
    ],
    "bancos": [
      "Banco do Brasil"
    ],
    "descricao": "Duas contas por projeto, abertas pelo MS em instituição financeira oficial; a instituição autoriza o banco, de forma irrevogável, a cumprir as ordens do MS.",
    "tarifas": {
      "regra": "norma_silente",
      "descricao": "O regime anterior não trata de tarifas bancárias.",
      "fonte": {
        "documento": "Manual de análise contábil e financeira PRONON e PRONAS/PCD (FNS, 2019), Anexo III",
        "dispositivo": "seção 3 (contas)"
      }
    },
    "liberacao": {
      "descricao": "A execução só começa com 100% captado e o Termo de Compromisso assinado e publicado; de 60% a 99,99%, readequação para menor; abaixo de 60%, indeferimento. Rendimentos não contam.",
      "percentualMinimo": 100,
      "base": "valor_aprovado_execucao",
      "fonte": {
        "documento": "Anexo LXXXVI-A da PRC 5/2017",
        "dispositivo": "arts. 50, 56, 58, 60, III, e 69, § 3º",
        "aConfirmar": true,
        "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
      }
    },
    "rendimentos": {
      "aplicacao": "obrigatoria",
      "contamComoCaptado": null,
      "uso": "Aplicação obrigatória em fundo de curto prazo ou em operação de mercado aberto lastreada em título público federal; os rendimentos somam no total de recursos e voltam com o saldo.",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 82"
      }
    },
    "saldo": {
      "descricao": "Saldos das contas Captação e Movimento, com rendimentos, recolhidos à Conta Única do Tesouro por GRU em 30 dias da notificação, sem prejuízo ao doador; recursos não usados podem voltar da Conta Movimento para a Captação.",
      "prazo": "devolucaoSaldo",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 88 e § 1º; art. 92, VIII"
      }
    },
    "regras": [
      {
        "codigo": "captacao_depois_da_publicacao",
        "descricao": "Captação só depois da publicação da aprovação e da notificação de abertura da Conta Captação, dentro do período do ato MF/MS.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 39, 47, § 2º, e 48",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "doacao_em_bens",
        "descricao": "Doações em bens, comodato ou insumos exigem recibos antes da liberação; insumos de doador PJ, com nota, validade de 12 meses e preço até o orçado.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 52 a 56, § 3º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "captacao_acima",
        "descricao": "Acima de 120% do aprovado, o excedente é desconsiderado e recolhido.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 2ª, subcl. 2ª",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "contas_bloqueadas",
        "descricao": "A Conta Captação é bloqueada no fim da captação ou com 100%; as contas são encerradas depois da vigência do Termo.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 47, §§ 3º e 4º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "recursos_publicos",
        "descricao": "Os recursos são públicos, impenhoráveis e não integram o patrimônio da entidade.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 67",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "regularidade",
        "descricao": "Regularidade fiscal mantida o tempo todo (CRF/FGTS, CND, CEPIM, CADIN, CNDT); com irregularidade, o MS pode bloquear as contas.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 65, §§ 1º e 3º; minuta do TC, cl. 3ª",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "recibo_por_deposito",
        "descricao": "Recibo por depósito em 3 vias, com ofício ao MS em 20 dias.",
        "severidade": "alerta",
        "parametros": {
          "dias": 20
        },
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 64"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 47 a 69",
      "aConfirmar": true,
      "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
    }
  },
  "pagamentos": {
    "meiosPermitidos": null,
    "meiosVedados": [],
    "descricao": "O regime não restringe o meio de pagamento e cita cheques entre os documentos; cada débito da Conta Movimento corresponde a um comprovante.",
    "documentoFiscal": [
      {
        "codigo": "em_nome_da_instituicao",
        "descricao": "Documentos emitidos única e exclusivamente em nome da instituição.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 95"
        }
      },
      {
        "codigo": "sipar_e_projeto",
        "descricao": "Número do processo, registro no SIPAR, nome do projeto e discriminação em faturas, recibos, notas e cheques; sem como incluir, o representante legal declara no próprio documento.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 95, §§ 1º e 2º"
        }
      }
    ],
    "regras": [
      {
        "codigo": "um_comprovante_por_debito",
        "descricao": "Cada débito da Conta Movimento corresponde a um comprovante de regular aplicação.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 83"
        }
      }
    ],
    "fonte": {
      "documento": "Manual de análise contábil e financeira PRONON e PRONAS/PCD (FNS, 2019), Anexo III",
      "dispositivo": "seção 3 (meios de pagamento)"
    }
  },
  "despesas": {
    "periodo": {
      "descricao": "Da celebração do Termo de Compromisso ao fim do prazo de execução, sob pena de ressarcimento.",
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 84"
      }
    },
    "vedadas": [
      {
        "codigo": "taxa_administracao",
        "descricao": "Taxa de administração",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, I",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "consultoria_de_servidor",
        "descricao": "Pagamento a servidor público por consultoria",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, II",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "clube_de_servidores",
        "descricao": "Clubes e associações de servidores",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, III",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "vantagem_ao_doador",
        "descricao": "Vantagem ao doador",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, IV",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "festas_bufe",
        "descricao": "Festas e bufê, salvo refeições de profissionais e ações educativas",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, V",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "primeira_classe",
        "descricao": "Passagem de primeira classe ou executiva",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, VI",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "taxas_multas_juros",
        "descricao": "Taxas bancárias, multas, juros e correção",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, VII",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "acao_ja_no_sus",
        "descricao": "Ações médico-assistenciais que a instituição já executa pelo SUS",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, VIII; art. 24",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "antes_do_termo",
        "descricao": "Fato gerador anterior à vigência do Termo, salvo elaboração e captação",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, IX",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "custeio_duplo",
        "descricao": "Despesa já custeada por outro instrumento",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 22, X",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "compra_centralizada",
        "descricao": "Medicamentos de compra centralizada pelo MS",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 30, § 3º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "procedimentos_com_equipamentos",
        "descricao": "Custear os procedimentos feitos com os equipamentos adquiridos (salvo o previsto no edital)",
        "fonte": {
          "documento": "Edital de Chamamento MS 3/2025",
          "dispositivo": "item 7.4.13",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    ],
    "regras": [
      {
        "codigo": "encargos_da_instituicao",
        "descricao": "Encargos trabalhistas da equipe são responsabilidade exclusiva da instituição, sem vínculo com a administração.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 19 e 20, § 2º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "sem_sobreposicao_sus",
        "descricao": "Metas e produção não repetem o que é contratado pelo SUS ou usado para o CEBAS.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 24",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "obras_com_requisitos",
        "descricao": "Obras e reformas eram admitidas com requisitos (vedadas só no anexo novo).",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "seção 11 da conferência (antes × agora)",
          "aConfirmar": true
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 21 a 31",
      "aConfirmar": true,
      "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
    }
  },
  "porte": {
    "lacuna": "nao_se_aplica",
    "motivo": "O anexo não classifica projetos por porte: a análise é por resultados, e o financeiro só é examinado quando uma meta falha ou por amostragem.",
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 81, § 3º; art. 88",
      "aConfirmar": true,
      "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
    }
  },
  "objeto": {
    "descricao": "Análise por resultados: documentos do plano, resultados esperados × atingidos, metas do período × resultados, ações, comprovantes do objeto, satisfação do público e sustentabilidade; produção médico-assistencial registrada só no CMD.",
    "regras": [
      {
        "codigo": "metas_resultados",
        "descricao": "Resultados esperados × atingidos e metas do período × resultados, com justificativa das metas não cumpridas.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, II, III e VII",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "evidencias",
        "descricao": "Comprovantes do objeto: listas de presença, fotos e vídeos.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, V",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "docentes",
        "descricao": "Em projetos de educação, relação de docentes e lista nominal dos profissionais qualificados, assinada pelo coordenador e pelo dirigente.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, VI",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "satisfacao",
        "descricao": "Pesquisa de satisfação do público-alvo ou declaração de entidade local ou do conselho de saúde.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 79, § 4º; art. 87, IX",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "sustentabilidade",
        "descricao": "Sustentabilidade, quando a instituição fica com os bens.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, X",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "cmd",
        "descricao": "Produção médico-assistencial registrada exclusivamente no CMD também nos projetos antigos (antes, no CIHA).",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Portaria GM/MS 8.031/2025",
          "dispositivo": "art. 3º"
        }
      },
      {
        "codigo": "pesquisa_autorizada",
        "descricao": "Pesquisa com aprovação de CEP, Anvisa e CTNBio antes de começar.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 17, § 1º, VIII",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "insumos_remanescentes",
        "descricao": "Insumos não usados vão ao ente que deu a anuência; para mantê-los, pedir ao gestor 30 dias antes do fim.",
        "severidade": "alerta",
        "parametros": {
          "diasAntes": 30
        },
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 54",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "bens_permanentes",
        "descricao": "Equipamentos e material permanente com identificação do projeto, inventário e destino no fim.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 80; minuta do TC, documento XI",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "dados_de_pacientes",
        "descricao": "Dados de saúde são sensíveis: sem prontuário no sistema, dados criptografados e destruídos ou devolvidos a pedido do MS.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 8ª",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "contrapartida",
        "descricao": "Contrapartida é facultativa; em bens e serviços, com valor identificado no Termo.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 14, § 5º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 74, 79 e 87",
      "aConfirmar": true,
      "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
    }
  },
  "divulgacao": {
    "marcas": [
      "Ministério da Saúde"
    ],
    "aprovacaoPrevia": {
      "exigida": false,
      "prazo": null,
      "silencioAprova": false,
      "descricao": "Nem o anexo nem a minuta do Termo exigem aprovação prévia das peças; o material leva o logotipo e a menção ao MS.",
      "fonte": {
        "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
        "dispositivo": "cl. 2ª, II, s e t",
        "aConfirmar": true,
        "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
      }
    },
    "defeso": null,
    "regras": [
      {
        "codigo": "logotipo_do_ms",
        "descricao": "Material de comunicação com o logotipo e a menção ao Ministério da Saúde.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 2ª, II, s e t",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "sem_marca_de_doador",
        "descricao": "Exposição de material publicitário dos doadores pela instituição ou pelos usuários é vantagem indevida.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 96, parágrafo único",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "patrocinio_promocional",
        "descricao": "Patrocínio com finalidade promocional depende de ato do Ministro, ainda não publicado.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 100",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "art. 96; minuta do TC, cl. 2ª",
      "aConfirmar": true,
      "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
    }
  },
  "envio": {
    "sistema": "AR, Sedex ou protocolo",
    "descricao": "Prestação entregue por AR, Sedex ou protocolo, com os documentos do art. 92 e a auditoria independente.",
    "documentos": [
      {
        "codigo": "relatorio_objeto",
        "descricao": "Relatório de cumprimento do objeto",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, I"
        }
      },
      {
        "codigo": "fisico_financeiro",
        "descricao": "Relatório final de execução físico-financeira",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, II"
        }
      },
      {
        "codigo": "receitas_despesas",
        "descricao": "Relatório de execução de receitas e despesas",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, III"
        }
      },
      {
        "codigo": "relacao_pagamentos",
        "descricao": "Relação de pagamentos",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, IV"
        }
      },
      {
        "codigo": "extrato",
        "descricao": "Extrato da conta, do recebimento ao último pagamento",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, V"
        }
      },
      {
        "codigo": "rendimentos",
        "descricao": "Demonstrativo de rendimentos das aplicações",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, VI"
        }
      },
      {
        "codigo": "gru",
        "descricao": "Comprovante de recolhimento dos recursos não aplicados por GRU, quando houver",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, VII"
        }
      },
      {
        "codigo": "volta_para_captacao",
        "descricao": "Comprovante de transferência dos recursos não usados da Conta Movimento para a Captação, quando houver",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, VIII"
        }
      },
      {
        "codigo": "comprovantes_despesa",
        "descricao": "Cópia dos documentos comprobatórios das despesas",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, IX"
        }
      },
      {
        "codigo": "bens",
        "descricao": "Relação de bens adquiridos ou produzidos",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, X"
        }
      },
      {
        "codigo": "fotos",
        "descricao": "Fotografias e reportagens da execução",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, XI"
        }
      },
      {
        "codigo": "equipamentos",
        "descricao": "Relação de equipamentos e materiais permanentes, com identificação do projeto e inventário físico",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, XII"
        }
      },
      {
        "codigo": "producao",
        "descricao": "Informações de produção (CIHA; hoje, CMD)",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, XIII",
          "nota": "A Portaria GM/MS 8.031/2025, art. 3º, levou os projetos antigos para o CMD."
        }
      },
      {
        "codigo": "encerramento_conta",
        "descricao": "Comprovante de encerramento da Conta Movimento",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, XIV"
        }
      },
      {
        "codigo": "auditoria",
        "descricao": "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente (CRC)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 92, parágrafo único"
        }
      }
    ],
    "modelos": [],
    "regras": [
      {
        "codigo": "manual_nao_publicado",
        "descricao": "O Manual Orientativo, com os modelos, não foi publicado até 01/10/2026; seguir o anexo, a minuta do Termo e os atos SE/MS.",
        "severidade": "info",
        "fonte": {
          "documento": "Portaria GM/MS 8.031/2025",
          "dispositivo": "art. 2º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "impropriedades_registradas",
        "descricao": "Impropriedades que levam à rejeição ficam registradas no Transferegov e pesam em parcerias futuras.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 81, § 2º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "arts. 91 e 92"
    }
  },
  "posEnvio": {
    "resultados": [
      {
        "resultado": "aprovada",
        "descricao": "Objeto e metas cumpridos integralmente.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 84",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "resultado": "aprovada_ressalvas",
        "descricao": "Objeto e metas cumpridos, com impropriedade ou falta formal sem dano ao erário.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 84",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "resultado": "reprovada",
        "descricao": "Omissão, descumprimento injustificado de objetivos ou metas, dano por ato de gestão ilegítimo ou antieconômico, desfalque ou desvio.",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 84",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      }
    ],
    "devolucao": {
      "descricao": "GRU para a Conta Única do Tesouro, sem prejuízo ao benefício fiscal do doador, em 30 dias da notificação: saldo do orçamento, saldo ao fim da execução e reprovação parcial ou final.",
      "atualizacao": "O regime anterior não fixa índice; o roteiro do FNS soma recursos iniciais e rendimentos.",
      "gru": [],
      "fonte": {
        "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
        "dispositivo": "art. 88, V a VII e §§ 1º e 2º"
      }
    },
    "regras": [
      {
        "codigo": "tce",
        "descricao": "TCE por não aplicação ou aplicação incorreta, inclusive antes do fim da parceria, com registro no SIAFI.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "arts. 76, § 1º, 81, § 1º, 92 e 93",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "omissao_sanavel",
        "descricao": "A omissão pode ser sanada até o julgamento da TCE.",
        "severidade": "info",
        "fonte": {
          "documento": "Anexo LXXXVI-A da PRC 5/2017",
          "dispositivo": "art. 87, § 2º",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "rescisao",
        "descricao": "Na rescisão do Termo, restituição integral com atualização, inclusive em aprovação com ressalvas.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Minuta do Termo de Compromisso (Editais MS 2/2025 e 3/2025)",
          "dispositivo": "cl. 12ª",
          "aConfirmar": true,
          "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida. Redação mais dura que a do anexo."
        }
      },
      {
        "codigo": "analise_financeira_fns",
        "descricao": "Superintendência Estadual do MS faz a análise contábil e financeira (AACF), que segue ao DESID e à área técnica, para o parecer conclusivo.",
        "severidade": "info",
        "fonte": {
          "documento": "Manual de análise contábil e financeira PRONON e PRONAS/PCD (FNS, 2019), Anexo III",
          "dispositivo": "seções 1.0 e 6.0, p. 5 e 7"
        }
      },
      {
        "codigo": "inabilitacao",
        "descricao": "Inabilitação pelos critérios do art. 105 do regime anterior.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
          "dispositivo": "art. 105"
        }
      }
    ],
    "fonte": {
      "documento": "Anexo LXXXVI-A da PRC 5/2017",
      "dispositivo": "arts. 81 a 95",
      "aConfirmar": true,
      "nota": "Conferido no Anexo LXXXVI-A; no Anexo LXXXVI a regra equivalente não foi conferida."
    }
  },
  "guarda": {
    "marco": "registro_decisao",
    "quantidade": 5,
    "unidade": "anos",
    "prorrogaParaDiaUtil": false,
    "descricao": "Documentos guardados por 5 anos a partir da aprovação da prestação de contas.",
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 95"
    }
  }
}$regime$::jsonb,
  $fontes$[
  {
    "documento": "PRC GM/MS 5/2017 compilada (Anexo LXXXVI, revogado)",
    "url": "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2017/prc0005_03_10_2017_comp.html"
  },
  {
    "documento": "Portaria GM/MS 8.031/2025 (revoga o Anexo LXXXVI)",
    "url": "https://www.in.gov.br/web/dou/-/portaria-gm/ms-n-8.031-de-5-de-setembro-de-2025-653608142"
  },
  {
    "documento": "Lei 12.715/2012 (Planalto)",
    "url": "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12715.htm"
  }
]$fontes$::jsonb,
  $checklist$[
  {
    "codigo": "relatorio_objeto",
    "descricao": "Relatório de cumprimento do objeto",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, I"
    }
  },
  {
    "codigo": "fisico_financeiro",
    "descricao": "Relatório final de execução físico-financeira",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, II"
    }
  },
  {
    "codigo": "receitas_despesas",
    "descricao": "Relatório de execução de receitas e despesas",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, III"
    }
  },
  {
    "codigo": "relacao_pagamentos",
    "descricao": "Relação de pagamentos",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, IV"
    }
  },
  {
    "codigo": "extrato",
    "descricao": "Extrato da conta, do recebimento ao último pagamento",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, V"
    }
  },
  {
    "codigo": "rendimentos",
    "descricao": "Demonstrativo de rendimentos das aplicações",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, VI"
    }
  },
  {
    "codigo": "gru",
    "descricao": "Comprovante de recolhimento dos recursos não aplicados por GRU, quando houver",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, VII"
    }
  },
  {
    "codigo": "volta_para_captacao",
    "descricao": "Comprovante de transferência dos recursos não usados da Conta Movimento para a Captação, quando houver",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, VIII"
    }
  },
  {
    "codigo": "comprovantes_despesa",
    "descricao": "Cópia dos documentos comprobatórios das despesas",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, IX"
    }
  },
  {
    "codigo": "bens",
    "descricao": "Relação de bens adquiridos ou produzidos",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, X"
    }
  },
  {
    "codigo": "fotos",
    "descricao": "Fotografias e reportagens da execução",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, XI"
    }
  },
  {
    "codigo": "equipamentos",
    "descricao": "Relação de equipamentos e materiais permanentes, com identificação do projeto e inventário físico",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, XII"
    }
  },
  {
    "codigo": "producao",
    "descricao": "Informações de produção (CIHA; hoje, CMD)",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, XIII",
      "nota": "A Portaria GM/MS 8.031/2025, art. 3º, levou os projetos antigos para o CMD."
    }
  },
  {
    "codigo": "encerramento_conta",
    "descricao": "Comprovante de encerramento da Conta Movimento",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, XIV"
    }
  },
  {
    "codigo": "auditoria",
    "descricao": "Demonstrações contábeis e financeiras com parecer conclusivo de auditoria independente (CRC)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Anexo LXXXVI da PRC 5/2017 (revogado)",
      "dispositivo": "art. 92, parágrafo único"
    }
  }
]$checklist$::jsonb,
  $modelos$[]$modelos$::jsonb,
  now()
)
on conflict (codigo, versao) do nothing;

-- Audiovisual (ANCINE) — IN 159/2021 (versão 1)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'ancine_in159_2021' and versao < 1 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, vigente_ate, status, parametros, fontes, checklist_envio, modelos_saida, publicado_em)
values (
  'ancine_in159_2021', 1, 'Audiovisual (ANCINE) — IN 159/2021', 'audiovisual', 'audiovisual',
  'federal', 'ANCINE', 'STR e Protocolo Digital', 'Lei 8.685/1993; Lei 8.313/1991, arts. 18 e 25; MP 2.228-1/2001; IN ANCINE 159/2021 (alterada pelas INs 160, 164, 167 e 176); IN ANCINE 158/2021; IN ANCINE 130/2016',
  '2022-01-17'::date, null, 'publicado',
  $regime${
  "codigo": "ancine_in159_2021",
  "versao": 1,
  "nome": "Audiovisual (ANCINE) — IN 159/2021",
  "area": "audiovisual",
  "mecanismo": "audiovisual",
  "esfera": "federal",
  "orgao": "ANCINE",
  "sistemaOficial": "STR e Protocolo Digital",
  "normaReferencia": "Lei 8.685/1993; Lei 8.313/1991, arts. 18 e 25; MP 2.228-1/2001; IN ANCINE 159/2021 (alterada pelas INs 160, 164, 167 e 176); IN ANCINE 158/2021; IN ANCINE 130/2016",
  "vigenteDesde": "2022-01-17",
  "identificadorOficial": {
    "tipo": "salic",
    "rotulo": "SALIC"
  },
  "fontes": [
    {
      "documento": "IN ANCINE 159/2021 (consolidada)",
      "url": "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159"
    },
    {
      "documento": "IN ANCINE 176/2026",
      "url": "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-176"
    },
    {
      "documento": "Manuais de prestação de contas (ANCINE)",
      "url": "https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais"
    },
    {
      "documento": "Manual STR v2.2",
      "url": "https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdoSTRVerso2.2v_30_09_2025.pdf/@@display-file/file"
    },
    {
      "documento": "Manual de Aplicação da Logomarca v3.0",
      "url": "https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdeAplicacaodeLogomarcav.0324agosto22.pdf/@@display-file/file"
    },
    {
      "documento": "FAQ da Superintendência de Prestação de Contas",
      "url": "https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr"
    }
  ],
  "aplicabilidade": {
    "criterio": "aprovacao_projeto",
    "desde": "2022-01-17",
    "ate": null,
    "descricao": "Projetos aprovados a partir de 17/01/2022; no fomento direto sem aprovação inicial, marco inicial de despesas a partir dessa data. Antes, IN 150/2019 e IN 125/2015. No FSA, edital e contrato, com a IN 159 subsidiária.",
    "sucede": [
      "ancine_in150_2019"
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "art. 63; Manual de Prestação de Contas v2.11, p. 4",
      "nota": "FSA: IN 159, art. 57, e FAQ SPR 1.3."
    }
  },
  "prazos": {
    "prestacaoFinal": {
      "descricao": "Prestação de contas final, contada da conclusão do objeto (CPB, lançamento comercial, último dia do festival ou entrega do desenvolvimento)",
      "responsavel": "proponente",
      "marco": "conclusao_objeto",
      "quantidade": 180,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "arts. 3º a 5º",
        "nota": "Se a 1ª liberação for posterior à conclusão, conta da liberação. Vários processos do mesmo objeto: vale o último prazo, com uma prestação por processo. No FSA, o prazo do contrato."
      }
    },
    "fimExecucaoFinanceira": {
      "descricao": "Última despesa do projeto (fim da execução financeira)",
      "responsavel": "proponente",
      "marco": "conclusao_objeto",
      "quantidade": 180,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 158/2021",
        "dispositivo": "art. 57; FAQ SPR 2.10"
      }
    },
    "respostaDiligencia": {
      "descricao": "Atender diligência, da confirmação de recebimento; prorrogável uma vez por 30 dias a pedido justificado",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 45 e § 3º",
        "nota": "Omissão leva a inadimplência; mais 30 dias sem saneamento, a proposta de não aprovação."
      }
    },
    "notificacaoOmissao": {
      "descricao": "Apresentar a prestação omitida depois da notificação, sob pena de TCE ou cobrança",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 6º"
      }
    },
    "analisePrestacao": {
      "lacuna": "norma_silente",
      "motivo": "A IN 159 não fixa prazo para a ANCINE analisar a prestação; o de 90 dias da IN 158 vale para os pedidos de acompanhamento.",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "texto integral; FAQ SPR"
      }
    },
    "analiseAcompanhamento": {
      "descricao": "Análise de pedido de acompanhamento (remanejamento, prorrogação), interrompida por diligência",
      "responsavel": "orgao",
      "marco": "protocolo_alteracao",
      "quantidade": 90,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 158/2021",
        "dispositivo": "art. 3º, II e § 3º"
      }
    },
    "recurso": {
      "descricao": "Recurso com efeito suspensivo, do recebimento da notificação; última instância é a Diretoria Colegiada",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "arts. 48 a 50"
      }
    },
    "devolucao": {
      "descricao": "Pagar a GRU da glosa ou do débito, calculada pela ANCINE",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 69; IN 159, arts. 31 e 32",
        "nota": "Sem pagamento, recurso ou parcelamento, a prestação é não aprovada e incide multa."
      }
    },
    "correcaoLogomarcaInfraestrutura": {
      "descricao": "Corrigir a placa de infraestrutura depois da decisão",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 130/2016, com a IN 152/2020",
        "dispositivo": "art. 9º"
      }
    }
  },
  "prestacaoParcial": {
    "modalidades": [
      "a_criterio_do_orgao"
    ],
    "descricao": "A ANCINE pode pedir prestação parcial conforme o regramento (avaliação da execução parcial da IN 158): documentos do Anexo sem os incisos IV e V e extratos da abertura até a data da prestação. Despesas aprovadas na parcial podem ser reanalisadas na final.",
    "prazo": null,
    "regras": [
      {
        "codigo": "sem_gru_nem_encerramento",
        "descricao": "A parcial dispensa os comprovantes de recolhimento e de encerramento das contas.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 2º, § 3º"
        }
      },
      {
        "codigo": "extratos_ate_a_data",
        "descricao": "Na parcial, os extratos vão da abertura da conta até a data da prestação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 18, nota 3"
        }
      },
      {
        "codigo": "reanalise_na_final",
        "descricao": "Despesas aprovadas na parcial podem ser reanalisadas na final.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 54 a 56"
        }
      },
      {
        "codigo": "fsa_especial",
        "descricao": "A prestação especial do contrato FSA segue as regras da parcial.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 57"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "arts. 54 a 57"
    }
  },
  "orcamento": {
    "estrutura": {
      "niveis": [
        "Item orçamentário (IV.a e IV.b do DO)",
        "Item"
      ],
      "descricao": "Orçamento analítico aprovado por item; o DO compara o aprovado com o captado por fonte e com o executado. Tributos retidos e encargos entram na rubrica do fato gerador.",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 12 e 60; Demonstrativo Orçamentário e Financeiro, seção IV"
      }
    },
    "grupos": [
      {
        "codigo": "execucao",
        "rotulo": "Itens do projeto",
        "descricao": "Itens financiáveis de desenvolvimento, produção, distribuição ou da modalidade.",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31"
        }
      },
      {
        "codigo": "gerenciamento",
        "rotulo": "Gerenciamento",
        "descricao": "Gerenciamento da produção, com toda a infraestrutura; só produtora brasileira.",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, I"
        }
      },
      {
        "codigo": "agenciamento",
        "rotulo": "Agenciamento",
        "descricao": "Agenciamento de captação pela Lei 8.313 e pelo art. 1º-A da Lei 8.685.",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, II"
        }
      },
      {
        "codigo": "colocacao",
        "rotulo": "Coordenação e colocação",
        "descricao": "Coordenação e colocação de certificados do art. 1º da Lei 8.685 (taxas, prospecto, agente divulgador).",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, III"
        }
      }
    ],
    "bases": {
      "orcamento_producao": {
        "descricao": "Orçamento de produção: os itens do projeto, sem gerenciamento, agenciamento e colocação.",
        "soma": "todos",
        "exceto": [
          "gerenciamento",
          "agenciamento",
          "colocacao"
        ],
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, I",
          "aConfirmar": true,
          "nota": "A fonte não detalha o que entra no orçamento de produção; o limite também se prende ao executado com recursos ANCINE."
        }
      },
      "valor_total_projeto": {
        "descricao": "Orçamento global aprovado.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 27–28"
        }
      }
    },
    "tetos": [
      {
        "codigo": "gerenciamento",
        "descricao": "Gerenciamento",
        "grupos": [
          "gerenciamento"
        ],
        "percentual": 10,
        "base": "orcamento_producao",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, I; Lei 11.437/2006, art. 12",
          "nota": "Limitado ao executado com recursos ANCINE; na coprodução internacional, só a parte brasileira. O excesso é glosado (IN 159, art. 18, VI)."
        }
      },
      {
        "codigo": "agenciamento",
        "descricao": "Agenciamento",
        "grupos": [
          "agenciamento"
        ],
        "percentual": 10,
        "base": "valor_autorizado_captacao",
        "proporcionalAoCaptado": true,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, II",
          "nota": "Proporcional ao captado: R$ 100 mil autorizados e R$ 80 mil captados dão teto de R$ 8 mil."
        }
      },
      {
        "codigo": "colocacao",
        "descricao": "Coordenação e colocação",
        "grupos": [
          "colocacao"
        ],
        "percentual": 10,
        "base": "valor_autorizado_captacao",
        "proporcionalAoCaptado": true,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, III",
          "nota": "Sobre o autorizado pelo art. 1º da Lei 8.685, limitado ao captado."
        }
      }
    ],
    "regras": [
      {
        "codigo": "contrapartida_minima",
        "descricao": "Contrapartida de ao menos 5% do orçamento global aprovado quando há mecanismo da Lei do Audiovisual (ou 5% das fontes brasileiras integralizadas, se menor).",
        "severidade": "bloqueio",
        "parametros": {
          "percentual": 5
        },
        "fonte": {
          "documento": "Lei 8.685/1993",
          "dispositivo": "art. 4º, § 2º, I; IN 159, art. 16, § 1º"
        }
      },
      {
        "codigo": "agenciamento_vedado",
        "descricao": "Agenciamento vedado em editais, FSA, programas internacionais e seleções de estatais, e a proponente, coprodutores, grupo econômico ou sócios.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, IV"
        }
      },
      {
        "codigo": "colocacao_autorizada",
        "descricao": "Coordenação e colocação só por agente autorizado na CVM e para o art. 1º da Lei 8.685.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, V"
        }
      },
      {
        "codigo": "gerenciamento_por_quem",
        "descricao": "Gerenciamento não pode ser pago a radiodifusoras, programadoras, distribuidoras ou telefônicas.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XIX"
        }
      }
    ]
  },
  "alteracoes": {
    "janela": {
      "aPartirDe": null,
      "ate": "fim_execucao",
      "descricao": "Durante a execução; o pedido prévio vai à Superintendência de Fomento (SFO).",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 27–28"
      }
    },
    "tipos": {
      "remanejamento": {
        "permitido": true,
        "classificacao": "administrativa",
        "condicoes": [
          {
            "tipo": "movido_ate",
            "percentual": 20,
            "base": "valor_total_projeto",
            "acumulado": true,
            "descricao": "O conjunto de alterações (extrapolações mais rubricas novas) fica abaixo de 20% do orçamento global aprovado.",
            "fonte": {
              "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
              "dispositivo": "p. 27–28",
              "nota": "Vale para projetos fora dos limites de grandes itens da IN 158 (arts. 49 e 50)."
            }
          }
        ],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "Gerenciamento, agenciamento e colocação continuam dentro dos limites.",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, VI"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "justificar_na_pc",
            "descricao": "Toda alteração é justificada na prestação, mesmo abaixo de 20%; nada é aprovado automaticamente e a não acatada é glosada.",
            "severidade": "alerta",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 20; Manual v2.11, p. 20 e 28"
            }
          },
          {
            "codigo": "aporte_nao_financeiro",
            "descricao": "Itens comprovados com aporte não financeiro de terceiros para a captação mínima não são remanejados nem pagos com recursos ANCINE.",
            "severidade": "bloqueio",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, XXXII"
            }
          }
        ],
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 27–28"
        }
      },
      "complementacao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "O redimensionamento respeita os limites.",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, VI"
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)",
          "dispositivo": "§ 4.10; IN 158, arts. 49 e 50",
          "aConfirmar": true,
          "nota": "Redimensionamento do orçamento depende de aprovação prévia; o texto da IN 158 não foi lido."
        }
      },
      "reducao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Depois da redução, os grupos continuam dentro dos limites.",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, VI"
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)",
          "dispositivo": "§ 4.10; IN 158, arts. 49 e 50",
          "aConfirmar": true,
          "nota": "Redimensionamento do orçamento depende de aprovação prévia; o texto da IN 158 não foi lido."
        }
      },
      "inclusao": {
        "permitido": true,
        "classificacao": "administrativa",
        "condicoes": [
          {
            "tipo": "movido_ate",
            "percentual": 20,
            "base": "valor_total_projeto",
            "acumulado": true,
            "descricao": "Rubricas novas e extrapolações, somadas, ficam abaixo de 20% do orçamento global aprovado.",
            "fonte": {
              "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
              "dispositivo": "p. 27–28"
            }
          }
        ],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "Com a rubrica nova, os limites continuam respeitados.",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, VI"
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "justificar_na_pc",
            "descricao": "A rubrica nova é justificada na prestação; a não acatada é glosada.",
            "severidade": "alerta",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 20"
            }
          }
        ],
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 27–28"
        }
      }
    },
    "alertasPorItem": [],
    "prazoAnalise": "analiseAcompanhamento",
    "silencioAprova": false,
    "regras": [
      {
        "codigo": "projeto_tecnico",
        "descricao": "Alterar o projeto técnico sem autorização prévia leva a inabilitação.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 28, X; art. 42, II"
        }
      },
      {
        "codigo": "fsa",
        "descricao": "No FSA: abaixo de 20%, sem aprovação prévia e justificado na prestação; acima ou redimensionamento, pela CUP (grandes itens) ou protocolo digital (orçamento detalhado).",
        "severidade": "info",
        "fonte": {
          "documento": "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)",
          "dispositivo": "§ 4.10"
        }
      }
    ],
    "fonte": {
      "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
      "dispositivo": "p. 20 e 27–28"
    }
  },
  "fornecedores": {
    "limites": [
      {
        "codigo": "concentracao",
        "descricao": "Concentração em um mesmo fornecedor ou grupo, somando as RPs de todos os processos da mesma obra e objeto (produção)",
        "escopo": "fornecedor",
        "base": "valor_executado",
        "faixas": [
          {
            "percentual": 25,
            "severidade": "alerta",
            "consequencia": "Advertência e aprovação com ressalvas"
          },
          {
            "percentual": 50,
            "severidade": "bloqueio",
            "consequencia": "Inabilitação por até 2 anos"
          }
        ],
        "excecoes": [
          {
            "descricao": "Animação",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 28, VI"
            }
          },
          {
            "descricao": "Jogos eletrônicos",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 28, VI"
            }
          },
          {
            "descricao": "Orçamento abaixo de R$ 500 mil",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 28, VI"
            }
          }
        ],
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 28, VI; art. 42"
        }
      }
    ],
    "partesRelacionadas": {
      "descricao": "Agenciamento não é pago à proponente, a coprodutores, a empresas com sócios em comum ou do mesmo grupo; bens da proponente, do grupo ou do coprodutor exigem 3 orçamentos de fora do grupo e pagamento até o menor.",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 18, IV, c; Manual v2.11, p. 56"
      }
    },
    "regras": [
      {
        "codigo": "cnae_compativel",
        "descricao": "Prestador com objeto social ou CNAE compatível com o serviço.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 26"
        }
      },
      {
        "codigo": "vinculo_com_emitente",
        "descricao": "Quem presta o serviço tem vínculo societário ou empregatício com a empresa que emite a nota.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXVI"
        }
      },
      {
        "codigo": "agente_de_artista",
        "descricao": "Agente de artista não é pago com recursos do projeto; o artista emite RPA ou nota.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 26–27"
        }
      },
      {
        "codigo": "reincidencia",
        "descricao": "Reincidência na mesma regra, em outro projeto, leva a inabilitação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 42, II"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "arts. 18, 28 e 42"
    }
  },
  "contas": {
    "contas": [
      {
        "tipo": "captacao",
        "descricao": "Conta de captação, do proponente, só para incentivos fiscais (fomento indireto)",
        "abertaPor": "orgao"
      },
      {
        "tipo": "movimento",
        "descricao": "Conta de movimentação, exclusiva do projeto, conforme o orçamento aprovado",
        "abertaPor": "orgao"
      },
      {
        "tipo": "recolhimento",
        "descricao": "Conta de recolhimento do investidor (arts. 3º e 3º-A da Lei 8.685; art. 39, X, da MP 2.228-1)",
        "abertaPor": "orgao"
      },
      {
        "tipo": "aplicacao",
        "descricao": "Aplicação financeira vinculada",
        "abertaPor": "orgao"
      }
    ],
    "bancos": [
      "Banco do Brasil"
    ],
    "descricao": "Contas abertas exclusivamente pela ANCINE no Banco do Brasil; os recursos ficam indisponíveis até a ANCINE autorizar a liberação; fomento direto e FSA não têm conta de captação.",
    "tarifas": {
      "regra": "so_manutencao",
      "descricao": "Tarifas bancárias são glosadas, salvo a de manutenção da conta; a proponente cobre as tarifas antes da incidência ou no mesmo mês.",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 18, VII (red. IN 167/2023); Manual v2.11, p. 24–25"
      }
    },
    "liberacao": {
      "descricao": "Os recursos de captação e os reservados de fomento direto ficam indisponíveis até a ANCINE autorizar a liberação.",
      "percentualMinimo": null,
      "base": null,
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 22"
      }
    },
    "rendimentos": {
      "aplicacao": "automatica",
      "contamComoCaptado": null,
      "uso": "Aplicação automática pelo convênio ANCINE–BB; os rendimentos são aporte complementar, sujeitos às mesmas regras, e entram no total a comprovar do STR.",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 25; Manual STR v2.2, § 5.3.3"
      }
    },
    "saldo": {
      "descricao": "O saldo da captação é recolhido pela ANCINE; o da movimentação e das aplicações, pela proponente, por GRU, com saldo final zero e comprovante de encerramento das contas abertas pela proponente.",
      "prazo": null,
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 14 e 18; IN 159, Anexo, art. 1º, IV e V"
      }
    },
    "regras": [
      {
        "codigo": "sem_outras_contas",
        "descricao": "É proibido transferir recursos para outras contas, mesmo administrativas, salvo as hipóteses de reembolso.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXX; Manual v2.11, p. 23"
        }
      },
      {
        "codigo": "creditos_permitidos",
        "descricao": "A movimentação só recebe liberação da captação ou conta bloqueada, resgate de aplicação e depósitos próprios ou de terceiros para pagar o projeto.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 23"
        }
      },
      {
        "codigo": "emprestimo_e_ressarcimento",
        "descricao": "Recurso próprio depositado antes da liberação é ressarcido da mesma conta de movimentação; no DE, em OUTROS DEPÓSITOS e PAGAMENTOS.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 25"
        }
      },
      {
        "codigo": "movimentos_sem_finalidade",
        "descricao": "Depósitos ou retiradas de recursos próprios sem finalidade de pagamento e transferências que não sejam pagamento levam a ressalva.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 28, VIII e XII"
        }
      },
      {
        "codigo": "contas_inativas",
        "descricao": "Contas abertas pela ANCINE são encerradas automaticamente depois de 2 anos sem saldo.",
        "severidade": "info",
        "parametros": {
          "anos": 2
        },
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 18"
        }
      }
    ],
    "fonte": {
      "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
      "dispositivo": "p. 22 a 25"
    }
  },
  "pagamentos": {
    "meiosPermitidos": [
      "ted",
      "doc",
      "pix",
      "boleto",
      "cambio"
    ],
    "meiosVedados": [
      "cheque",
      "saque"
    ],
    "descricao": "Só transferência eletrônica (TED, DOC, PIX) direto ao real credor, que é o emissor do documento; boleto nos casos listados; câmbio para o exterior; cheque e saque são glosados.",
    "documentoFiscal": [
      {
        "codigo": "titulo_e_salic",
        "descricao": "Documento com título e SALIC do projeto e discriminação do serviço ou bem; em cupom, carimbo no anverso.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 9º e 10; Manual v2.11, p. 27 e 56"
        }
      },
      {
        "codigo": "proponente_tomadora",
        "descricao": "A proponente é a tomadora; contrapartida em nome de coprodutor ou distribuidor só com o contrato.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXI"
        }
      },
      {
        "codigo": "emissao_30_dias",
        "descricao": "Documento emitido até 30 dias depois do débito na conta.",
        "severidade": "bloqueio",
        "parametros": {
          "dias": 30
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXIX"
        }
      },
      {
        "codigo": "documento_habil",
        "descricao": "Documento fiscal hábil, válido, legível e sem rasuras.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXII a XXIV"
        }
      },
      {
        "codigo": "dispensa_de_nota",
        "descricao": "Sem retenção nem nota, recibo com a fundamentação da dispensa (ex.: lei municipal).",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 11"
        }
      },
      {
        "codigo": "rpa",
        "descricao": "RPA com SALIC, título, proponente, período, natureza do serviço, IRRF, INSS patronal, ISS, líquido, total, CPF e assinatura.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 41–42"
        }
      },
      {
        "codigo": "tributos_na_rubrica",
        "descricao": "Tributos lançados em nome do credor da despesa, na rubrica do fato gerador, com tipo DARF ou GPS; IRRF em linha própria.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 60"
        }
      },
      {
        "codigo": "exterior",
        "descricao": "Pagamento ao exterior com invoice em nome da proponente e contrato de câmbio ou SWIFT; valor convertido em reais.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 49–50"
        }
      },
      {
        "codigo": "arquivo_por_documento",
        "descricao": "Documentos fiscais em PDF, um por arquivo, até 15 MB, nomeados pela linha da RP (00012_P.pdf), enviados pelo STR quando pedidos.",
        "severidade": "alerta",
        "parametros": {
          "mb": 15
        },
        "fonte": {
          "documento": "Manual de Envio de Documentos Fiscais – STR (04/05/2021)",
          "dispositivo": "§§ 2 e 6"
        }
      }
    ],
    "regras": [
      {
        "codigo": "reembolso",
        "descricao": "Reembolso só nas hipóteses do art. 15 (diária, figurante até R$ 1.000 por mês, tributos, mercadoria até R$ 1.000 por documento, locação até R$ 1.000, compra no exterior com cartão, aluguel por temporada em plataforma), com recibo de reembolso e despesa anterior ao débito.",
        "severidade": "bloqueio",
        "parametros": {
          "figuranteMes": 1000,
          "mercadoria": 1000,
          "locacao": 1000
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 15; art. 18, X; DDC 1965-E/2023"
        }
      },
      {
        "codigo": "real_credor",
        "descricao": "Pagamento à conta da empresa credora, nunca à de sócios ou funcionários (MEI pode receber em conta de pessoa física).",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 23–24, 27 e 49"
        }
      },
      {
        "codigo": "sem_caixa",
        "descricao": "Proibidos caixa pequeno, cartões pré-pagos, pagamento por conta particular e empréstimo do projeto a contas particulares.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 4 e 24"
        }
      },
      {
        "codigo": "cartao_internacional",
        "descricao": "Cartão de crédito internacional só para compras de mercadorias no exterior, por reembolso; anuidade e taxas não ligadas ao câmbio com recursos próprios.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 15, VI; art. 18, VIII e IX"
        }
      }
    ],
    "fonte": {
      "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
      "dispositivo": "p. 22–24"
    }
  },
  "despesas": {
    "periodo": {
      "descricao": "Da aprovação inicial do projeto para captação (no fomento direto, o marco do edital) até 180 dias da conclusão do objeto; vale a data da prestação do serviço ou da entrega do bem.",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 18, XX; IN 158, art. 57; Manual v2.11, p. 28–30"
      }
    },
    "vedadas": [
      {
        "codigo": "sem_documento",
        "descricao": "Despesa sem documento fiscal",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, I"
        }
      },
      {
        "codigo": "duplicidade",
        "descricao": "Documento em duplicidade ou apresentado em outro projeto",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, II e III"
        }
      },
      {
        "codigo": "acima_dos_limites",
        "descricao": "Pagamento acima dos limites de gerenciamento, agenciamento e colocação",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, VI"
        }
      },
      {
        "codigo": "juros_multas_tarifas",
        "descricao": "Juros, multas, IOC, IOF, tarifas (salvo manutenção) e encargos contratuais",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, VII"
        }
      },
      {
        "codigo": "sem_vinculo",
        "descricao": "Passagens, hospedagem e diárias sem vínculo comprovado com o projeto",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XI"
        }
      },
      {
        "codigo": "auditoria",
        "descricao": "Serviço de auditoria independente",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XII"
        }
      },
      {
        "codigo": "condecine_certificados",
        "descricao": "CONDECINE, classificação indicativa, CPB e CRT",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XIII"
        }
      },
      {
        "codigo": "rubrica_glosada",
        "descricao": "Despesa em rubrica glosada ou não autorizada antes da prestação",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XIV"
        }
      },
      {
        "codigo": "copias_no_exterior",
        "descricao": "Cópias e matrizes feitas no exterior para exploração no Brasil",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XV"
        }
      },
      {
        "codigo": "material_permanente",
        "descricao": "Material permanente, salvo infraestrutura técnica ou com justificativa e doação a entidade sem fins lucrativos ou pública",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XVI"
        }
      },
      {
        "codigo": "bebida_cigarro",
        "descricao": "Bebidas alcoólicas e cigarros (salvo objeto de cena)",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XVII e XVIII"
        }
      },
      {
        "codigo": "fora_dos_marcos",
        "descricao": "Despesa fora dos marcos inicial e final",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XX"
        }
      },
      {
        "codigo": "nao_financiavel",
        "descricao": "Itens não financiáveis pela IN 158 ou pelo regramento de fomento direto",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXVII"
        }
      },
      {
        "codigo": "contrapartida_publica",
        "descricao": "Contrapartida paga com recurso público ou do coprodutor estrangeiro",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXVIII"
        }
      },
      {
        "codigo": "infraestrutura_na_producao",
        "descricao": "Despesas de infraestrutura em projetos de produção (ficam no gerenciamento)",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXXV"
        }
      },
      {
        "codigo": "folha_da_proponente",
        "descricao": "Folha de pessoal da proponente",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXXVI"
        }
      },
      {
        "codigo": "estranhas_ao_projeto",
        "descricao": "Despesas pessoais, inconsistentes com o projeto ou tributos sobre resultado, lucro ou receita da proponente",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 19"
        }
      },
      {
        "codigo": "conteudo_nao_financiavel",
        "descricao": "Conteúdo religioso, político, esportivo, publicitário, jornalístico ou de auditório",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 20; Lei 12.485/2011, art. 2º, XII"
        }
      }
    ],
    "regras": [
      {
        "codigo": "aderencia_por_modalidade",
        "descricao": "Comercialização sem pós-produção nem aluguel de câmera; desenvolvimento sem mídia nem cartazes.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 28"
        }
      },
      {
        "codigo": "classe_economica",
        "descricao": "Passagens em classe econômica, sem remarcação, cancelamento ou no-show.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 34–35"
        }
      },
      {
        "codigo": "diarias_so_autonomo",
        "descricao": "Diária só para autônomo com RPA e vínculo, fora da sede.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 33–34"
        }
      },
      {
        "codigo": "glosa_dentro_dos_20",
        "descricao": "Item não previsto, acima do pactuado ou inconsistente com o objeto pode ser glosado mesmo dentro dos 20% de remanejamento.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 20"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "arts. 18 a 20"
    }
  },
  "porte": {
    "lacuna": "nao_se_aplica",
    "motivo": "A IN 159 não classifica projetos por porte; o orçamento abaixo de R$ 500 mil só afasta a regra de concentração por fornecedor.",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "art. 28, VI"
    }
  },
  "objeto": {
    "descricao": "Material de cumprimento do objeto e da finalidade por modalidade (Anexo, art. 1º, VII): roteiro no desenvolvimento, CPB e cópia vinculada na produção, CRT e lançamento na distribuição, catálogo no festival, alvará e fotos na infraestrutura, laudos na infraestrutura técnica, listas na formação.",
    "regras": [
      {
        "codigo": "desenvolvimento",
        "descricao": "Desenvolvimento: roteiro, concepção visual na animação e materiais da pesquisa orçada.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, a"
        }
      },
      {
        "codigo": "producao",
        "descricao": "Produção: número do CPB e cópia vinculada enviada pela Central de Conteúdo, com as logomarcas obrigatórias.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, b; art. 3º"
        }
      },
      {
        "codigo": "distribuicao",
        "descricao": "Distribuição ou comercialização: número do CRT e data do lançamento comercial.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, c"
        }
      },
      {
        "codigo": "festival",
        "descricao": "Festival internacional: catálogo oficial e fotos, vídeo ou clipping.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, d"
        }
      },
      {
        "codigo": "infraestrutura",
        "descricao": "Infraestrutura de sala: alvará, memorial do engenheiro ou arquiteto quando for o caso, fotos antes e depois e da logomarca.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, e (red. IN 176/2026)"
        }
      },
      {
        "codigo": "infraestrutura_tecnica",
        "descricao": "Infraestrutura técnica: fotos do equipamento, laudos da instaladora e fotos da logomarca.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, f"
        }
      },
      {
        "codigo": "formacao",
        "descricao": "Formação de público ou qualificação: listas de presença, avaliações, obras exibidas, material didático, relatórios de impacto e de resultados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, g e h"
        }
      },
      {
        "codigo": "contrapartida_por_doacao",
        "descricao": "Contrapartida por doação só até o saldo do item depois da execução pública; desconto e contrato sozinho não comprovam.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXXIV; Manual v2.11, p. 65–66"
        }
      },
      {
        "codigo": "contrapartida_nao_compensa",
        "descricao": "Contrapartida acima do mínimo, fora da conta, não compensa glosas nem recursos não comprovados.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 21, parágrafo único"
        }
      },
      {
        "codigo": "deposito_legal",
        "descricao": "Depósito legal na Cinemateca, com legendagem, audiodescrição e LIBRAS, comprovado até o fim da execução financeira; multa de R$ 2 mil a R$ 50 mil.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 109/2012",
          "dispositivo": "art. 26; Manual v2.11, p. 11"
        }
      },
      {
        "codigo": "prazo_do_objeto",
        "descricao": "Objeto concluído em 36 meses (animação acima de 70 min), 24 (demais produções) ou 12 (desenvolvimento, distribuição e festival), da 1ª liberação.",
        "severidade": "info",
        "parametros": {
          "animacao": 36,
          "producao": 24,
          "outros": 12
        },
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 53"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, VII; art. 3º"
    }
  },
  "divulgacao": {
    "marcas": [
      "ANCINE",
      "FSA e agente financeiro (com FSA)",
      "Bandeira Nacional"
    ],
    "aprovacaoPrevia": {
      "exigida": false,
      "prazo": null,
      "silencioAprova": false,
      "descricao": "Não é preciso aprovar antes: a aplicação da logomarca é verificada na análise do objeto.",
      "fonte": {
        "documento": "Manual de Aplicação da Logomarca v3.0 (24/08/2022)",
        "dispositivo": "aprovação prévia"
      }
    },
    "defeso": null,
    "regras": [
      {
        "codigo": "onde_aplicar",
        "descricao": "Logomarca nos créditos iniciais e no cartaz (desenvolvimento, produção, finalização), no cartaz (distribuição), em cartazes, vinheta e catálogo (festival) e na placa (infraestrutura).",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 130/2016, com a IN 152/2020",
          "dispositivo": "art. 4º (red. IN 152/2020)"
        }
      },
      {
        "codigo": "bandeira",
        "descricao": "Bandeira Nacional em todo material de divulgação impresso, virtual ou audiovisual, salvo memes e vídeos curtos.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Lei 5.700/1971",
          "dispositivo": "art. 3º-A; IN 152/2020"
        }
      },
      {
        "codigo": "cartela_ancine",
        "descricao": "Cartela ANCINE de ao menos 3 s nos créditos iniciais, antes das demais; FSA e agente financeiro com ao menos 2 s, sem outras marcas.",
        "severidade": "alerta",
        "parametros": {
          "ancineSegundos": 3,
          "fsaSegundos": 2
        },
        "fonte": {
          "documento": "Manual de Aplicação da Logomarca v3.0 (24/08/2022)",
          "dispositivo": "créditos"
        }
      },
      {
        "codigo": "ordem_e_visibilidade",
        "descricao": "Ordem agente financeiro, FSA, ANCINE; visibilidade igual ou maior que a da marca mais visível da peça; só colorida ou monocromática.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Aplicação da Logomarca v3.0 (24/08/2022)",
          "dispositivo": "conjunto, visibilidade e cor"
        }
      },
      {
        "codigo": "placa_infraestrutura",
        "descricao": "Placa de aço escovado de 40 × 26 cm, ao lado da bilheteria, a 1,5 m do piso, com a frase obrigatória.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Aplicação da Logomarca v3.0 (24/08/2022)",
          "dispositivo": "placa de infraestrutura"
        }
      },
      {
        "codigo": "sancoes",
        "descricao": "Marca em desacordo: advertência. Marca não aplicada: devolução de 2% (créditos, vinheta, placa) ou 0,5% (cartaz) dos recursos públicos federais, com rendimentos.",
        "severidade": "bloqueio",
        "parametros": {
          "creditos": 2,
          "cartaz": 0.5
        },
        "fonte": {
          "documento": "IN ANCINE 130/2016, com a IN 152/2020",
          "dispositivo": "art. 6º"
        }
      },
      {
        "codigo": "ressalva_e_debito",
        "descricao": "Descumprir a logomarca leva a aprovação com ressalvas e gera débito.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 28, XI; art. 31, III"
        }
      },
      {
        "codigo": "defeso_nao_tratado",
        "descricao": "Os manuais da ANCINE não tratam do defeso eleitoral.",
        "severidade": "info",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "parte B.8 da conferência"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 130/2016, com a IN 152/2020",
      "dispositivo": "arts. 2º a 6º; Manual de Aplicação da Logomarca v3.0"
    }
  },
  "envio": {
    "sistema": "STR (planilhas e documentos fiscais) e Protocolo Digital",
    "descricao": "RP, DE e DO em .xls (Excel 97-2003) pelo STR, com críticas automáticas; demais documentos pelo Protocolo Digital; documentos fiscais digitalizados pelo STR quando pedidos. Uma prestação por projeto (SALIC) e fonte.",
    "documentos": [
      {
        "codigo": "rp",
        "descricao": "Relação de Pagamentos, uma por conta de movimentação e uma de contrapartida fora da conta",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, I"
        }
      },
      {
        "codigo": "de",
        "descricao": "Demonstrativo do Extrato da Conta Corrente, um por conta",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, II"
        }
      },
      {
        "codigo": "do",
        "descricao": "Demonstrativo Orçamentário e Financeiro, um por SALIC",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, III"
        }
      },
      {
        "codigo": "gru_saldos",
        "descricao": "Comprovantes de recolhimento dos saldos da movimentação e das aplicações (GRU)",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, IV; art. 2º, § 3º"
        }
      },
      {
        "codigo": "encerramento_contas",
        "descricao": "Comprovantes de encerramento das contas abertas pela proponente (emitidos pelo banco)",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, V; art. 2º, § 3º"
        }
      },
      {
        "codigo": "extratos",
        "descricao": "Extratos de todas as contas, inclusive de aplicação, da abertura ao encerramento",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VI"
        }
      },
      {
        "codigo": "objeto",
        "descricao": "Material de cumprimento do objeto e da finalidade, pela modalidade",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII"
        }
      },
      {
        "codigo": "documentos_fiscais",
        "descricao": "Cópias digitalizadas dos documentos fiscais e auxiliares, quando pedidas",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VIII; art. 2º, § 1º"
        }
      },
      {
        "codigo": "junta_comercial",
        "descricao": "Registro na junta comercial, em projetos de aquisição de ações",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, parágrafo único"
        }
      },
      {
        "codigo": "confirmacao_str",
        "descricao": "E-mail de confirmação do envio pelo STR, impresso e juntado (enviar pelo STR não é entregar a prestação)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§§ 6.1 e 6.3"
        }
      }
    ],
    "modelos": [
      {
        "codigo": "rp",
        "nome": "Relação de Pagamentos (RP)",
        "formato": "xls (Excel 97-2003)",
        "arquivo": "ancine/IN_159_Relacao_de_Pagamentos.xls",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, formulário I"
        }
      },
      {
        "codigo": "de",
        "nome": "Demonstrativo do Extrato da Conta Corrente (DE)",
        "formato": "xls (Excel 97-2003)",
        "arquivo": "ancine/IN_159_Demonstrativo_do_Extrato.xls",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, formulário II"
        }
      },
      {
        "codigo": "do",
        "nome": "Demonstrativo Orçamentário e Financeiro (DO)",
        "formato": "xls (Excel 97-2003)",
        "arquivo": "ancine/IN_159_Demonstrativo_Orcamentario_e_Financeiro.xls",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, formulário III"
        }
      }
    ],
    "regras": [
      {
        "codigo": "xls_97",
        "descricao": "O STR só carrega planilha salva como Pasta de Trabalho do Excel 97-2003 (.xls), com nome de mais de 5 caracteres.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§§ 3.1 e 3.2"
        }
      },
      {
        "codigo": "salic_nas_planilhas",
        "descricao": "Nas planilhas, só o SALIC no formato NN-NNNN.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§§ 2.3 e 3.2.1"
        }
      },
      {
        "codigo": "criticas_de_cruzamento",
        "descricao": "RP casa com o DE (histórico e data) e com o DO (item orçamentário com o mesmo texto); o comprovado não pode ser menor que o a comprovar.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§ 5.3"
        }
      },
      {
        "codigo": "uma_por_fonte",
        "descricao": "Uma prestação por projeto e fonte (incentivo, fomento direto, FSA), com SALIC e processo próprios.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 10"
        }
      },
      {
        "codigo": "bb_gestao_agil",
        "descricao": "Em contas do BB Gestão Ágil, o DE é gerado pelo STR e a RP vem pré-preenchida para revisar.",
        "severidade": "info",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§§ 3.1 e 4.1.1"
        }
      },
      {
        "codigo": "reabrir_envio",
        "descricao": "Depois do envio, as planilhas do SALIC travam; reabrir pede e-mail à ANCINE, que apaga todas.",
        "severidade": "info",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§ 6.3"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, arts. 1º a 4º"
    }
  },
  "posEnvio": {
    "resultados": [
      {
        "resultado": "aprovada",
        "descricao": "Objeto e finalidade cumpridos e contas regulares.",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 20 e 68"
        }
      },
      {
        "resultado": "aprovada_ressalvas",
        "descricao": "Concentração de 25% ou mais, depósitos sem finalidade, formulários errados, logomarca, transferências indevidas, glosa recolhida e outras hipóteses.",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 22 e 28"
        }
      },
      {
        "resultado": "reprovada",
        "descricao": "Omissão, objeto não entregue, glosa não ressarcida, valores não comprovados, gestão fraudulenta, CPB não emitido, diligência não atendida ou objeto reprovado (não aprovação).",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 29"
        }
      }
    ],
    "devolucao": {
      "descricao": "GRU pelo PagTesouro, pela fonte do recurso, com o SALIC como referência e só o valor principal preenchido.",
      "atualizacao": "SELIC a partir do mês seguinte ao vencimento e 1% no mês do pagamento; mora de 0,33% ao dia até 20% (IN 164/2022); data-base pelo art. 32 da IN 159.",
      "gru": [
        {
          "unidadeGestora": "340002",
          "gestao": null,
          "codigo": "019401",
          "referencia": "SALIC só com dígitos",
          "fonte": {
            "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
            "dispositivo": "p. 14–17",
            "nota": "Lei 8.313/1991, arts. 18 e 25: órgão 34902 (Fundo Nacional de Cultura)."
          }
        },
        {
          "unidadeGestora": "203003",
          "gestao": null,
          "codigo": "026642",
          "referencia": "SALIC só com dígitos",
          "fonte": {
            "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
            "dispositivo": "p. 14–17",
            "nota": "Lei 8.685/1993, arts. 1º, 1º-A, 3º e 3º-A: órgão 20203 (ANCINE)."
          }
        },
        {
          "unidadeGestora": "203003",
          "gestao": null,
          "codigo": "026667",
          "referencia": "SALIC só com dígitos",
          "fonte": {
            "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
            "dispositivo": "p. 14–17",
            "nota": "PAR/PAQ, orçamento da ANCINE."
          }
        },
        {
          "unidadeGestora": "203003",
          "gestao": null,
          "codigo": "026674",
          "referencia": "SALIC só com dígitos",
          "fonte": {
            "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
            "dispositivo": "p. 14–17",
            "nota": "Editais FSA, MP 2.228-1 (art. 39, X) e Funcines."
          }
        }
      ],
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 14–17 e 69"
      }
    },
    "regras": [
      {
        "codigo": "multa_na_nao_aprovacao",
        "descricao": "Na não aprovação, multa de 50% (Lei 8.685) ou 20% (FSA e Funcines) sobre o débito atualizado; pagar antes evita a multa.",
        "severidade": "alerta",
        "parametros": {
          "leiAudiovisual": 50,
          "fsaFuncines": 20
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 31 a 36"
        }
      },
      {
        "codigo": "inadimplencia",
        "descricao": "Atraso na prestação, parcela não paga ou diligência sem resposta geram inadimplência, que trava novos projetos da proponente e do grupo até a regularização.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 68"
        }
      },
      {
        "codigo": "sancoes",
        "descricao": "Advertência ou inabilitação por até 2 anos, aplicadas depois do prazo recursal, alcançando empresas do mesmo grupo.",
        "severidade": "alerta",
        "parametros": {
          "anos": 2
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 42"
        }
      },
      {
        "codigo": "parcelamento",
        "descricao": "Parcelamento em até 60 vezes, parcela mínima de R$ 200 (PJ) ou R$ 50 (PF).",
        "severidade": "info",
        "parametros": {
          "parcelas": 60
        },
        "fonte": {
          "documento": "IN ANCINE 164/2022",
          "dispositivo": "parcelamento"
        }
      },
      {
        "codigo": "tce",
        "descricao": "TCE dispensada abaixo de R$ 120 mil ou depois de 10 anos; abaixo disso, cobrança extrajudicial.",
        "severidade": "info",
        "parametros": {
          "valor": 120000
        },
        "fonte": {
          "documento": "IN TCU 98/2024",
          "dispositivo": "art. 6º, I; Manual v2.11, p. 71–73"
        }
      },
      {
        "codigo": "prescricao",
        "descricao": "Prescrição de 5 anos e intercorrente de 3 anos com o processo parado.",
        "severidade": "info",
        "fonte": {
          "documento": "Res. TCU 344/2022",
          "dispositivo": "arts. 2º e 8º; DDC ANCINE 110-E/2023"
        }
      },
      {
        "codigo": "inspecao",
        "descricao": "Inspeção in loco agendada com 10 dias de antecedência; impedi-la leva a inadimplência.",
        "severidade": "info",
        "parametros": {
          "dias": 10
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 58 a 60"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "arts. 22 a 50"
    }
  },
  "guarda": {
    "marco": "registro_decisao",
    "quantidade": 5,
    "unidade": "anos",
    "prorrogaParaDiaUtil": false,
    "descricao": "Originais por 5 anos a partir da decisão final, em ordem cronológica ou da RP; papel termossensível guardado com cópia.",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "art. 8º"
    }
  }
}$regime$::jsonb,
  $fontes$[
  {
    "documento": "IN ANCINE 159/2021 (consolidada)",
    "url": "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159"
  },
  {
    "documento": "IN ANCINE 176/2026",
    "url": "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-176"
  },
  {
    "documento": "Manuais de prestação de contas (ANCINE)",
    "url": "https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais"
  },
  {
    "documento": "Manual STR v2.2",
    "url": "https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdoSTRVerso2.2v_30_09_2025.pdf/@@display-file/file"
  },
  {
    "documento": "Manual de Aplicação da Logomarca v3.0",
    "url": "https://www.gov.br/ancine/pt-br/centrais-de-conteudo/publicacoes/manuais/ManualdeAplicacaodeLogomarcav.0324agosto22.pdf/@@display-file/file"
  },
  {
    "documento": "FAQ da Superintendência de Prestação de Contas",
    "url": "https://www.gov.br/ancine/pt-br/acesso-a-informacao/perguntas-frequentes1/superintendencia-de-prestacao-de-contas-spr"
  }
]$fontes$::jsonb,
  $checklist$[
  {
    "codigo": "rp",
    "descricao": "Relação de Pagamentos, uma por conta de movimentação e uma de contrapartida fora da conta",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, I"
    }
  },
  {
    "codigo": "de",
    "descricao": "Demonstrativo do Extrato da Conta Corrente, um por conta",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, II"
    }
  },
  {
    "codigo": "do",
    "descricao": "Demonstrativo Orçamentário e Financeiro, um por SALIC",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, III"
    }
  },
  {
    "codigo": "gru_saldos",
    "descricao": "Comprovantes de recolhimento dos saldos da movimentação e das aplicações (GRU)",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, IV; art. 2º, § 3º"
    }
  },
  {
    "codigo": "encerramento_contas",
    "descricao": "Comprovantes de encerramento das contas abertas pela proponente (emitidos pelo banco)",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, V; art. 2º, § 3º"
    }
  },
  {
    "codigo": "extratos",
    "descricao": "Extratos de todas as contas, inclusive de aplicação, da abertura ao encerramento",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, VI"
    }
  },
  {
    "codigo": "objeto",
    "descricao": "Material de cumprimento do objeto e da finalidade, pela modalidade",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, VII"
    }
  },
  {
    "codigo": "documentos_fiscais",
    "descricao": "Cópias digitalizadas dos documentos fiscais e auxiliares, quando pedidas",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, VIII; art. 2º, § 1º"
    }
  },
  {
    "codigo": "junta_comercial",
    "descricao": "Registro na junta comercial, em projetos de aquisição de ações",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, parágrafo único"
    }
  },
  {
    "codigo": "confirmacao_str",
    "descricao": "E-mail de confirmação do envio pelo STR, impresso e juntado (enviar pelo STR não é entregar a prestação)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
      "dispositivo": "§§ 6.1 e 6.3"
    }
  }
]$checklist$::jsonb,
  $modelos$[
  {
    "codigo": "rp",
    "nome": "Relação de Pagamentos (RP)",
    "formato": "xls (Excel 97-2003)",
    "arquivo": "ancine/IN_159_Relacao_de_Pagamentos.xls",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, formulário I"
    }
  },
  {
    "codigo": "de",
    "nome": "Demonstrativo do Extrato da Conta Corrente (DE)",
    "formato": "xls (Excel 97-2003)",
    "arquivo": "ancine/IN_159_Demonstrativo_do_Extrato.xls",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, formulário II"
    }
  },
  {
    "codigo": "do",
    "nome": "Demonstrativo Orçamentário e Financeiro (DO)",
    "formato": "xls (Excel 97-2003)",
    "arquivo": "ancine/IN_159_Demonstrativo_Orcamentario_e_Financeiro.xls",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, formulário III"
    }
  }
]$modelos$::jsonb,
  now()
)
on conflict (codigo, versao) do nothing;

-- Audiovisual (ANCINE) — IN 150/2019 (versão 1)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'ancine_in150_2019' and versao < 1 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, vigente_ate, status, parametros, fontes, checklist_envio, modelos_saida, publicado_em)
values (
  'ancine_in150_2019', 1, 'Audiovisual (ANCINE) — IN 150/2019', 'audiovisual', 'audiovisual',
  'federal', 'ANCINE', 'STR e Protocolo Digital', 'Lei 8.685/1993; Lei 8.313/1991, arts. 18 e 25; MP 2.228-1/2001; IN ANCINE 150/2019 (IN 125/2015 para despesas até 2019)',
  '2020-01-01'::date, '2022-01-16'::date, 'publicado',
  $regime${
  "codigo": "ancine_in150_2019",
  "versao": 1,
  "nome": "Audiovisual (ANCINE) — IN 150/2019",
  "area": "audiovisual",
  "mecanismo": "audiovisual",
  "esfera": "federal",
  "orgao": "ANCINE",
  "sistemaOficial": "STR e Protocolo Digital",
  "normaReferencia": "Lei 8.685/1993; Lei 8.313/1991, arts. 18 e 25; MP 2.228-1/2001; IN ANCINE 150/2019 (IN 125/2015 para despesas até 2019)",
  "vigenteDesde": "2020-01-01",
  "identificadorOficial": {
    "tipo": "salic",
    "rotulo": "SALIC"
  },
  "fontes": [
    {
      "documento": "Manuais de prestação de contas (ANCINE)",
      "url": "https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais"
    },
    {
      "documento": "IN ANCINE 159/2021, art. 63 (transição)",
      "url": "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159"
    }
  ],
  "aplicabilidade": {
    "criterio": "aprovacao_projeto",
    "desde": null,
    "ate": "2022-01-16",
    "descricao": "Projetos aprovados antes de 17/01/2022, com despesas a partir de 01/01/2020 pela IN 150; despesas anteriores seguem a IN 125/2015.",
    "sucede": [],
    "fonte": {
      "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
      "dispositivo": "p. 4; IN 159, art. 63"
    }
  },
  "prazos": {
    "prestacaoFinal": {
      "descricao": "Prestação de contas final, contada da conclusão do objeto (CPB, lançamento comercial, último dia do festival ou entrega do desenvolvimento)",
      "responsavel": "proponente",
      "marco": "conclusao_objeto",
      "quantidade": 180,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "arts. 3º a 5º",
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Se a 1ª liberação for posterior à conclusão, conta da liberação. Vários processos do mesmo objeto: vale o último prazo, com uma prestação por processo. No FSA, o prazo do contrato.",
        "aConfirmar": true
      }
    },
    "fimExecucaoFinanceira": {
      "descricao": "Última despesa do projeto (fim da execução financeira)",
      "responsavel": "proponente",
      "marco": "conclusao_objeto",
      "quantidade": 180,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 158/2021",
        "dispositivo": "art. 57; FAQ SPR 2.10",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "respostaDiligencia": {
      "descricao": "Atender diligência, da confirmação de recebimento; prorrogável uma vez por 30 dias a pedido justificado",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 45 e § 3º",
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Omissão leva a inadimplência; mais 30 dias sem saneamento, a proposta de não aprovação.",
        "aConfirmar": true
      }
    },
    "notificacaoOmissao": {
      "descricao": "Apresentar a prestação omitida depois da notificação, sob pena de TCE ou cobrança",
      "responsavel": "proponente",
      "marco": "ciencia_diligencia",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 6º",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "analisePrestacao": {
      "lacuna": "norma_silente",
      "motivo": "A IN 159 não fixa prazo para a ANCINE analisar a prestação; o de 90 dias da IN 158 vale para os pedidos de acompanhamento.",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "texto integral; FAQ SPR",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "analiseAcompanhamento": {
      "descricao": "Análise de pedido de acompanhamento (remanejamento, prorrogação), interrompida por diligência",
      "responsavel": "orgao",
      "marco": "protocolo_alteracao",
      "quantidade": 90,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 158/2021",
        "dispositivo": "art. 3º, II e § 3º",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "recurso": {
      "descricao": "Recurso com efeito suspensivo, do recebimento da notificação; última instância é a Diretoria Colegiada",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "arts. 48 a 50",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "devolucao": {
      "descricao": "Pagar a GRU da glosa ou do débito, calculada pela ANCINE",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 69; IN 159, arts. 31 e 32",
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Sem pagamento, recurso ou parcelamento, a prestação é não aprovada e incide multa.",
        "aConfirmar": true
      }
    },
    "correcaoLogomarcaInfraestrutura": {
      "descricao": "Corrigir a placa de infraestrutura depois da decisão",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN ANCINE 130/2016, com a IN 152/2020",
        "dispositivo": "art. 9º",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    }
  },
  "prestacaoParcial": {
    "modalidades": [
      "a_criterio_do_orgao"
    ],
    "descricao": "A ANCINE pode pedir prestação parcial conforme o regramento (avaliação da execução parcial da IN 158): documentos do Anexo sem os incisos IV e V e extratos da abertura até a data da prestação. Despesas aprovadas na parcial podem ser reanalisadas na final.",
    "prazo": null,
    "regras": [
      {
        "codigo": "sem_gru_nem_encerramento",
        "descricao": "A parcial dispensa os comprovantes de recolhimento e de encerramento das contas.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 2º, § 3º",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "extratos_ate_a_data",
        "descricao": "Na parcial, os extratos vão da abertura da conta até a data da prestação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 18, nota 3",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "reanalise_na_final",
        "descricao": "Despesas aprovadas na parcial podem ser reanalisadas na final.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 54 a 56",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "fsa_especial",
        "descricao": "A prestação especial do contrato FSA segue as regras da parcial.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 57",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "arts. 54 a 57",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "orcamento": {
    "estrutura": {
      "niveis": [
        "Item orçamentário (IV.a e IV.b do DO)",
        "Item"
      ],
      "descricao": "Orçamento analítico aprovado por item; o DO compara o aprovado com o captado por fonte e com o executado. Tributos retidos e encargos entram na rubrica do fato gerador.",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 12 e 60; Demonstrativo Orçamentário e Financeiro, seção IV",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "grupos": [
      {
        "codigo": "execucao",
        "rotulo": "Itens do projeto",
        "descricao": "Itens financiáveis de desenvolvimento, produção, distribuição ou da modalidade.",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "gerenciamento",
        "rotulo": "Gerenciamento",
        "descricao": "Gerenciamento da produção, com toda a infraestrutura; só produtora brasileira.",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, I",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "agenciamento",
        "rotulo": "Agenciamento",
        "descricao": "Agenciamento de captação pela Lei 8.313 e pelo art. 1º-A da Lei 8.685.",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, II",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "colocacao",
        "rotulo": "Coordenação e colocação",
        "descricao": "Coordenação e colocação de certificados do art. 1º da Lei 8.685 (taxas, prospecto, agente divulgador).",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, III",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "bases": {
      "orcamento_producao": {
        "descricao": "Orçamento de produção: os itens do projeto, sem gerenciamento, agenciamento e colocação.",
        "soma": "todos",
        "exceto": [
          "gerenciamento",
          "agenciamento",
          "colocacao"
        ],
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, I",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. A fonte não detalha o que entra no orçamento de produção; o limite também se prende ao executado com recursos ANCINE."
        }
      },
      "valor_total_projeto": {
        "descricao": "Orçamento global aprovado.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 27–28",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    },
    "tetos": [
      {
        "codigo": "gerenciamento",
        "descricao": "Gerenciamento",
        "grupos": [
          "gerenciamento"
        ],
        "percentual": 10,
        "base": "orcamento_producao",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, I; Lei 11.437/2006, art. 12",
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Limitado ao executado com recursos ANCINE; na coprodução internacional, só a parte brasileira. O excesso é glosado (IN 159, art. 18, VI).",
          "aConfirmar": true
        }
      },
      {
        "codigo": "agenciamento",
        "descricao": "Agenciamento",
        "grupos": [
          "agenciamento"
        ],
        "percentual": 10,
        "base": "valor_autorizado_captacao",
        "proporcionalAoCaptado": true,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, II",
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Proporcional ao captado: R$ 100 mil autorizados e R$ 80 mil captados dão teto de R$ 8 mil.",
          "aConfirmar": true
        }
      },
      {
        "codigo": "colocacao",
        "descricao": "Coordenação e colocação",
        "grupos": [
          "colocacao"
        ],
        "percentual": 10,
        "base": "valor_autorizado_captacao",
        "proporcionalAoCaptado": true,
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 31, III",
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Sobre o autorizado pelo art. 1º da Lei 8.685, limitado ao captado.",
          "aConfirmar": true
        }
      }
    ],
    "regras": [
      {
        "codigo": "contrapartida_minima",
        "descricao": "Contrapartida de ao menos 5% do orçamento global aprovado quando há mecanismo da Lei do Audiovisual (ou 5% das fontes brasileiras integralizadas, se menor).",
        "severidade": "bloqueio",
        "parametros": {
          "percentual": 5
        },
        "fonte": {
          "documento": "Lei 8.685/1993",
          "dispositivo": "art. 4º, § 2º, I; IN 159, art. 16, § 1º",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "agenciamento_vedado",
        "descricao": "Agenciamento vedado em editais, FSA, programas internacionais e seleções de estatais, e a proponente, coprodutores, grupo econômico ou sócios.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, IV",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "colocacao_autorizada",
        "descricao": "Coordenação e colocação só por agente autorizado na CVM e para o art. 1º da Lei 8.685.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, V",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "gerenciamento_por_quem",
        "descricao": "Gerenciamento não pode ser pago a radiodifusoras, programadoras, distribuidoras ou telefônicas.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XIX",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ]
  },
  "alteracoes": {
    "janela": {
      "aPartirDe": null,
      "ate": "fim_execucao",
      "descricao": "Durante a execução; o pedido prévio vai à Superintendência de Fomento (SFO).",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 27–28",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "tipos": {
      "remanejamento": {
        "permitido": true,
        "classificacao": "administrativa",
        "condicoes": [
          {
            "tipo": "movido_ate",
            "percentual": 20,
            "base": "valor_total_projeto",
            "acumulado": true,
            "descricao": "O conjunto de alterações (extrapolações mais rubricas novas) fica abaixo de 20% do orçamento global aprovado.",
            "fonte": {
              "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
              "dispositivo": "p. 27–28",
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Vale para projetos fora dos limites de grandes itens da IN 158 (arts. 49 e 50).",
              "aConfirmar": true
            }
          }
        ],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "Gerenciamento, agenciamento e colocação continuam dentro dos limites.",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, VI",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "justificar_na_pc",
            "descricao": "Toda alteração é justificada na prestação, mesmo abaixo de 20%; nada é aprovado automaticamente e a não acatada é glosada.",
            "severidade": "alerta",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 20; Manual v2.11, p. 20 e 28",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          },
          {
            "codigo": "aporte_nao_financeiro",
            "descricao": "Itens comprovados com aporte não financeiro de terceiros para a captação mínima não são remanejados nem pagos com recursos ANCINE.",
            "severidade": "bloqueio",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, XXXII",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          }
        ],
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 27–28",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      "complementacao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "O redimensionamento respeita os limites.",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, VI",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)",
          "dispositivo": "§ 4.10; IN 158, arts. 49 e 50",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Redimensionamento do orçamento depende de aprovação prévia; o texto da IN 158 não foi lido."
        }
      },
      "reducao": {
        "permitido": true,
        "classificacao": "formal",
        "condicoes": [],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "alerta",
            "descricao": "Depois da redução, os grupos continuam dentro dos limites.",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, VI",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          }
        ],
        "orientacoes": [],
        "fonte": {
          "documento": "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)",
          "dispositivo": "§ 4.10; IN 158, arts. 49 e 50",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Redimensionamento do orçamento depende de aprovação prévia; o texto da IN 158 não foi lido."
        }
      },
      "inclusao": {
        "permitido": true,
        "classificacao": "administrativa",
        "condicoes": [
          {
            "tipo": "movido_ate",
            "percentual": 20,
            "base": "valor_total_projeto",
            "acumulado": true,
            "descricao": "Rubricas novas e extrapolações, somadas, ficam abaixo de 20% do orçamento global aprovado.",
            "fonte": {
              "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
              "dispositivo": "p. 27–28",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          }
        ],
        "requisitos": [
          {
            "tipo": "tetos",
            "severidade": "bloqueio",
            "descricao": "Com a rubrica nova, os limites continuam respeitados.",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 18, VI",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          }
        ],
        "orientacoes": [
          {
            "codigo": "justificar_na_pc",
            "descricao": "A rubrica nova é justificada na prestação; a não acatada é glosada.",
            "severidade": "alerta",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 20",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          }
        ],
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 27–28",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    },
    "alertasPorItem": [],
    "prazoAnalise": "analiseAcompanhamento",
    "silencioAprova": false,
    "regras": [
      {
        "codigo": "projeto_tecnico",
        "descricao": "Alterar o projeto técnico sem autorização prévia leva a inabilitação.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 28, X; art. 42, II",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "fsa",
        "descricao": "No FSA: abaixo de 20%, sem aprovação prévia e justificado na prestação; acima ou redimensionamento, pela CUP (grandes itens) ou protocolo digital (orçamento detalhado).",
        "severidade": "info",
        "fonte": {
          "documento": "Guia de Acompanhamento de Projetos do FSA (BRDE, jan/2025)",
          "dispositivo": "§ 4.10",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
      "dispositivo": "p. 20 e 27–28",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "fornecedores": {
    "limites": [
      {
        "codigo": "concentracao",
        "descricao": "Concentração em um mesmo fornecedor ou grupo, somando as RPs de todos os processos da mesma obra e objeto (produção)",
        "escopo": "fornecedor",
        "base": "valor_executado",
        "faixas": [
          {
            "percentual": 25,
            "severidade": "alerta",
            "consequencia": "Advertência e aprovação com ressalvas"
          },
          {
            "percentual": 50,
            "severidade": "bloqueio",
            "consequencia": "Inabilitação por até 2 anos"
          }
        ],
        "excecoes": [
          {
            "descricao": "Animação",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 28, VI",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          },
          {
            "descricao": "Jogos eletrônicos",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 28, VI",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          },
          {
            "descricao": "Orçamento abaixo de R$ 500 mil",
            "fonte": {
              "documento": "IN ANCINE 159/2021",
              "dispositivo": "art. 28, VI",
              "aConfirmar": true,
              "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
            }
          }
        ],
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 28, VI; art. 42",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "partesRelacionadas": {
      "descricao": "Agenciamento não é pago à proponente, a coprodutores, a empresas com sócios em comum ou do mesmo grupo; bens da proponente, do grupo ou do coprodutor exigem 3 orçamentos de fora do grupo e pagamento até o menor.",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 18, IV, c; Manual v2.11, p. 56",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "regras": [
      {
        "codigo": "cnae_compativel",
        "descricao": "Prestador com objeto social ou CNAE compatível com o serviço.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 26",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "vinculo_com_emitente",
        "descricao": "Quem presta o serviço tem vínculo societário ou empregatício com a empresa que emite a nota.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXVI",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "agente_de_artista",
        "descricao": "Agente de artista não é pago com recursos do projeto; o artista emite RPA ou nota.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 26–27",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "reincidencia",
        "descricao": "Reincidência na mesma regra, em outro projeto, leva a inabilitação.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 42, II",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "arts. 18, 28 e 42",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "contas": {
    "contas": [
      {
        "tipo": "captacao",
        "descricao": "Conta de captação, do proponente, só para incentivos fiscais (fomento indireto)",
        "abertaPor": "orgao"
      },
      {
        "tipo": "movimento",
        "descricao": "Conta de movimentação, exclusiva do projeto, conforme o orçamento aprovado",
        "abertaPor": "orgao"
      },
      {
        "tipo": "recolhimento",
        "descricao": "Conta de recolhimento do investidor (arts. 3º e 3º-A da Lei 8.685; art. 39, X, da MP 2.228-1)",
        "abertaPor": "orgao"
      },
      {
        "tipo": "aplicacao",
        "descricao": "Aplicação financeira vinculada",
        "abertaPor": "orgao"
      }
    ],
    "bancos": [
      "Banco do Brasil"
    ],
    "descricao": "Contas abertas exclusivamente pela ANCINE no Banco do Brasil; os recursos ficam indisponíveis até a ANCINE autorizar a liberação; fomento direto e FSA não têm conta de captação.",
    "tarifas": {
      "regra": "so_manutencao",
      "descricao": "Tarifas bancárias são glosadas, salvo a de manutenção da conta; a proponente cobre as tarifas antes da incidência ou no mesmo mês.",
      "fonte": {
        "documento": "IN ANCINE 159/2021",
        "dispositivo": "art. 18, VII (red. IN 167/2023); Manual v2.11, p. 24–25",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "liberacao": {
      "descricao": "Os recursos de captação e os reservados de fomento direto ficam indisponíveis até a ANCINE autorizar a liberação.",
      "percentualMinimo": null,
      "base": null,
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 22",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "rendimentos": {
      "aplicacao": "obrigatoria",
      "contamComoCaptado": null,
      "uso": "Aplicação obrigatória; sem ela, advertência e aprovação com ressalvas. Os rendimentos são aporte complementar, sujeitos às mesmas regras.",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 25"
      }
    },
    "saldo": {
      "descricao": "O saldo da captação é recolhido pela ANCINE; o da movimentação e das aplicações, pela proponente, por GRU, com saldo final zero e comprovante de encerramento das contas abertas pela proponente.",
      "prazo": null,
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 14 e 18; IN 159, Anexo, art. 1º, IV e V",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "regras": [
      {
        "codigo": "sem_outras_contas",
        "descricao": "É proibido transferir recursos para outras contas, mesmo administrativas, salvo as hipóteses de reembolso.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXX; Manual v2.11, p. 23",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "creditos_permitidos",
        "descricao": "A movimentação só recebe liberação da captação ou conta bloqueada, resgate de aplicação e depósitos próprios ou de terceiros para pagar o projeto.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 23",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "emprestimo_e_ressarcimento",
        "descricao": "Recurso próprio depositado antes da liberação é ressarcido da mesma conta de movimentação; no DE, em OUTROS DEPÓSITOS e PAGAMENTOS.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 25",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "movimentos_sem_finalidade",
        "descricao": "Depósitos ou retiradas de recursos próprios sem finalidade de pagamento e transferências que não sejam pagamento levam a ressalva.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 28, VIII e XII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "contas_inativas",
        "descricao": "Contas abertas pela ANCINE são encerradas automaticamente depois de 2 anos sem saldo.",
        "severidade": "info",
        "parametros": {
          "anos": 2
        },
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 18",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
      "dispositivo": "p. 22 a 25",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "pagamentos": {
    "meiosPermitidos": [
      "ted",
      "doc",
      "pix",
      "boleto",
      "cambio"
    ],
    "meiosVedados": [
      "cheque",
      "saque"
    ],
    "descricao": "Só transferência eletrônica (TED, DOC, PIX) direto ao real credor, que é o emissor do documento; boleto nos casos listados; câmbio para o exterior; cheque e saque são glosados.",
    "documentoFiscal": [
      {
        "codigo": "titulo_e_salic",
        "descricao": "Documento com título e SALIC do projeto e discriminação do serviço ou bem; em cupom, carimbo no anverso.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 9º e 10; Manual v2.11, p. 27 e 56",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "proponente_tomadora",
        "descricao": "A proponente é a tomadora; contrapartida em nome de coprodutor ou distribuidor só com o contrato.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXI",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "emissao_30_dias",
        "descricao": "A IN 150 não admitia nota emitida depois do débito; por retroatividade benéfica, aceitam-se até 30 dias.",
        "severidade": "bloqueio",
        "parametros": {
          "dias": 30
        },
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 4 e 29–30"
        }
      },
      {
        "codigo": "documento_habil",
        "descricao": "Documento fiscal hábil, válido, legível e sem rasuras.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXII a XXIV",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "dispensa_de_nota",
        "descricao": "Sem retenção nem nota, recibo com a fundamentação da dispensa (ex.: lei municipal).",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 11",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "rpa",
        "descricao": "RPA com SALIC, título, proponente, período, natureza do serviço, IRRF, INSS patronal, ISS, líquido, total, CPF e assinatura.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 41–42",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "tributos_na_rubrica",
        "descricao": "Tributos lançados em nome do credor da despesa, na rubrica do fato gerador, com tipo DARF ou GPS; IRRF em linha própria.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 60",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "exterior",
        "descricao": "Pagamento ao exterior com invoice em nome da proponente e contrato de câmbio ou SWIFT; valor convertido em reais.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 49–50",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "arquivo_por_documento",
        "descricao": "Documentos fiscais em PDF, um por arquivo, até 15 MB, nomeados pela linha da RP (00012_P.pdf), enviados pelo STR quando pedidos.",
        "severidade": "alerta",
        "parametros": {
          "mb": 15
        },
        "fonte": {
          "documento": "Manual de Envio de Documentos Fiscais – STR (04/05/2021)",
          "dispositivo": "§§ 2 e 6",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "regras": [
      {
        "codigo": "reembolso",
        "descricao": "Reembolso só nas hipóteses do art. 15 (diária, figurante até R$ 1.000 por mês, tributos, mercadoria até R$ 1.000 por documento, locação até R$ 1.000, compra no exterior com cartão, aluguel por temporada em plataforma), com recibo de reembolso e despesa anterior ao débito.",
        "severidade": "bloqueio",
        "parametros": {
          "figuranteMes": 1000,
          "mercadoria": 1000,
          "locacao": 1000
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 15; art. 18, X; DDC 1965-E/2023",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "real_credor",
        "descricao": "Pagamento à conta da empresa credora, nunca à de sócios ou funcionários (MEI pode receber em conta de pessoa física).",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 23–24, 27 e 49",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "sem_caixa",
        "descricao": "Proibidos caixa pequeno, cartões pré-pagos, pagamento por conta particular e empréstimo do projeto a contas particulares.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 4 e 24",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "cartao_internacional",
        "descricao": "Cartão de crédito internacional só para compras de mercadorias no exterior, por reembolso; anuidade e taxas não ligadas ao câmbio com recursos próprios.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 15, VI; art. 18, VIII e IX",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
      "dispositivo": "p. 22–24",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "despesas": {
    "periodo": {
      "descricao": "Despesas depois da publicação da aprovação no DOU; direitos autorais ou roteiro até 1 ano antes, se pagos como contrapartida ou por outras fontes, até 5% do orçamento global.",
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 28 e 64"
      }
    },
    "vedadas": [
      {
        "codigo": "sem_documento",
        "descricao": "Despesa sem documento fiscal",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, I",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "duplicidade",
        "descricao": "Documento em duplicidade ou apresentado em outro projeto",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, II e III",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "acima_dos_limites",
        "descricao": "Pagamento acima dos limites de gerenciamento, agenciamento e colocação",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, VI",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "juros_multas_tarifas",
        "descricao": "Juros, multas, IOC, IOF, tarifas (salvo manutenção) e encargos contratuais",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, VII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "sem_vinculo",
        "descricao": "Passagens, hospedagem e diárias sem vínculo comprovado com o projeto",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XI",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "auditoria",
        "descricao": "Serviço de auditoria independente",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "condecine_certificados",
        "descricao": "CONDECINE, classificação indicativa, CPB e CRT",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XIII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "rubrica_glosada",
        "descricao": "Despesa em rubrica glosada ou não autorizada antes da prestação",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XIV",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "copias_no_exterior",
        "descricao": "Cópias e matrizes feitas no exterior para exploração no Brasil",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XV",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "material_permanente",
        "descricao": "Material permanente, salvo infraestrutura técnica ou com justificativa e doação a entidade sem fins lucrativos ou pública",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XVI",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "bebida_cigarro",
        "descricao": "Bebidas alcoólicas e cigarros (salvo objeto de cena)",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XVII e XVIII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "fora_dos_marcos",
        "descricao": "Despesa fora dos marcos inicial e final",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XX",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "nao_financiavel",
        "descricao": "Itens não financiáveis pela IN 158 ou pelo regramento de fomento direto",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXVII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "contrapartida_publica",
        "descricao": "Contrapartida paga com recurso público ou do coprodutor estrangeiro",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXVIII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "infraestrutura_na_producao",
        "descricao": "Despesas de infraestrutura em projetos de produção (ficam no gerenciamento)",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXXV",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "estranhas_ao_projeto",
        "descricao": "Despesas pessoais, inconsistentes com o projeto ou tributos sobre resultado, lucro ou receita da proponente",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 19",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "conteudo_nao_financiavel",
        "descricao": "Conteúdo religioso, político, esportivo, publicitário, jornalístico ou de auditório",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 20; Lei 12.485/2011, art. 2º, XII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "regras": [
      {
        "codigo": "aderencia_por_modalidade",
        "descricao": "Comercialização sem pós-produção nem aluguel de câmera; desenvolvimento sem mídia nem cartazes.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 28",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "classe_economica",
        "descricao": "Passagens em classe econômica, sem remarcação, cancelamento ou no-show.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 34–35",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "diarias_so_autonomo",
        "descricao": "Diária só para autônomo com RPA e vínculo, fora da sede.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 33–34",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "glosa_dentro_dos_20",
        "descricao": "Item não previsto, acima do pactuado ou inconsistente com o objeto pode ser glosado mesmo dentro dos 20% de remanejamento.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 20",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "folha_de_pessoal",
        "descricao": "Folha de pessoal admitida, com contracheque (bruto na RP), lista de funcionários, encargos, folha do projeto, recibo de reembolso e relatório de tempo dedicado.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 39"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "arts. 18 a 20",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "porte": {
    "lacuna": "nao_se_aplica",
    "motivo": "A IN 159 não classifica projetos por porte; o orçamento abaixo de R$ 500 mil só afasta a regra de concentração por fornecedor.",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "art. 28, VI",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "objeto": {
    "descricao": "Material de cumprimento do objeto e da finalidade por modalidade (Anexo, art. 1º, VII): roteiro no desenvolvimento, CPB e cópia vinculada na produção, CRT e lançamento na distribuição, catálogo no festival, alvará e fotos na infraestrutura, laudos na infraestrutura técnica, listas na formação.",
    "regras": [
      {
        "codigo": "desenvolvimento",
        "descricao": "Desenvolvimento: roteiro, concepção visual na animação e materiais da pesquisa orçada.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, a",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "producao",
        "descricao": "Produção: número do CPB e cópia vinculada enviada pela Central de Conteúdo, com as logomarcas obrigatórias.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, b; art. 3º",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "distribuicao",
        "descricao": "Distribuição ou comercialização: número do CRT e data do lançamento comercial.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, c",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "festival",
        "descricao": "Festival internacional: catálogo oficial e fotos, vídeo ou clipping.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, d",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "infraestrutura",
        "descricao": "Infraestrutura de sala: alvará, memorial do engenheiro ou arquiteto quando for o caso, fotos antes e depois e da logomarca.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, e (red. IN 176/2026)",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "infraestrutura_tecnica",
        "descricao": "Infraestrutura técnica: fotos do equipamento, laudos da instaladora e fotos da logomarca.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, f",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "formacao",
        "descricao": "Formação de público ou qualificação: listas de presença, avaliações, obras exibidas, material didático, relatórios de impacto e de resultados.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII, g e h",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "contrapartida_por_doacao",
        "descricao": "Contrapartida por doação só até o saldo do item depois da execução pública; desconto e contrato sozinho não comprovam.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 18, XXXIV; Manual v2.11, p. 65–66",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "contrapartida_nao_compensa",
        "descricao": "Contrapartida acima do mínimo, fora da conta, não compensa glosas nem recursos não comprovados.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 21, parágrafo único",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "deposito_legal",
        "descricao": "Depósito legal na Cinemateca, com legendagem, audiodescrição e LIBRAS, comprovado até o fim da execução financeira; multa de R$ 2 mil a R$ 50 mil.",
        "severidade": "alerta",
        "fonte": {
          "documento": "IN ANCINE 109/2012",
          "dispositivo": "art. 26; Manual v2.11, p. 11",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "prazo_do_objeto",
        "descricao": "Objeto concluído em 36 meses (animação acima de 70 min), 24 (demais produções) ou 12 (desenvolvimento, distribuição e festival), da 1ª liberação.",
        "severidade": "info",
        "parametros": {
          "animacao": 36,
          "producao": 24,
          "outros": 12
        },
        "fonte": {
          "documento": "IN ANCINE 158/2021",
          "dispositivo": "art. 53",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, VII; art. 3º",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "divulgacao": {
    "marcas": [
      "ANCINE",
      "FSA e agente financeiro (com FSA)",
      "Bandeira Nacional"
    ],
    "aprovacaoPrevia": {
      "exigida": false,
      "prazo": null,
      "silencioAprova": false,
      "descricao": "Não é preciso aprovar antes: a aplicação da logomarca é verificada na análise do objeto.",
      "fonte": {
        "documento": "Manual de Aplicação da Logomarca v3.0 (24/08/2022)",
        "dispositivo": "aprovação prévia",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "defeso": null,
    "regras": [
      {
        "codigo": "onde_aplicar",
        "descricao": "Logomarca nos créditos iniciais e no cartaz (desenvolvimento, produção, finalização), no cartaz (distribuição), em cartazes, vinheta e catálogo (festival) e na placa (infraestrutura).",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "IN ANCINE 130/2016, com a IN 152/2020",
          "dispositivo": "art. 4º (red. IN 152/2020)",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "bandeira",
        "descricao": "Bandeira Nacional em todo material de divulgação impresso, virtual ou audiovisual, salvo memes e vídeos curtos.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Lei 5.700/1971",
          "dispositivo": "art. 3º-A; IN 152/2020",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "cartela_ancine",
        "descricao": "Cartela ANCINE de ao menos 3 s nos créditos iniciais, antes das demais; FSA e agente financeiro com ao menos 2 s, sem outras marcas.",
        "severidade": "alerta",
        "parametros": {
          "ancineSegundos": 3,
          "fsaSegundos": 2
        },
        "fonte": {
          "documento": "Manual de Aplicação da Logomarca v3.0 (24/08/2022)",
          "dispositivo": "créditos",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "ordem_e_visibilidade",
        "descricao": "Ordem agente financeiro, FSA, ANCINE; visibilidade igual ou maior que a da marca mais visível da peça; só colorida ou monocromática.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Aplicação da Logomarca v3.0 (24/08/2022)",
          "dispositivo": "conjunto, visibilidade e cor",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "placa_infraestrutura",
        "descricao": "Placa de aço escovado de 40 × 26 cm, ao lado da bilheteria, a 1,5 m do piso, com a frase obrigatória.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Aplicação da Logomarca v3.0 (24/08/2022)",
          "dispositivo": "placa de infraestrutura",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "sancoes",
        "descricao": "Marca em desacordo: advertência. Marca não aplicada: devolução de 2% (créditos, vinheta, placa) ou 0,5% (cartaz) dos recursos públicos federais, com rendimentos.",
        "severidade": "bloqueio",
        "parametros": {
          "creditos": 2,
          "cartaz": 0.5
        },
        "fonte": {
          "documento": "IN ANCINE 130/2016, com a IN 152/2020",
          "dispositivo": "art. 6º",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "ressalva_e_debito",
        "descricao": "Descumprir a logomarca leva a aprovação com ressalvas e gera débito.",
        "severidade": "info",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 28, XI; art. 31, III",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "defeso_nao_tratado",
        "descricao": "Os manuais da ANCINE não tratam do defeso eleitoral.",
        "severidade": "info",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "parte B.8 da conferência",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 130/2016, com a IN 152/2020",
      "dispositivo": "arts. 2º a 6º; Manual de Aplicação da Logomarca v3.0",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "envio": {
    "sistema": "STR (planilhas e documentos fiscais) e Protocolo Digital",
    "descricao": "RP, DE e DO em .xls (Excel 97-2003) pelo STR, com críticas automáticas; demais documentos pelo Protocolo Digital; documentos fiscais digitalizados pelo STR quando pedidos. Uma prestação por projeto (SALIC) e fonte.",
    "documentos": [
      {
        "codigo": "rp",
        "descricao": "Relação de Pagamentos, uma por conta de movimentação e uma de contrapartida fora da conta",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, I",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "de",
        "descricao": "Demonstrativo do Extrato da Conta Corrente, um por conta",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, II",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "do",
        "descricao": "Demonstrativo Orçamentário e Financeiro, um por SALIC",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, III",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "gru_saldos",
        "descricao": "Comprovantes de recolhimento dos saldos da movimentação e das aplicações (GRU)",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, IV; art. 2º, § 3º",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "encerramento_contas",
        "descricao": "Comprovantes de encerramento das contas abertas pela proponente (emitidos pelo banco)",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, V; art. 2º, § 3º",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "extratos",
        "descricao": "Extratos de todas as contas, inclusive de aplicação, da abertura ao encerramento",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VI",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "objeto",
        "descricao": "Material de cumprimento do objeto e da finalidade, pela modalidade",
        "em": [
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VII",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "documentos_fiscais",
        "descricao": "Cópias digitalizadas dos documentos fiscais e auxiliares, quando pedidas",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, VIII; art. 2º, § 1º",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "junta_comercial",
        "descricao": "Registro na junta comercial, em projetos de aquisição de ações",
        "em": [
          "final"
        ],
        "obrigatorio": false,
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 1º, parágrafo único",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "confirmacao_str",
        "descricao": "E-mail de confirmação do envio pelo STR, impresso e juntado (enviar pelo STR não é entregar a prestação)",
        "em": [
          "parcial",
          "final"
        ],
        "obrigatorio": true,
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§§ 6.1 e 6.3",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "modelos": [
      {
        "codigo": "rp",
        "nome": "Relação de Pagamentos (RP)",
        "formato": "xls (Excel 97-2003)",
        "arquivo": "ancine/IN_159_Relacao_de_Pagamentos.xls",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, formulário I",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "de",
        "nome": "Demonstrativo do Extrato da Conta Corrente (DE)",
        "formato": "xls (Excel 97-2003)",
        "arquivo": "ancine/IN_159_Demonstrativo_do_Extrato.xls",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, formulário II",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "do",
        "nome": "Demonstrativo Orçamentário e Financeiro (DO)",
        "formato": "xls (Excel 97-2003)",
        "arquivo": "ancine/IN_159_Demonstrativo_Orcamentario_e_Financeiro.xls",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, formulário III",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "regras": [
      {
        "codigo": "xls_97",
        "descricao": "O STR só carrega planilha salva como Pasta de Trabalho do Excel 97-2003 (.xls), com nome de mais de 5 caracteres.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§§ 3.1 e 3.2",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "salic_nas_planilhas",
        "descricao": "Nas planilhas, só o SALIC no formato NN-NNNN.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§§ 2.3 e 3.2.1",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "criticas_de_cruzamento",
        "descricao": "RP casa com o DE (histórico e data) e com o DO (item orçamentário com o mesmo texto); o comprovado não pode ser menor que o a comprovar.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§ 5.3",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "uma_por_fonte",
        "descricao": "Uma prestação por projeto e fonte (incentivo, fomento direto, FSA), com SALIC e processo próprios.",
        "severidade": "bloqueio",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 10",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "bb_gestao_agil",
        "descricao": "Em contas do BB Gestão Ágil, o DE é gerado pelo STR e a RP vem pré-preenchida para revisar.",
        "severidade": "info",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§§ 3.1 e 4.1.1",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "reabrir_envio",
        "descricao": "Depois do envio, as planilhas do SALIC travam; reabrir pede e-mail à ANCINE, que apaga todas.",
        "severidade": "info",
        "fonte": {
          "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
          "dispositivo": "§ 6.3",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "documentos_em_180_dias",
        "descricao": "Os documentos fiscais digitalizados podem ser enviados em até 180 dias da diligência.",
        "severidade": "info",
        "parametros": {
          "dias": 180
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "Anexo, art. 2º, § 2º"
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, arts. 1º a 4º",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "posEnvio": {
    "resultados": [
      {
        "resultado": "aprovada",
        "descricao": "Objeto e finalidade cumpridos e contas regulares.",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 20 e 68",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "resultado": "aprovada_ressalvas",
        "descricao": "Concentração de 25% ou mais, depósitos sem finalidade, formulários errados, logomarca, transferências indevidas, glosa recolhida e outras hipóteses.",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 22 e 28",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "resultado": "reprovada",
        "descricao": "Omissão, objeto não entregue, glosa não ressarcida, valores não comprovados, gestão fraudulenta, CPB não emitido, diligência não atendida ou objeto reprovado (não aprovação).",
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 29",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "devolucao": {
      "descricao": "GRU pelo PagTesouro, pela fonte do recurso, com o SALIC como referência e só o valor principal preenchido.",
      "atualizacao": "SELIC a partir do mês seguinte ao vencimento e 1% no mês do pagamento; mora de 0,33% ao dia até 20% (IN 164/2022); data-base pelo art. 32 da IN 159.",
      "gru": [
        {
          "unidadeGestora": "340002",
          "gestao": null,
          "codigo": "019401",
          "referencia": "SALIC só com dígitos",
          "fonte": {
            "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
            "dispositivo": "p. 14–17",
            "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Lei 8.313/1991, arts. 18 e 25: órgão 34902 (Fundo Nacional de Cultura).",
            "aConfirmar": true
          }
        },
        {
          "unidadeGestora": "203003",
          "gestao": null,
          "codigo": "026642",
          "referencia": "SALIC só com dígitos",
          "fonte": {
            "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
            "dispositivo": "p. 14–17",
            "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Lei 8.685/1993, arts. 1º, 1º-A, 3º e 3º-A: órgão 20203 (ANCINE).",
            "aConfirmar": true
          }
        },
        {
          "unidadeGestora": "203003",
          "gestao": null,
          "codigo": "026667",
          "referencia": "SALIC só com dígitos",
          "fonte": {
            "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
            "dispositivo": "p. 14–17",
            "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. PAR/PAQ, orçamento da ANCINE.",
            "aConfirmar": true
          }
        },
        {
          "unidadeGestora": "203003",
          "gestao": null,
          "codigo": "026674",
          "referencia": "SALIC só com dígitos",
          "fonte": {
            "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
            "dispositivo": "p. 14–17",
            "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida. Editais FSA, MP 2.228-1 (art. 39, X) e Funcines.",
            "aConfirmar": true
          }
        }
      ],
      "fonte": {
        "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
        "dispositivo": "p. 14–17 e 69",
        "aConfirmar": true,
        "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
      }
    },
    "regras": [
      {
        "codigo": "multa_na_nao_aprovacao",
        "descricao": "Na não aprovação, multa de 50% (Lei 8.685) ou 20% (FSA e Funcines) sobre o débito atualizado; pagar antes evita a multa.",
        "severidade": "alerta",
        "parametros": {
          "leiAudiovisual": 50,
          "fsaFuncines": 20
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 31 a 36",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "inadimplencia",
        "descricao": "Atraso na prestação, parcela não paga ou diligência sem resposta geram inadimplência, que trava novos projetos da proponente e do grupo até a regularização.",
        "severidade": "alerta",
        "fonte": {
          "documento": "Manual de Prestação de Contas ANCINE v2.11 (23/09/2026)",
          "dispositivo": "p. 68",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "sancoes",
        "descricao": "Advertência ou inabilitação por até 2 anos, aplicadas depois do prazo recursal, alcançando empresas do mesmo grupo.",
        "severidade": "alerta",
        "parametros": {
          "anos": 2
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "art. 42",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "parcelamento",
        "descricao": "Parcelamento em até 60 vezes, parcela mínima de R$ 200 (PJ) ou R$ 50 (PF).",
        "severidade": "info",
        "parametros": {
          "parcelas": 60
        },
        "fonte": {
          "documento": "IN ANCINE 164/2022",
          "dispositivo": "parcelamento",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "tce",
        "descricao": "TCE dispensada abaixo de R$ 120 mil ou depois de 10 anos; abaixo disso, cobrança extrajudicial.",
        "severidade": "info",
        "parametros": {
          "valor": 120000
        },
        "fonte": {
          "documento": "IN TCU 98/2024",
          "dispositivo": "art. 6º, I; Manual v2.11, p. 71–73",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "prescricao",
        "descricao": "Prescrição de 5 anos e intercorrente de 3 anos com o processo parado.",
        "severidade": "info",
        "fonte": {
          "documento": "Res. TCU 344/2022",
          "dispositivo": "arts. 2º e 8º; DDC ANCINE 110-E/2023",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      },
      {
        "codigo": "inspecao",
        "descricao": "Inspeção in loco agendada com 10 dias de antecedência; impedi-la leva a inadimplência.",
        "severidade": "info",
        "parametros": {
          "dias": 10
        },
        "fonte": {
          "documento": "IN ANCINE 159/2021",
          "dispositivo": "arts. 58 a 60",
          "aConfirmar": true,
          "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
        }
      }
    ],
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "arts. 22 a 50",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  "guarda": {
    "marco": "registro_decisao",
    "quantidade": 5,
    "unidade": "anos",
    "prorrogaParaDiaUtil": false,
    "descricao": "Originais por 5 anos a partir da decisão final, em ordem cronológica ou da RP; papel termossensível guardado com cópia.",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "art. 8º",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  }
}$regime$::jsonb,
  $fontes$[
  {
    "documento": "Manuais de prestação de contas (ANCINE)",
    "url": "https://www.gov.br/ancine/pt-br/assuntos/atribuicoes-ancine/fomento/prestacao-de-contas/manuais"
  },
  {
    "documento": "IN ANCINE 159/2021, art. 63 (transição)",
    "url": "https://www.gov.br/ancine/pt-br/acesso-a-informacao/legislacao/instrucoes-normativas/instrucao-normativa-no-159"
  }
]$fontes$::jsonb,
  $checklist$[
  {
    "codigo": "rp",
    "descricao": "Relação de Pagamentos, uma por conta de movimentação e uma de contrapartida fora da conta",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, I",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "de",
    "descricao": "Demonstrativo do Extrato da Conta Corrente, um por conta",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, II",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "do",
    "descricao": "Demonstrativo Orçamentário e Financeiro, um por SALIC",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, III",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "gru_saldos",
    "descricao": "Comprovantes de recolhimento dos saldos da movimentação e das aplicações (GRU)",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, IV; art. 2º, § 3º",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "encerramento_contas",
    "descricao": "Comprovantes de encerramento das contas abertas pela proponente (emitidos pelo banco)",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, V; art. 2º, § 3º",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "extratos",
    "descricao": "Extratos de todas as contas, inclusive de aplicação, da abertura ao encerramento",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, VI",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "objeto",
    "descricao": "Material de cumprimento do objeto e da finalidade, pela modalidade",
    "em": [
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, VII",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "documentos_fiscais",
    "descricao": "Cópias digitalizadas dos documentos fiscais e auxiliares, quando pedidas",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, VIII; art. 2º, § 1º",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "junta_comercial",
    "descricao": "Registro na junta comercial, em projetos de aquisição de ações",
    "em": [
      "final"
    ],
    "obrigatorio": false,
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, art. 1º, parágrafo único",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "confirmacao_str",
    "descricao": "E-mail de confirmação do envio pelo STR, impresso e juntado (enviar pelo STR não é entregar a prestação)",
    "em": [
      "parcial",
      "final"
    ],
    "obrigatorio": true,
    "fonte": {
      "documento": "Manual STR – Planilhas v2.2 (30/09/2025)",
      "dispositivo": "§§ 6.1 e 6.3",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  }
]$checklist$::jsonb,
  $modelos$[
  {
    "codigo": "rp",
    "nome": "Relação de Pagamentos (RP)",
    "formato": "xls (Excel 97-2003)",
    "arquivo": "ancine/IN_159_Relacao_de_Pagamentos.xls",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, formulário I",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "de",
    "nome": "Demonstrativo do Extrato da Conta Corrente (DE)",
    "formato": "xls (Excel 97-2003)",
    "arquivo": "ancine/IN_159_Demonstrativo_do_Extrato.xls",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, formulário II",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  },
  {
    "codigo": "do",
    "nome": "Demonstrativo Orçamentário e Financeiro (DO)",
    "formato": "xls (Excel 97-2003)",
    "arquivo": "ancine/IN_159_Demonstrativo_Orcamentario_e_Financeiro.xls",
    "fonte": {
      "documento": "IN ANCINE 159/2021",
      "dispositivo": "Anexo, formulário III",
      "aConfirmar": true,
      "nota": "Conferido na IN 159/2021; na IN 150/2019 a regra equivalente não foi conferida."
    }
  }
]$modelos$::jsonb,
  now()
)
on conflict (codigo, versao) do nothing;

-- Genérico (sem regras de lei) (versão 2)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'generico' and versao < 2 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, vigente_ate, status, parametros, fontes, checklist_envio, modelos_saida, publicado_em)
values (
  'generico', 2, 'Genérico (sem regras de lei)', 'outro', 'outros',
  'federal', '—', null, 'Sem norma específica; vale o contrato de patrocínio',
  null, null, 'publicado',
  $regime${
  "codigo": "generico",
  "versao": 2,
  "nome": "Genérico (sem regras de lei)",
  "area": "outro",
  "mecanismo": "outros",
  "esfera": "federal",
  "orgao": "—",
  "sistemaOficial": null,
  "normaReferencia": "Sem norma específica; vale o contrato de patrocínio",
  "vigenteDesde": null,
  "identificadorOficial": null,
  "fontes": [],
  "aplicabilidade": {
    "lacuna": "nao_se_aplica",
    "motivo": "Vale para qualquer projeto sem regime de lei.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "prazos": {
    "prestacaoFinal": {
      "lacuna": "nao_se_aplica",
      "motivo": "O prazo de envio vem do contrato; informe-o na prestação.",
      "fonte": {
        "documento": "Contrato, termo ou edital do patrocínio",
        "dispositivo": "cláusulas do instrumento",
        "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
      }
    },
    "respostaDiligencia": {
      "lacuna": "nao_se_aplica",
      "motivo": "O prazo de resposta vem do contrato ou do pedido do patrocinador.",
      "fonte": {
        "documento": "Contrato, termo ou edital do patrocínio",
        "dispositivo": "cláusulas do instrumento",
        "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
      }
    },
    "analisePrestacao": {
      "lacuna": "nao_se_aplica",
      "motivo": "O prazo de análise vem do contrato.",
      "fonte": {
        "documento": "Contrato, termo ou edital do patrocínio",
        "dispositivo": "cláusulas do instrumento",
        "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
      }
    },
    "recurso": {
      "lacuna": "nao_se_aplica",
      "motivo": "O contrato define se cabe recurso.",
      "fonte": {
        "documento": "Contrato, termo ou edital do patrocínio",
        "dispositivo": "cláusulas do instrumento",
        "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
      }
    },
    "devolucao": {
      "lacuna": "nao_se_aplica",
      "motivo": "O contrato define a devolução de saldo.",
      "fonte": {
        "documento": "Contrato, termo ou edital do patrocínio",
        "dispositivo": "cláusulas do instrumento",
        "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
      }
    }
  },
  "prestacaoParcial": {
    "lacuna": "nao_se_aplica",
    "motivo": "Prestação parcial só se o contrato pedir.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "orcamento": {
    "estrutura": {
      "niveis": [
        "Etapa",
        "Item"
      ],
      "descricao": "Orçamento livre, nos agrupadores que o contrato usar.",
      "fonte": {
        "documento": "Contrato, termo ou edital do patrocínio",
        "dispositivo": "cláusulas do instrumento",
        "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
      }
    },
    "grupos": [
      {
        "codigo": "execucao",
        "rotulo": "Execução",
        "descricao": "Custos diretos do objeto.",
        "fonte": {
          "documento": "Contrato, termo ou edital do patrocínio",
          "dispositivo": "cláusulas do instrumento",
          "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
        }
      },
      {
        "codigo": "administracao",
        "rotulo": "Administração",
        "descricao": "Custos administrativos.",
        "fonte": {
          "documento": "Contrato, termo ou edital do patrocínio",
          "dispositivo": "cláusulas do instrumento",
          "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
        }
      },
      {
        "codigo": "divulgacao",
        "rotulo": "Divulgação e acessibilidade",
        "descricao": "Comunicação, divulgação e acessibilidade.",
        "fonte": {
          "documento": "Contrato, termo ou edital do patrocínio",
          "dispositivo": "cláusulas do instrumento",
          "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
        }
      },
      {
        "codigo": "captacao",
        "rotulo": "Captação",
        "descricao": "Remuneração de captação.",
        "fonte": {
          "documento": "Contrato, termo ou edital do patrocínio",
          "dispositivo": "cláusulas do instrumento",
          "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
        }
      },
      {
        "codigo": "elaboracao",
        "rotulo": "Elaboração",
        "descricao": "Elaboração do projeto.",
        "fonte": {
          "documento": "Contrato, termo ou edital do patrocínio",
          "dispositivo": "cláusulas do instrumento",
          "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
        }
      },
      {
        "codigo": "recolhimentos",
        "rotulo": "Recolhimentos",
        "descricao": "Tributos e encargos.",
        "fonte": {
          "documento": "Contrato, termo ou edital do patrocínio",
          "dispositivo": "cláusulas do instrumento",
          "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
        }
      }
    ],
    "bases": {
      "valor_total_projeto": {
        "descricao": "Total do orçamento.",
        "soma": "todos",
        "exceto": [],
        "fonte": {
          "documento": "Contrato, termo ou edital do patrocínio",
          "dispositivo": "cláusulas do instrumento",
          "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
        }
      }
    },
    "tetos": [],
    "regras": []
  },
  "alteracoes": {
    "lacuna": "nao_se_aplica",
    "motivo": "O contrato define se a alteração precisa de aceite do patrocinador; a pessoa escolhe a classificação.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "fornecedores": {
    "lacuna": "nao_se_aplica",
    "motivo": "Sem limite por fornecedor fora do contrato.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "contas": {
    "lacuna": "nao_se_aplica",
    "motivo": "A conta é a que o contrato indicar.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "pagamentos": {
    "lacuna": "nao_se_aplica",
    "motivo": "Sem restrição de meio de pagamento fora do contrato.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "despesas": {
    "lacuna": "nao_se_aplica",
    "motivo": "Período e vedações seguem o contrato.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "porte": {
    "lacuna": "nao_se_aplica",
    "motivo": "Sem classificação por porte.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "objeto": {
    "lacuna": "nao_se_aplica",
    "motivo": "O objeto e as metas são os do contrato.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "divulgacao": {
    "lacuna": "nao_se_aplica",
    "motivo": "Marcas e aprovação de peças seguem o contrato.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "envio": {
    "lacuna": "nao_se_aplica",
    "motivo": "O formato de envio é o que o patrocinador pedir.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "posEnvio": {
    "lacuna": "nao_se_aplica",
    "motivo": "A análise e a devolução seguem o contrato.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  },
  "guarda": {
    "lacuna": "nao_se_aplica",
    "motivo": "Guarda pelo contrato e pela legislação fiscal.",
    "fonte": {
      "documento": "Contrato, termo ou edital do patrocínio",
      "dispositivo": "cláusulas do instrumento",
      "nota": "Patrocínio direto e leis ainda não modeladas seguem o instrumento assinado, não uma norma do Jards."
    }
  }
}$regime$::jsonb,
  $fontes$[]$fontes$::jsonb,
  $checklist$[]$checklist$::jsonb,
  $modelos$[]$modelos$::jsonb,
  now()
)
on conflict (codigo, versao) do nothing;

-- Calendário: feriados nacionais e defeso eleitoral
insert into public.calendario_regulatorio (tipo, esfera, uf, municipio, inicio, fim, descricao, fonte)
values
  ('feriado', 'federal', null, null, '2026-01-01', '2026-01-01', 'Confraternização Universal', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('ponto_facultativo', 'federal', null, null, '2026-02-16', '2026-02-16', 'Carnaval (segunda-feira)', 'Ponto facultativo federal (portaria anual do MGI)'),
  ('ponto_facultativo', 'federal', null, null, '2026-02-17', '2026-02-17', 'Carnaval (terça-feira)', 'Ponto facultativo federal (portaria anual do MGI)'),
  ('feriado', 'federal', null, null, '2026-04-03', '2026-04-03', 'Sexta-feira da Paixão', 'Calendário federal (portaria anual do MGI); Lei 9.093/1995, art. 2º'),
  ('feriado', 'federal', null, null, '2026-04-21', '2026-04-21', 'Tiradentes', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2026-05-01', '2026-05-01', 'Dia do Trabalho', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('ponto_facultativo', 'federal', null, null, '2026-06-04', '2026-06-04', 'Corpus Christi', 'Ponto facultativo federal (portaria anual do MGI)'),
  ('feriado', 'federal', null, null, '2026-09-07', '2026-09-07', 'Independência do Brasil', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2026-10-12', '2026-10-12', 'Nossa Senhora Aparecida', 'Lei 6.802/1980'),
  ('feriado', 'federal', null, null, '2026-11-02', '2026-11-02', 'Finados', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2026-11-15', '2026-11-15', 'Proclamação da República', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2026-11-20', '2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'Lei 14.759/2023'),
  ('feriado', 'federal', null, null, '2026-12-25', '2026-12-25', 'Natal', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2027-01-01', '2027-01-01', 'Confraternização Universal', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('ponto_facultativo', 'federal', null, null, '2027-02-08', '2027-02-08', 'Carnaval (segunda-feira)', 'Ponto facultativo federal (portaria anual do MGI)'),
  ('ponto_facultativo', 'federal', null, null, '2027-02-09', '2027-02-09', 'Carnaval (terça-feira)', 'Ponto facultativo federal (portaria anual do MGI)'),
  ('feriado', 'federal', null, null, '2027-03-26', '2027-03-26', 'Sexta-feira da Paixão', 'Calendário federal (portaria anual do MGI); Lei 9.093/1995, art. 2º'),
  ('feriado', 'federal', null, null, '2027-04-21', '2027-04-21', 'Tiradentes', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2027-05-01', '2027-05-01', 'Dia do Trabalho', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('ponto_facultativo', 'federal', null, null, '2027-05-27', '2027-05-27', 'Corpus Christi', 'Ponto facultativo federal (portaria anual do MGI)'),
  ('feriado', 'federal', null, null, '2027-09-07', '2027-09-07', 'Independência do Brasil', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2027-10-12', '2027-10-12', 'Nossa Senhora Aparecida', 'Lei 6.802/1980'),
  ('feriado', 'federal', null, null, '2027-11-02', '2027-11-02', 'Finados', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2027-11-15', '2027-11-15', 'Proclamação da República', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('feriado', 'federal', null, null, '2027-11-20', '2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'Lei 14.759/2023'),
  ('feriado', 'federal', null, null, '2027-12-25', '2027-12-25', 'Natal', 'Lei 662/1949, com a redação da Lei 10.607/2002'),
  ('defeso_eleitoral', 'federal', null, null, '2026-07-04', '2026-10-04', 'Defeso eleitoral das eleições gerais de 2026 (primeiro turno em 04/10/2026)', 'Lei 9.504/1997, art. 73, VI, b: três meses antes do pleito. Onde houver segundo turno (25/10/2026), estender até ele')
on conflict (tipo, esfera, coalesce(uf, ''), coalesce(municipio, ''), inicio) do nothing;
