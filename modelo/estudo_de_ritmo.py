"""Estudo do ritmo de venda comparado com eventos parecidos: a previsão da lotação de um evento a partir do que eventos parecidos do mesmo produtor tinham vendido no mesmo ponto (dias até a sessão).

Dados inventados de resposta conhecida (cada evento tem o seu tamanho final e a sua curva de venda; 15% dos "parecidos" não se parecem de verdade: um nome menor ou maior que muda o tamanho). Para cada número de eventos
parecidos (1 a 8) e cada ponto no tempo (45, 30, 18, 10 e 5 dias antes da sessão) mede: o erro da previsão, se a verdade cai dentro da faixa (a mínima-máxima dos parecidos e um intervalo de previsão de 80%) e o
erro da conta simples do ritmo dos últimos 7 dias, para comparar.

Uso: python estudo_de_ritmo.py [tentativas] — imprime a tabela e grava ritmo.csv ao lado do script.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

DIAS_DA_CURVA = 60
PONTOS = [45, 30, 18, 10, 5]
QUANTOS = [1, 2, 3, 4, 6, 8]
T80 = {1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.44, 7: 1.415, 8: 1.397, 9: 1.383}  # t de Student bicaudal 80% por GRAUS DE LIBERDADE (= parecidos - 1)


def evento(rng: np.random.Generator, parecido: bool = True) -> tuple[float, float]:
    """(fração final vendida, expoente da curva). Parecido de verdade: tamanho em torno de 85% da lotação; os "falsos parecidos" (15%) têm tamanho bem diferente."""
    final = float(np.clip(rng.normal(0.85, 0.12), 0.3, 1.0))
    if not parecido:
        final = float(np.clip(final * rng.choice([0.5, 1.4]), 0.2, 1.0))
    return final, float(np.exp(rng.normal(np.log(1.6), 0.2)))


def acumulado(final: float, k: float, d: int, rng: np.random.Generator) -> float:
    """A fração da lotação vendida a d dias da sessão (com ruído de venda)."""
    base = final * (1 - (d / DIAS_DA_CURVA) ** k)
    return float(max(0.001, base * (1 + rng.normal(0, 0.03)))) if d < DIAS_DA_CURVA else 0.001


def uma_tentativa(rng: np.random.Generator, n: int, d: int) -> dict[str, float]:
    alvo_final, alvo_k = evento(rng)
    atual = acumulado(alvo_final, alvo_k, d, rng)
    anterior = acumulado(alvo_final, alvo_k, d + 7, rng)
    comparaveis = [evento(rng, parecido=bool(rng.random() > 0.15)) for _ in range(n)]
    projecoes = np.array([min(1.0, atual / acumulado(f, k, d, rng) * f) for f, k in comparaveis])
    mediana = float(np.median(projecoes))
    logs = np.log(projecoes)
    if n >= 2:
        s = float(np.std(logs, ddof=1))
        t = T80.get(n - 1, 1.3)
        meio = float(np.mean(logs))
        pi_baixo, pi_alto = np.exp(meio - t * s * np.sqrt(1 + 1 / n)), min(1.0, np.exp(meio + t * s * np.sqrt(1 + 1 / n)))
    else:
        pi_baixo, pi_alto = float("nan"), float("nan")
    ritmo = (atual - anterior) / 7
    ingenua = min(1.0, atual + ritmo * d)
    verdade = alvo_final
    return {
        "erro_mediana": abs(mediana - verdade) / verdade, "erro_ingenua": abs(ingenua - verdade) / verdade,
        "minmax": float(projecoes.min() <= verdade <= projecoes.max()), "pi": float(pi_baixo <= verdade <= pi_alto) if n >= 2 else float("nan"),
        "largura_pi": float(pi_alto - pi_baixo) if n >= 2 else float("nan"), "largura_minmax": float(projecoes.max() - projecoes.min()),
    }


def cobertura_com_fator(fatores: list[float], quantos: list[int], pontos: list[int], tentativas: int = 3000) -> list[tuple]:
    """Quanto o intervalo de previsão de 80% cobre a verdade e que largura tem, para cada fator que o alarga (serve a escolher FATOR_DA_FAIXA)."""
    rng = np.random.default_rng(7)
    saida = []
    for fator in fatores:
        for n in quantos:
            cob, lar = [], []
            for d in pontos:
                for _ in range(tentativas):
                    alvo_final, alvo_k = evento(rng)
                    atual = acumulado(alvo_final, alvo_k, d, rng)
                    comp = [evento(rng, parecido=bool(rng.random() > 0.15)) for _ in range(n)]
                    p = np.array([min(1.0, atual / acumulado(f, k, d, rng) * f) for f, k in comp])
                    lg = np.log(p)
                    meia = T80.get(n - 1, 1.3) * np.std(lg, ddof=1) * np.sqrt(1 + 1 / n) * fator
                    lo, hi = np.exp(lg.mean() - meia), min(1.0, np.exp(lg.mean() + meia))
                    cob.append(lo <= alvo_final <= hi)
                    lar.append(hi - lo)
            saida.append((fator, n, round(float(np.mean(cob)), 2), round(float(np.mean(lar)), 2)))
    return saida


def main(argv: list[str]) -> int:
    tentativas = int(argv[1]) if len(argv) > 1 else 3000
    rng = np.random.default_rng(2026)
    linhas = []
    for n in QUANTOS:
        for d in PONTOS:
            r = [uma_tentativa(rng, n, d) for _ in range(tentativas)]
            m = {k: float(np.nanmean([x[k] for x in r])) for k in r[0]}
            linhas.append({"parecidos": n, "dias": d, **{k: round(v, 3) for k, v in m.items()}})
    with (Path(__file__).parent / "ritmo.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0])); w.writeheader(); w.writerows(linhas)
    for l in linhas:
        print(l)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
