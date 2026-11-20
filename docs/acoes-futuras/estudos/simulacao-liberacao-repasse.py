import random, math, statistics
B=50.0; FMAX=0.30; CAP=10000.0
def pi(n,i): return (1+i)/(20+n)
def taxa(f,n,i):
    p=pi(n,i); return max(p+0.01,(p/0.05)*(0.03+3*f*f))
def fmax(n,i,v):
    return min(FMAX, B/pi(n,i)/v, CAP/v)
print("novo (π=5%)  pega % das vendas -> taxa")
for f in (.05,.10,.15,.20,.25,.30): print(f"  {f*100:4.0f}% -> {taxa(f,0,0)*100:5.1f}%")
print("20 eventos limpos (π=2,5%)")
for f in (.10,.20,.30): print(f"  {f*100:4.0f}% -> {taxa(f,20,0)*100:5.1f}%")
print("1 evento com 1 incidente (π=9,5%)")
for f in (.10,.20,.30): print(f"  {f*100:4.0f}% -> {taxa(f,1,1)*100:5.1f}%")
def rodar(seed,mix,P=200,E=10,ruim_pega_max=True):
    r=random.Random(seed); fee=loss=0
    for _ in range(P):
        u=r.random();acc=0
        for w,p in mix:
            acc+=w
            if u<=acc: pt=p;break
        n=i=0
        for e in range(E):
            v=r.lognormvariate(math.log(15000),0.8)
            fm=fmax(n,i,v)
            want = fm if (pt>=.25 and ruim_pega_max) else min(fm,r.choice([.10,.20,.30]))
            rel=want*v; fee+=rel*taxa(want,n,i)
            if r.random()<pt: loss+=rel; i+=1
            n+=1
    return fee,loss
for nome,mix in (("base",((.80,.01),(.15,.05),(.05,.25))),("20% ruins",((.60,.01),(.20,.05),(.20,.25)))):
    res=[rodar(s,mix) for s in range(200)]
    liq=[f-l for f,l in res]
    print(nome,"| taxa R$",round(statistics.mean(f for f,_ in res)),"| perda R$",round(statistics.mean(l for _,l in res)),"| resultado",round(statistics.mean(liq)),"| pior",round(min(liq)),"| rodadas negativas %",round(100*sum(x<0 for x in liq)/len(liq)))
