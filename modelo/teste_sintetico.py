"""Prova do modelo com dados inventados: roda `python modelo/teste_sintetico.py`. Sai com erro (código 1) se o modelo não recuperar a resposta certa."""
from __future__ import annotations

import sys

from dados_sinteticos import gerar
from mmm import SemDadosSuficientes, ajustar

TOLERANCIA_EM_PONTOS = 12.0  # o porcento estimado de cada canal pode errar até isto, em pontos percentuais, em relação ao verdadeiro


def main() -> int:
    falhas: list[str] = []
    tabela, verdade = gerar(semanas=90, semente=7)
    r = ajustar(tabela)
    print("diagnósticos:", r["diagnosticos"])
    print("verdade:", {k: round(v, 1) for k, v in verdade.items()})
    print("base estimada:", r["base"])
    for c in r["canais"]:
        v = verdade[c["canal"]]
        print(f"{c['canal']}: estimado {c['porcento']}% [{c['baixo']}-{c['alto']}] verdade {v:.1f}%  custo/ingresso {c['custo_por_ingresso_centavos']}  saturação {c['saturacao_gasto_centavos']}")
        if abs(c["porcento"] - v) > TOLERANCIA_EM_PONTOS:
            falhas.append(f"{c['canal']}: estimado {c['porcento']}% longe do verdadeiro {v:.1f}%")
        # A cobertura do intervalo é só informação (o modelo costuma ser otimista: a tela avisa); o que barra é o erro grande, a ordem errada e o ajuste que não convergiu.
        dentro = c["baixo"] <= v <= c["alto"]
        print(f"   o verdadeiro {'está' if dentro else 'NÃO está'} dentro do intervalo de 80%")
        if len(c["curva"]) < 5 or c["curva"][0]["gasto_centavos"] != 0:
            falhas.append(f"{c['canal']}: curva de resposta inválida")
    if r["diagnosticos"]["r_hat_maximo"] > 1.05:
        falhas.append(f"não convergiu: r-hat {r['diagnosticos']['r_hat_maximo']}")
    ordem = sorted(r["canais"], key=lambda c: -c["porcento"])
    if [c["canal"] for c in ordem][0] != "meta-ads":
        falhas.append("o canal que mais vende (meta-ads) não saiu em primeiro")

    # Pouco dado: 30 semanas devem funcionar mas com intervalos mais largos que com 90.
    tabela_curta, _ = gerar(semanas=30, semente=7)
    curta = ajustar(tabela_curta, draws=400, tune=400)
    largura_curta = sum(c["alto"] - c["baixo"] for c in curta["canais"])
    largura_longa = sum(c["alto"] - c["baixo"] for c in r["canais"])
    print(f"largura dos intervalos: 30 semanas {largura_curta:.1f} x 90 semanas {largura_longa:.1f}")
    if largura_curta <= largura_longa:
        falhas.append("com menos semanas os intervalos deviam ficar mais largos")

    # O gasto embaralhado (sem relação com as vendas): o modelo não pode inventar efeito grande.
    embaralhado = ajustar(gerar(semanas=90, semente=7, embaralhar_gasto=True)[0], draws=500, tune=500)
    soma_embaralhada = sum(c["porcento"] for c in embaralhado["canais"])
    print(f"gasto embaralhado: soma dos canais {soma_embaralhada:.1f}% (com o gasto certo: {sum(c['porcento'] for c in r['canais']):.1f}%)")
    if soma_embaralhada > 0.6 * sum(c["porcento"] for c in r["canais"]):
        falhas.append("com o gasto embaralhado o modelo ainda atribuiu muito aos canais")

    # Tabela sem dado suficiente: tem de recusar com uma frase, não quebrar.
    try:
        ajustar(gerar(semanas=10)[0])
        falhas.append("10 semanas deviam ser recusadas")
    except SemDadosSuficientes as e:
        print("recusou (certo):", e)

    if falhas:
        print("FALHOU:", *falhas, sep="\n- ")
        return 1
    print("OK: o modelo recuperou o efeito de cada canal dentro da tolerância.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
