-- Gerado por scripts/prestacao-gerar-seed-regimes.ts a partir de lib/prestacao/regimes
-- e lib/prestacao/calendario-regulatorio.ts. Não edite à mão: mude o código e
-- gere de novo. Idempotente.

-- Lei Rouanet — IN MinC 29/2026 (versão 1)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'rouanet_in29_2026' and versao < 1 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, status, parametros, fontes, publicado_em)
values (
  'rouanet_in29_2026', 1, 'Lei Rouanet — IN MinC 29/2026', 'cultura', 'rouanet',
  'federal', 'Ministério da Cultura', 'Salic', 'Lei 8.313/1991; IN MinC 29/2026, alterada pela IN MinC 34/2026',
  '2026-01-30'::date, 'publicado',
  $regime${
  "codigo": "rouanet_in29_2026",
  "versao": 1,
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
        "citacao": "com o prazo de 20 (vinte) dias para resposta"
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
    "devolucaoAposReprovacao": {
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
    "recurso": {
      "descricao": "Recorrer da decisão (inclusive da aprovação com ressalvas)",
      "responsavel": "proponente",
      "marco": "ciencia_decisao",
      "quantidade": 30,
      "unidade": "dias_corridos",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 78, caput",
        "citacao": "no prazo de 30 (trinta) dias"
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
  "limites": {
    "fornecedor": {
      "descricao": "Pagamentos a um mesmo fornecedor",
      "percentual": 20,
      "base": "valor_captado",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 24, caput",
        "citacao": "Um mesmo fornecedor não poderá ter pagamento acima de 20% (vinte por cento) do valor captado",
        "nota": "Exceções nos incisos I a V (projetos executivos, restauro, equipamentos culturais, gráfica de livros, energia elétrica)."
      }
    },
    "proponente": {
      "descricao": "Remuneração do proponente e partes relacionadas",
      "percentual": 20,
      "base": "valor_captado",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 23, caput e § 1º",
        "citacao": "os valores das remunerações não ultrapassem 20%",
        "nota": "Cônjuge, companheiro, coligada e empresa com sócio em comum entram no limite. Grupos artísticos familiares e corpos estáveis ficam fora (§ 2º, I)."
      }
    },
    "proponentePfMei": {
      "descricao": "Remuneração do proponente pessoa física ou MEI",
      "percentual": 30,
      "base": "valor_captado",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 23, § 2º, II",
        "citacao": "limitado a até 30% (trinta por cento) do valor captado"
      }
    },
    "captacao": {
      "descricao": "Remuneração de captação",
      "percentual": 10,
      "base": "valor_projeto",
      "teto": 150000,
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 19, caput e §§ 1º e 2º",
        "citacao": "limitada a 10% (dez por cento) do valor do projeto e ao teto de R$ 150.000,00",
        "nota": "Paga proporcionalmente às parcelas captadas, sem contar saldo transferido; por ano em planos plurianuais."
      }
    },
    "acessibilidadeDivulgacao": {
      "descricao": "Acessibilidade, comunicação e divulgação acessíveis",
      "percentual": 20,
      "base": "valor_projeto",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 20, caput",
        "citacao": "não poderá ultrapassar o limite de 20% (vinte por cento) do valor do projeto"
      }
    },
    "administracao": {
      "descricao": "Custos de administração, incluindo tarifas necessárias",
      "percentual": 15,
      "base": "valor_projeto",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 22, caput e III",
        "citacao": "tarifas bancárias cujo adimplemento se faz necessário à realização de tais atividades"
      }
    },
    "direitosAutorais": {
      "descricao": "Direitos autorais",
      "percentual": 10,
      "base": "valor_aprovado_execucao",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 27",
        "citacao": "até o limite de 10% (dez por cento) sobre o valor aprovado para execução"
      }
    },
    "liberacaoMovimentacao": {
      "descricao": "Captação mínima para liberar a movimentação",
      "percentual": 20,
      "base": "valor_total_projeto",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 56, caput",
        "citacao": "será liberado para execução quando atingir 20% (vinte por cento) do valor total do projeto",
        "nota": "Planos anuais e plurianuais seguem frações próprias (1/12 a 1/48); exceções para restauro urgente e contrato de patrocínio."
      }
    },
    "complementacaoCaptacaoMinima": {
      "descricao": "Captação mínima para pedir complementação",
      "percentual": 50,
      "base": "valor_homologado_execucao",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 64, § 4º",
        "citacao": "desde que o projeto tenha captado, no mínimo, 50% (cinquenta por cento) do valor homologado para execução"
      }
    },
    "reducaoMaxima": {
      "descricao": "Redução máxima do projeto",
      "percentual": 50,
      "base": "valor_total_projeto",
      "fonte": {
        "documento": "IN MinC 29/2026",
        "dispositivo": "art. 64, § 5º",
        "citacao": "nem representar diminuição superior a 50% (cinquenta por cento) do valor total do projeto"
      }
    }
  },
  "pagamentos": {
    "meiosPermitidos": [
      "pix",
      "ted"
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 58",
      "citacao": "exclusivamente por meio de mecanismos formais de pagamento, como PIX e TED",
      "aConfirmar": true,
      "nota": "\"Como PIX e TED\" é exemplificativo e a IN não veda saque nem cheque (Anexo I, XVI). Outros meios geram alerta, não bloqueio."
    }
  },
  "contas": {
    "descricao": "Conta captação e conta movimento, abertas pelo MinC e isentas de tarifas",
    "bancos": [
      "Banco do Brasil"
    ],
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "arts. 53, 54 e 57",
      "citacao": "abertas pelo Ministério da Cultura, exclusivamente no Banco do Brasil"
    }
  },
  "guarda": {
    "marco": "fim_vigencia",
    "quantidade": 5,
    "unidade": "anos",
    "prorrogaParaDiaUtil": false,
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 82",
      "citacao": "pelo prazo de 5 (cinco) anos, contados do final da sua vigência"
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
    "fonte": {
      "documento": "IN MinC 29/2026",
      "dispositivo": "art. 72, parágrafo único",
      "citacao": "pequeno porte: aqueles com captação até R$ 750.000,00"
    }
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
  ]
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
  now()
)
on conflict (codigo, versao) do nothing;

-- Genérico (sem regras de lei) (versão 1)
update public.prestacao_regimes set status = 'obsoleto'
where codigo = 'generico' and versao < 1 and status = 'publicado';

insert into public.prestacao_regimes
  (codigo, versao, nome, area, mecanismo, esfera, orgao, sistema_oficial, norma_referencia,
   vigente_desde, status, parametros, fontes, publicado_em)
values (
  'generico', 1, 'Genérico (sem regras de lei)', 'outro', 'outros',
  'federal', '—', null, 'Sem norma específica; vale o contrato de patrocínio',
  null, 'publicado',
  $regime${
  "codigo": "generico",
  "versao": 1,
  "nome": "Genérico (sem regras de lei)",
  "area": "outro",
  "mecanismo": "outros",
  "esfera": "federal",
  "orgao": "—",
  "sistemaOficial": null,
  "normaReferencia": "Sem norma específica; vale o contrato de patrocínio",
  "vigenteDesde": null,
  "identificadorOficial": null,
  "prazos": {},
  "limites": {},
  "pagamentos": {
    "meiosPermitidos": null,
    "fonte": null
  },
  "contas": null,
  "guarda": null,
  "porte": null,
  "fontes": []
}$regime$::jsonb,
  $fontes$[]$fontes$::jsonb,
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
