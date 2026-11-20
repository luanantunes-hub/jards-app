"""Dados inventados em que a resposta certa é conhecida: serve para provar que o modelo recupera o efeito de cada canal (e que avisa quando não consegue)."""
from __future__ import annotations

import numpy as np

# O efeito verdadeiro de cada canal: tamanho máximo (ingressos por semana), velocidade do atraso (adstock) e da saturação.
VERDADE = {
    "meta-ads": {"beta": 60.0, "adstock": 0.5, "escala": 300.0, "lam": 2.0},
    "google-ads": {"beta": 25.0, "adstock": 0.3, "escala": 120.0, "lam": 2.5},
    "instagram": {"beta": 18.0, "adstock": 0.4, "escala": 150.0, "lam": 1.5},
}


def _adstock(x: np.ndarray, a: float) -> np.ndarray:
    saida, acumulado = np.zeros_like(x), 0.0
    for i, v in enumerate(x):
        acumulado = v + a * acumulado
        saida[i] = acumulado
    return saida


def gerar(semanas: int = 90, semente: int = 7, embaralhar_gasto: bool = False, gasto_constante: bool = False) -> tuple[list[dict], dict[str, float]]:
    """Devolve a tabela semanal (no formato do Jards, centavos) e a parte verdadeira de cada canal nas vendas, em % (mais a base)."""
    rng = np.random.default_rng(semente)
    n = semanas
    t = np.arange(n)

    def gasto(base: float, amp: float, periodo: float) -> np.ndarray:
        if gasto_constante:
            return np.full(n, base)
        return np.clip(base + amp * np.sin(t * 2 * np.pi / periodo) + rng.normal(0, amp * 0.3, n), 0, None)

    gastos = {"meta-ads": gasto(150, 120, 11), "google-ads": gasto(60, 50, 7)}
    gastos["instagram"] = np.full(n, 40.0) if gasto_constante else np.where(rng.random(n) < 0.5, rng.uniform(20, 80, n), 0.0)
    contribuicoes = {c: v["beta"] * (1 - np.exp(-v["lam"] * _adstock(gastos[c], v["adstock"]) / v["escala"])) for c, v in VERDADE.items()}
    base = 40 + 0.05 * t + 6 * np.sin(t * 2 * np.pi / 52)
    y = base + sum(contribuicoes.values()) + rng.normal(0, 3, n)
    total = float(y.sum())
    verdade = {c: float(v.sum()) / total * 100 for c, v in contribuicoes.items()}
    verdade["base"] = float((y - sum(contribuicoes.values())).sum()) / total * 100
    mostrados = {c: g.copy() for c, g in gastos.items()}
    if embaralhar_gasto:
        for g in mostrados.values():
            rng.shuffle(g)
    datas = np.datetime64("2025-01-06") + t * np.timedelta64(7, "D")
    tabela = [
        {"semana": str(datas[i]), "ingressos": max(0, int(round(y[i]))), "gasto": {c: int(round(mostrados[c][i] * 100)) for c in mostrados if mostrados[c][i] > 0}}
        for i in range(n)
    ]
    return tabela, verdade
