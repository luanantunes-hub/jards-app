# Modelo de marketing (MMM) da Ticketeria

O job semanal que estima quanto cada canal de divulgação contribuiu para as vendas de ingressos. Roda no GitHub Actions (`.github/workflows/modelo-semanal.yml`), toda segunda de manhã.

- `mmm.py`: o ajuste (PyMC-Marketing): efeito atrasado (adstock) e que rende cada vez menos (saturação) por canal, base com tendência e sazonalidade anual; devolve a contribuição de cada canal com intervalo de 80%, o custo por ingresso, a curva de resposta e os diagnósticos.
- `cliente.py` e `rodar.py`: falam com o Jards por três rotas com token (`MODELO_TOKEN`): listar as lojas prontas, ler a tabela semanal, devolver o resultado. O job **não** recebe a chave do banco.
- `dados_sinteticos.py` e `teste_sintetico.py`: dados inventados com resposta conhecida; provam que o modelo recupera o efeito dos canais, que não inventa efeito quando o gasto é embaralhado e que os intervalos alargam com menos semanas.

```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python teste_sintetico.py          # prova com dados inventados (alguns minutos)
MODELO_BASE_URL=https://jards.com.br MODELO_TOKEN=… python rodar.py   # roda de verdade
```

O resultado é uma **estimativa**: o intervalo diz o quanto ela ainda pode errar, e costuma ser otimista (o modelo supõe que está certo). Venda de ingresso é por evento, com data marcada: não é o caso clássico de MMM. Quanto menos semanas, mais larga a margem.
