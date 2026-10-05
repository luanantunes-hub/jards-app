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
