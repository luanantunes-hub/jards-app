"""Monta o sprite das duas onças: tira os pontinhos soltos, mede onde cada corda entra e sai do
quadro, desenha mais corda para cima (até o topo da página) e para baixo (com um nó na ponta),
e salva os quadros prontos. Nada aqui usa serviço externo."""
import glob
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ARQS = sorted(f for f in glob.glob("k[0-9][0-9][0-9].png"))
N = len(ARQS)
H0, W0 = 542, 720            # as duas últimas fileiras do vídeo têm uma linha solta: ficam de fora
U, D = 330, 240            # corda a mais: para cima e para baixo (px do vídeo)
SUP = 8                    # super-amostragem horizontal da corda

# o perfil real de uma corda (7 colunas): linha escura, miolo creme, linha escura
PERFIL = np.array([(100, 94, 89), (35, 27, 20), (225, 206, 178), (245, 228, 200), (248, 238, 215), (120, 110, 92), (40, 36, 26)], np.float32)


def limpa(a):
    """Tira os pontinhos soltos do recorte (poeira do papel)."""
    mascara = a[..., 3] > 40
    rot, n = ndi.label(mascara)
    tam = np.bincount(rot.ravel())
    ruim = np.isin(rot, [i for i in range(1, n + 1) if tam[i] < 160])
    a = a.copy()
    a[ruim] = 0
    return a


def grupos(alfa, y0, y1, lim=110):
    col = (alfa[y0:y1] > lim).mean(axis=0) > 0.5
    out, g = [], []
    for c in np.where(col)[0]:
        if g and c - g[-1] > 4:
            out.append((g[0], g[-1])); g = []
        g.append(c)
    if g:
        out.append((g[0], g[-1]))
    return [(x0, x1, (x0 + x1) / 2) for x0, x1 in out if x1 - x0 <= 14]


def escolhe(gs, ref, maxd=42):
    gs = [g for g in gs if abs(g[2] - ref) <= maxd]
    return min(gs, key=lambda g: abs(g[2] - ref))[2] if gs else None


def acompanha(alfas, ys, inicial):
    """Posição (x) de cada corda em cada quadro, nas linhas ys, seguindo a anterior."""
    res = np.zeros((N, 2))
    ref = list(inicial)
    for i, a in enumerate(alfas):
        gs = grupos(a, ys[0], ys[1])
        for k in (0, 1):
            x = escolhe(gs, ref[k])
            if x is not None:
                ref[k] = x
            res[i, k] = ref[k]
    return res


def inclinacao(alfas, centros, borda, sinal, linhas=(0, 5, 10, 15, 20, 25)):
    """Inclinação (px de x por px de y) da corda perto da borda do quadro, quadro a quadro."""
    s = np.full((N, 2), np.nan)
    for i, a in enumerate(alfas):
        for k in (0, 1):
            xs, yy = [], []
            ref = centros[i, k]
            for d in linhas:
                y = borda + sinal * d
                gs = grupos(a, y, y + 1)
                x = escolhe(gs, ref, maxd=7)
                if x is not None:
                    xs.append(x); yy.append(d); ref = x
            if len(xs) >= 4:
                s[i, k] = np.polyfit(yy, xs, 1)[0] * sinal   # dx/dy: no fundo, d cresce para cima, então o sinal inverte
    for k in (0, 1):
        v = s[:, k]
        ok = ~np.isnan(v)
        v = np.interp(np.arange(N), np.where(ok)[0], v[ok]) if ok.sum() >= 3 else np.zeros(N)
        v = np.clip(v, -0.22, 0.22)
        ker = np.ones(9) / 9
        pad = np.r_[v[-4:], v, v[:4]]            # o vídeo é um laço
        s[:, k] = np.convolve(pad, ker, "valid")
    return s


def desenha_corda(rgba, y, xc):
    """Uma linha da corda, centrada em xc (fração de pixel), com suavização lateral."""
    x0 = int(np.floor(xc - 5))
    for px in range(x0, x0 + 11):
        if not (0 <= px < rgba.shape[1]):
            continue
        acc, cov = np.zeros(3), 0.0
        for k in range(SUP):
            idx = (px + (k + 0.5) / SUP - xc) + 3.5
            if 0 <= idx < 7:
                acc += PERFIL[int(idx)]; cov += 1
        if cov:
            rgba[y, px] = np.r_[acc / cov, 255 * cov / SUP]


def no(rgba, y, x, r=4.6):
    """O nó na ponta da corda: uma bolinha escura com um miolo creme."""
    for yy in range(int(y - r - 1), int(y + r + 2)):
        for xx in range(int(x - r - 1), int(x + r + 2)):
            if not (0 <= yy < rgba.shape[0] and 0 <= xx < rgba.shape[1]):
                continue
            d = np.hypot(xx - x, yy - y)
            a = np.clip(r + 0.5 - d, 0, 1)
            if a <= 0:
                continue
            cor = np.array([205, 188, 160]) if d < r - 2.2 else np.array([38, 30, 22])
            rgba[yy, xx] = np.r_[cor, 255 * a]


def main():
    quadros = [limpa(np.asarray(Image.open(f))[:H0]) for f in ARQS]
    alfas = [q[..., 3] for q in quadros]
    topo = acompanha(alfas, (0, 4), (255, 409))
    fundo = acompanha(alfas, (H0 - 5, H0), (311, 470))
    s_in = inclinacao(alfas, topo, 0, +1)             # d cresce para baixo
    s_out = inclinacao(alfas, fundo, H0 - 1, -1)      # d cresce para cima
    ancora = np.median(topo, axis=0)                  # onde as cordas "prendem" lá em cima
    print("âncora das cordas:", ancora.round(1), "| inclinação no topo (média):", s_in.mean(0).round(3))

    altura = U + H0 + D
    saida = []
    for i, q in enumerate(quadros):
        tela = np.zeros((altura, W0, 4), np.float32)
        tela[U:U + H0] = q
        for k in (0, 1):
            # para cima: curva suave do topo do quadro até a âncora, a U px de altura
            xt, si = topo[i, k], s_in[i, k]
            c = (ancora[k] - xt + si * U) / (U * U)
            for j in range(1, U + 1):
                y = -j
                xc = xt + si * y + c * y * y
                desenha_corda(tela, U - j, xc)
            # para baixo: segue a inclinação do fundo e vai ficando vertical, até um nó
            xb, so = fundo[i, k], s_out[i, k]
            for j in range(1, D + 1):
                xc = xb + so * j - so * j * j / (2 * D)
                desenha_corda(tela, U + H0 - 1 + j, xc)
            no(tela, U + H0 - 1 + D, xb + so * D / 2)
        saida.append(tela.astype(np.uint8))
    np.save("sprite.npy", np.stack(saida))
    print("sprite:", np.stack(saida).shape)


if __name__ == "__main__":
    main()
