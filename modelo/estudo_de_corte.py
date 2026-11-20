"""Estudo do corte mínimo: com quantas semanas de histórico o modelo já dá para confiar? Roda o modelo em muitos dados inventados (resposta verdadeira conhecida), variando o número de semanas e o quanto o
gasto varia, e mede: o erro de cada canal, se a verdade cai dentro do intervalo (e dentro do intervalo alargado pelo fator de cautela), se a recomendação de canal sai certa e a convergência.

Uso: python estudo_de_corte.py <pasta de saída> [semente-inicial] [sementes] [semanas separadas por vírgula] [variações separadas por vírgula] — grava uma linha por rodada em <pasta>/corte.csv
(assim dá para acompanhar e retomar). Sem os dois últimos argumentos roda todas as combinações.
"""
from __future__ import annotations

import csv
import math
import sys
import time
from pathlib import Path

import numpy as np

from dados_sinteticos import VERDADE, gerar
from mmm import ajustar

SEMANAS = [30, 45, 58, 80, 104]
VARIACOES = {"baixa": 0.35, "alta": 1.0}
FATOR_DE_CAUTELA = 3.0  # o mesmo de lib/ticketeria/modelo-resultado.ts
REFERENCIA = 10000  # R$ 100 em centavos


def verdadeiro(canal: str, gasto_reais: float) -> float:
    """Os ingressos por semana que o canal traz com um gasto semanal constante (adstock em regime)."""
    v = VERDADE[canal]
    return v["beta"] * (1 - math.exp(-v["lam"] * gasto_reais / ((1 - v["adstock"]) * v["escala"])))


def interpolar(curva: list[dict], g: float) -> float:
    gs = [p["gasto_centavos"] for p in curva]
    if g <= gs[0]:
        return curva[0]["ingressos"]
    if g >= gs[-1]:
        return curva[-1]["ingressos"]
    i = next(k for k, x in enumerate(gs) if x >= g)
    a, b = curva[i - 1], curva[i]
    return a["ingressos"] + (b["ingressos"] - a["ingressos"]) * (g - a["gasto_centavos"]) / (b["gasto_centavos"] - a["gasto_centavos"])


def uma_rodada(semanas: int, variacao: str, semente: int) -> dict:
    tabela, verdade = gerar(semanas=semanas, semente=semente, com_controles=True, variacao=VARIACOES[variacao])
    t0 = time.time()
    r = ajustar(tabela, draws=400, tune=400)
    canais = {c["canal"]: c for c in r["canais"]}
    # Medianas do gasto semanal (nas semanas com gasto), como a tela usa.
    mediana = {c: float(np.median([s["gasto"][c] for s in tabela if s["gasto"].get(c, 0) > 0])) for c in canais}
    erros, dentro, dentro_alargado = [], 0, 0
    itens = [(c, canais[c]["porcento"], canais[c]["baixo"], canais[c]["alto"], verdade[c]) for c in canais] + [("base", r["base"]["porcento"], r["base"]["baixo"], r["base"]["alto"], verdade["base"])]
    for _, est, lo, hi, real in itens:
        erros.append(abs(est - real))
        dentro += lo <= real <= hi
        meio = est
        margem = FATOR_DE_CAUTELA * max(meio - lo, hi - meio)
        dentro_alargado += (meio - margem) <= real <= (meio + margem)
    # A recomendação: o canal com mais ingressos por R$ 100 a mais, no gasto mediano.
    modelo = {c: interpolar(canais[c]["curva"], mediana[c] + REFERENCIA) - interpolar(canais[c]["curva"], mediana[c]) for c in canais}
    real_m = {c: verdadeiro(c, mediana[c] / 100 + 100) - verdadeiro(c, mediana[c] / 100) for c in canais}
    top_modelo, top_real = max(modelo, key=modelo.get), max(real_m, key=real_m.get)
    # Pares de canais na ordem certa (de 0 a 1).
    nomes = list(canais)
    pares = [(a, b) for i, a in enumerate(nomes) for b in nomes[i + 1:]]
    ordem_certa = float(np.mean([(modelo[a] > modelo[b]) == (real_m[a] > real_m[b]) for a, b in pares])) if pares else float("nan")
    marg_erro = float(np.mean([abs(modelo[c] - real_m[c]) / real_m[c] for c in canais]))
    total_est = sum(c["porcento"] for c in canais.values())
    total_real = sum(verdade[c] for c in canais)
    return {
        "semanas": semanas, "variacao": variacao, "semente": semente, "canais": len(canais), "erro_medio_pp": round(float(np.mean(erros)), 2), "erro_max_pp": round(float(np.max(erros)), 2),
        "dentro_do_intervalo": round(dentro / len(itens), 2), "dentro_alargado": round(dentro_alargado / len(itens), 2), "top1_certo": int(top_modelo == top_real), "ordem_certa": round(ordem_certa, 2),
        "erro_marginal_rel": round(marg_erro, 2), "erro_total_anuncios_pp": round(total_est - total_real, 2), "r_hat": r["diagnosticos"]["r_hat_maximo"], "divergencias": r["diagnosticos"]["divergencias"],
        "segundos": round(time.time() - t0, 1),
    }


def main(argv: list[str]) -> int:
    pasta = Path(argv[1])
    pasta.mkdir(parents=True, exist_ok=True)
    inicio, quantas = (int(argv[2]) if len(argv) > 2 else 100), (int(argv[3]) if len(argv) > 3 else 4)
    so_semanas = [int(x) for x in argv[4].split(",")] if len(argv) > 4 else SEMANAS
    so_variacoes = argv[5].split(",") if len(argv) > 5 else list(VARIACOES)
    arquivo = pasta / "corte.csv"
    feitas = set()
    if arquivo.exists():
        with arquivo.open() as f:
            feitas = {(int(l["semanas"]), l["variacao"], int(l["semente"])) for l in csv.DictReader(f)}
    novo = not arquivo.exists()
    with arquivo.open("a", newline="") as f:
        w = None
        for semente in range(inicio, inicio + quantas):
            for variacao in so_variacoes:
                for semanas in so_semanas:
                    if (semanas, variacao, semente) in feitas:
                        continue
                    try:
                        linha = uma_rodada(semanas, variacao, semente)
                    except Exception as e:  # uma rodada que falha não derruba o estudo: fica registrada
                        print(f"falhou {semanas} {variacao} {semente}: {type(e).__name__}", flush=True)
                        continue
                    if w is None:
                        w = csv.DictWriter(f, fieldnames=list(linha))
                        if novo:
                            w.writeheader()
                    w.writerow(linha)
                    f.flush()
                    print(linha, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
