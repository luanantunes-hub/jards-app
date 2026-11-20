"""O mesmo estudo do corte (estudo_de_corte.py), com o modelo SIMPLES (simples.py): é rápido, então roda com muitas sementes. Grava <pasta>/simples.csv."""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

from dados_sinteticos import gerar
from estudo_de_corte import FATOR_DE_CAUTELA, REFERENCIA, SEMANAS, VARIACOES, interpolar, verdadeiro
from simples import ajustar_simples


def rodada(semanas: int, variacao: str, semente: int) -> dict | None:
    tabela, verdade = gerar(semanas=semanas, semente=semente, com_controles=True, variacao=VARIACOES[variacao])
    r = ajustar_simples(tabela)
    canais = {c["canal"]: c for c in r["canais"]}
    mediana = {c: float(np.median([s["gasto"][c] for s in tabela if s["gasto"].get(c, 0) > 0])) for c in canais}
    itens = [(canais[c]["porcento"], canais[c]["baixo"], canais[c]["alto"], verdade[c]) for c in canais] + [(r["base"]["porcento"], r["base"]["baixo"], r["base"]["alto"], verdade["base"])]
    erros = [abs(e - v) for e, _, _, v in itens]
    dentro = np.mean([lo <= v <= hi for _, lo, hi, v in itens])
    alargado = np.mean([abs(e - v) <= FATOR_DE_CAUTELA * max(e - lo, hi - e) for e, lo, hi, v in itens])
    modelo = {c: interpolar(canais[c]["curva"], mediana[c] + REFERENCIA) - interpolar(canais[c]["curva"], mediana[c]) for c in canais}
    real = {c: verdadeiro(c, mediana[c] / 100 + 100) - verdadeiro(c, mediana[c] / 100) for c in canais}
    nomes = list(canais)
    pares = [(a, b) for i, a in enumerate(nomes) for b in nomes[i + 1:]]
    return {"semanas": semanas, "variacao": variacao, "semente": semente, "canais": len(canais), "erro_medio_pp": round(float(np.mean(erros)), 2), "erro_max_pp": round(float(np.max(erros)), 2),
            "dentro_do_intervalo": round(float(dentro), 2), "dentro_alargado": round(float(alargado), 2), "top1_certo": int(max(modelo, key=modelo.get) == max(real, key=real.get)),
            "ordem_certa": round(float(np.mean([(modelo[a] > modelo[b]) == (real[a] > real[b]) for a, b in pares])), 2) if pares else float("nan"),
            "erro_marginal_rel": round(float(np.mean([abs(modelo[c] - real[c]) / real[c] for c in canais])), 2),
            "erro_total_anuncios_pp": round(sum(c["porcento"] for c in canais.values()) - sum(verdade[c] for c in canais), 2)}


def main(argv: list[str]) -> int:
    pasta = Path(argv[1]); pasta.mkdir(parents=True, exist_ok=True)
    inicio, quantas = int(argv[2]), int(argv[3])
    linhas = []
    for semente in range(inicio, inicio + quantas):
        for variacao in VARIACOES:
            for semanas in [20] + SEMANAS:
                try:
                    linhas.append(rodada(semanas, variacao, semente))
                except Exception as e:
                    print("falhou", semanas, variacao, semente, type(e).__name__)
    with (pasta / "simples.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0])); w.writeheader(); w.writerows(linhas)
    print(len(linhas), "rodadas")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
