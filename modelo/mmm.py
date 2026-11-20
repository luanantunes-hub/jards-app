"""O ajuste do modelo de marketing (MMM) de uma loja: da tabela semanal ao resultado no formato que o Jards confere (lib/ticketeria/modelo-resultado.ts).

Entrada: a tabela semanal que o Jards monta (uma linha por semana: ingressos vendidos e gasto por canal, em centavos).
Saída: contribuição de cada canal em % das vendas (com intervalo de 80%), o que venderia de qualquer jeito, custo por ingresso, a curva de resposta e os diagnósticos.

O que o modelo faz: cada canal tem um efeito que demora a aparecer (adstock geométrico) e que rende cada vez menos (saturação logística); o resto das vendas é uma base com tendência e
sazonalidade anual. Além do gasto, entram CONTROLES (o que também empurra as vendas: proximidade da sessão, feriados, viradas de lote, preço, cupons, visitas sem anúncio): os dois
primeiros sempre, os outros só com SEMANAS_DOS_CONTROLES_EXTRAS semanas ou mais (a mesma regra de lib/ticketeria/modelo-controles.ts), e só os que variam. Só entram canais com gasto em
pelo menos MIN_SEMANAS_POR_CANAL semanas; o efeito dos demais fica na base. A base ("venderia de qualquer jeito") sai dividida em partes: nível da loja, tendência e época do ano e cada controle. É uma ESTIMATIVA: o intervalo diz o quanto ela ainda pode errar.
"""
from __future__ import annotations

import math
import warnings
from typing import Any

import numpy as np
import pandas as pd

MIN_SEMANAS_POR_CANAL = 8
MIN_SEMANAS_DO_MODELO = 26
SEMANAS_PARA_SAZONALIDADE_ANUAL = 52
VARIACAO_MINIMA = 0.25
PONTOS_DA_CURVA = 16
SEMENTE = 42
SEMANAS_DOS_CONTROLES_EXTRAS = 52
# Os controles de cada grupo (as chaves da coluna `controles` da tabela semanal) e o nome da parte que aparece no resultado. `extra`: só entra com SEMANAS_DOS_CONTROLES_EXTRAS semanas.
GRUPOS_DE_CONTROLE = [
    {"parte": "proximidade", "chaves": ["proximidade"], "extra": False},
    {"parte": "feriado", "chaves": ["feriado"], "extra": False},
    {"parte": "preco_e_lotes", "chaves": ["lote", "preco"], "extra": True},
    {"parte": "cupom", "chaves": ["cupom"], "extra": True},
    {"parte": "visitas", "chaves": ["visitas"], "extra": True},
]


class SemDadosSuficientes(Exception):
    """A tabela não dá para ajustar o modelo (poucas semanas, nenhum canal com gasto suficiente)."""


def escolher_controles(ordenadas: list[dict[str, Any]]) -> list[str]:
    """Os controles que entram: os dois primeiros sempre, o resto com SEMANAS_DOS_CONTROLES_EXTRAS semanas ou mais, e só os que variam (coluna constante não ensina nada ao modelo)."""
    extras = len(ordenadas) >= SEMANAS_DOS_CONTROLES_EXTRAS
    escolhidos: list[str] = []
    for grupo in GRUPOS_DE_CONTROLE:
        if grupo["extra"] and not extras:
            continue
        for chave in grupo["chaves"]:
            valores = {round(float((s.get("controles") or {}).get(chave, 0.0)), 6) for s in ordenadas}
            if len(valores) >= 2:
                escolhidos.append(chave)
    return escolhidos


def montar_entrada(semanas: list[dict[str, Any]]) -> tuple[pd.DataFrame, pd.Series, list[str], dict[str, dict[str, float]], list[str]]:
    """DataFrame de entrada do MMM (gasto em reais), o alvo (ingressos), os canais que entram, um resumo de cada um (gasto total em centavos, variação) e os controles escolhidos."""
    if len(semanas) < MIN_SEMANAS_DO_MODELO:
        raise SemDadosSuficientes(f"Só há {len(semanas)} semanas; o modelo precisa de pelo menos {MIN_SEMANAS_DO_MODELO}.")
    ordenadas = sorted(semanas, key=lambda s: s["semana"])
    datas = pd.to_datetime([s["semana"] for s in ordenadas])
    canais_todos = sorted({c for s in ordenadas for c in (s.get("gasto") or {})})
    gasto = {c: np.array([float((s.get("gasto") or {}).get(c, 0)) for s in ordenadas]) for c in canais_todos}
    resumo: dict[str, dict[str, float]] = {}
    canais: list[str] = []
    for c in canais_todos:
        g = gasto[c]
        com_gasto = np.flatnonzero(g > 0)
        if len(com_gasto) < MIN_SEMANAS_POR_CANAL:
            continue
        janela = g[com_gasto[0] : com_gasto[-1] + 1]
        media = float(janela.mean())
        variacao = float(janela.std() / media) if media > 0 else 0.0
        resumo[c] = {"gasto_total_centavos": float(g.sum()), "variacao": variacao}
        canais.append(c)
    if not canais:
        raise SemDadosSuficientes(f"Nenhum canal tem gasto em pelo menos {MIN_SEMANAS_POR_CANAL} semanas.")
    controles = escolher_controles(ordenadas)
    colunas_de_controle = {c: np.array([float((s.get("controles") or {}).get(c, 0.0)) for s in ordenadas]) for c in controles}
    x = pd.DataFrame({"date_week": datas, **{c: gasto[c] / 100.0 for c in canais}, "t": np.arange(len(ordenadas)) / len(ordenadas), **colunas_de_controle})
    y = pd.Series([float(s["ingressos"]) for s in ordenadas], name="y")
    if float(y.sum()) <= 0:
        raise SemDadosSuficientes("Não há ingressos vendidos nas semanas da tabela.")
    return x, y, canais, resumo, controles


def _quantis(valores: np.ndarray) -> tuple[float, float, float]:
    baixo, meio, alto = np.percentile(valores, [10, 50, 90])
    return float(baixo), float(meio), float(alto)


def _limitar(v: float) -> float:
    return float(min(100.0, max(0.0, v)))


def _ponto_de_saturacao(gastos: list[float], ingressos: list[float]) -> float | None:
    """O gasto semanal a partir do qual cada real a mais rende menos de 25% do que rendia no começo (None se nunca chega lá no trecho da curva)."""
    if len(gastos) < 3 or gastos[1] <= gastos[0]:
        return None
    inclinacao_inicial = (ingressos[1] - ingressos[0]) / (gastos[1] - gastos[0])
    if inclinacao_inicial <= 0:
        return None
    for i in range(2, len(gastos)):
        if gastos[i] <= gastos[i - 1]:
            continue
        if (ingressos[i] - ingressos[i - 1]) / (gastos[i] - gastos[i - 1]) < 0.25 * inclinacao_inicial:
            return gastos[i - 1]
    return None


def _partes_da_base(posterior: Any, escala_do_alvo: float, total_y: float, n: int, base: Any, controles: list[str]) -> list[dict[str, Any]]:
    """A base ("venderia de qualquer jeito") dividida em partes, em % das vendas, por amostra do modelo (assim o intervalo de cada parte é honesto): a tendência e a época do ano, cada grupo de
    controles (a soma dos controles do grupo) e o nível da loja, que é o que sobra para a conta fechar na base. Pode haver parte negativa (o preço alto segura a venda)."""
    def em_porcento(x: Any) -> Any:
        return x * escala_do_alvo / total_y * 100.0

    por_controle = em_porcento(posterior["control_contribution"].sum("date"))  # chain, draw, control
    partes_brutas: dict[str, Any] = {}
    tendencia = por_controle.sel(control="t")
    if "yearly_seasonality_contribution" in posterior:
        tendencia = tendencia + em_porcento(posterior["yearly_seasonality_contribution"].sum("date"))
    partes_brutas["tendencia"] = tendencia
    for grupo in GRUPOS_DE_CONTROLE:
        usados = [c for c in grupo["chaves"] if c in controles]
        if usados:
            partes_brutas[grupo["parte"]] = sum(por_controle.sel(control=c) for c in usados)
    partes_brutas["nivel"] = base - sum(partes_brutas.values())  # o resto: o nível normal da loja (e o que o modelo não explica)
    ordem = ["nivel", "tendencia", *[g["parte"] for g in GRUPOS_DE_CONTROLE]]
    saida: list[dict[str, Any]] = []
    for chave in ordem:
        if chave not in partes_brutas:
            continue
        baixo, meio, alto = _quantis(np.asarray(partes_brutas[chave]).ravel())
        saida.append({"chave": chave, "porcento": round(max(-100.0, min(100.0, meio)), 2), "baixo": round(max(-100.0, min(100.0, baixo)), 2), "alto": round(max(-100.0, min(100.0, alto)), 2)})
    return saida


def ajustar(semanas: list[dict[str, Any]], *, semente: int = SEMENTE, draws: int = 800, tune: int = 800, chains: int = 4) -> dict[str, Any]:
    """Ajusta o modelo e devolve o resultado no formato do Jards. Levanta SemDadosSuficientes quando a tabela não serve."""
    import arviz as az
    import pymc_marketing
    from pymc_marketing.mmm import MMM, GeometricAdstock, LogisticSaturation

    x, y, canais, resumo, controles = montar_entrada(semanas)
    n = len(y)
    mmm = MMM(
        date_column="date_week", channel_columns=canais, control_columns=["t", *controles],
        adstock=GeometricAdstock(l_max=6), saturation=LogisticSaturation(),
        yearly_seasonality=2 if n >= SEMANAS_PARA_SAZONALIDADE_ANUAL else None,
    )
    mmm.fit(x, y, random_seed=semente, sample_kwargs={"nuts_sampler": "nutpie", "chains": chains, "draws": draws, "tune": tune, "target_accept": 0.9, "progressbar": False})

    posterior = mmm.idata["posterior"]
    escala_do_alvo = float(mmm.get_scales_as_xarray()["target_scale"])
    total_y = float(y.sum())
    # A contribuição vem em escala interna: vezes a escala do alvo, é em ingressos. Soma no tempo = ingressos atribuídos ao canal, por amostra do modelo.
    por_canal = (posterior["channel_contribution"] * escala_do_alvo).sum("date")  # chain, draw, channel
    porcentos = por_canal / total_y * 100.0
    base = 100.0 - porcentos.sum("channel")
    ingressos_mediana = por_canal.median(("chain", "draw"))
    escala_dos_canais = mmm.get_scales_as_xarray()["channel_scale"]

    curva_bruta = mmm.sample_saturation_curve(max_value=1.5, num_points=PONTOS_DA_CURVA, num_samples=200, random_state=semente, original_scale=True)
    curva_mediana = curva_bruta.median([d for d in curva_bruta.dims if d not in ("x", "channel")])

    resultado_canais: list[dict[str, Any]] = []
    for canal in canais:
        baixo, meio, alto = _quantis(np.asarray(porcentos.sel(channel=canal)).ravel())
        ingressos = float(ingressos_mediana.sel(channel=canal))
        gasto_centavos = int(round(resumo[canal]["gasto_total_centavos"]))
        escala = float(escala_dos_canais.sel(channel=canal))
        xs = np.asarray(curva_mediana.coords["x"]) * escala * 100.0  # gasto semanal em centavos
        ys = np.asarray(curva_mediana.sel(channel=canal))
        pontos = [{"gasto_centavos": int(round(g)), "ingressos": round(float(v), 2)} for g, v in zip(xs, ys)]
        saturacao = _ponto_de_saturacao([float(g) for g in xs], [float(v) for v in ys])
        resultado_canais.append({
            "canal": canal, "porcento": round(_limitar(meio), 2), "baixo": round(_limitar(baixo), 2), "alto": round(_limitar(alto), 2),
            "ingressos": max(0, int(round(ingressos))), "gasto_centavos": gasto_centavos,
            "custo_por_ingresso_centavos": int(round(gasto_centavos / ingressos)) if gasto_centavos > 0 and ingressos >= 1 else None,
            "saturacao_gasto_centavos": int(round(saturacao)) if saturacao is not None else None,
            "gasto_constante": resumo[canal]["variacao"] < VARIACAO_MINIMA, "curva": pontos,
        })

    b_baixo, b_meio, b_alto = _quantis(np.asarray(base).ravel())
    partes = _partes_da_base(posterior, escala_do_alvo, total_y, n, base, controles)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # parâmetros constantes (variância zero) geram avisos de divisão; os diagnósticos ignoram esses valores
        resumo_az = az.summary(posterior.to_dataset())
    r_hat = float(np.nanmax(resumo_az["r_hat"])) if "r_hat" in resumo_az else math.nan
    ess = float(np.nanmin(resumo_az["ess_bulk"])) if "ess_bulk" in resumo_az else math.nan
    divergencias = int(mmm.idata["sample_stats"]["diverging"].sum())
    return {
        "motor": "pymc-marketing", "versao_motor": str(pymc_marketing.__version__), "semanas": n,
        "diagnosticos": {"r_hat_maximo": round(r_hat if math.isfinite(r_hat) else 99.0, 4), "divergencias": divergencias, "ess_minimo": int(ess) if math.isfinite(ess) else 0},
        "base": {"porcento": round(_limitar(b_meio), 2), "baixo": round(_limitar(b_baixo), 2), "alto": round(_limitar(b_alto), 2), "partes": partes},
        "canais": resultado_canais,
    }
