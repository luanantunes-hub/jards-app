# Modelo de marketing (MMM) da Ticketeria

O job semanal que estima quanto cada canal de divulgação contribuiu para as vendas de ingressos. Roda no GitHub Actions (`.github/workflows/modelo-semanal.yml`), toda segunda de manhã.

- `mmm.py`: o ajuste (PyMC-Marketing): efeito atrasado (adstock) e que rende cada vez menos (saturação) por canal, base com tendência e sazonalidade anual; devolve a contribuição de cada canal com intervalo de 80%, o custo por ingresso, a curva de resposta e os diagnósticos.
- **Controles** (além do gasto): a tabela semanal traz, por semana, `controles` (proximidade da sessão, feriado, virada de lote, preço relativo, cupom e, quando houver GA4, visitas sem anúncio; ver `lib/ticketeria/modelo-controles.ts`). Os dois primeiros entram sempre; os outros só com 52 semanas ou mais e só se variam. A base ("venderia de qualquer jeito") volta dividida em partes (`base.partes`): nível da loja, tendência e época do ano e cada controle.
- `estudo_de_corte.py`, `estudo_simples.py` e `simples.py`: o estudo que definiu o corte de confiança (com quantas semanas dá para confiar) e o modelo simples que NÃO foi adotado; resultado em `ESTUDO-DO-CORTE.md`.
- `cliente.py` e `rodar.py`: falam com o Jards por três rotas com token (`MODELO_TOKEN`): listar as lojas prontas, ler a tabela semanal, devolver o resultado. O job **não** recebe a chave do banco.
- `dados_sinteticos.py` e `teste_sintetico.py`: dados inventados com resposta conhecida; provam que o modelo recupera o efeito dos canais, que não inventa efeito quando o gasto é embaralhado e que os intervalos alargam com menos semanas.

```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python teste_sintetico.py          # prova com dados inventados (alguns minutos)
MODELO_BASE_URL=https://jards.com.br MODELO_TOKEN=… python rodar.py   # roda de verdade
```

O resultado é uma **estimativa**: o intervalo diz o quanto ela ainda pode errar, e costuma ser otimista (o modelo supõe que está certo). Venda de ingresso é por evento, com data marcada: não é o caso clássico de MMM. Quanto menos semanas, mais larga a margem.
