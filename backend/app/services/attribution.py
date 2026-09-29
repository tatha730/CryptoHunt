from collections import defaultdict
from app.data.vasp_registry import get_vasp_by_address

def build_adjacency_graph(graph):
    adjacency=defaultdict(list)
    for edge in graph.get("edges",[]):
        a=edge["source"]; b=edge["target"]
        adjacency[a].append({"wallet":b,"edge":edge,"direction":"outgoing"})
        adjacency[b].append({"wallet":a,"edge":edge,"direction":"incoming"})
    return adjacency

def find_vasp_paths(graph,target_address,max_hops=3):
    target_address=target_address.lower(); adjacency=build_adjacency_graph(graph); paths=[]; visited={target_address}
    def dfs(cur,path,depth):
        if depth>max_hops: return
        vasp=get_vasp_by_address(cur)
        if vasp and cur!=target_address:
            paths.append({"vasp":vasp,"path":path.copy(),"hops":len(path)-1}); return
        for c in adjacency.get(cur,[]):
            nxt=c["wallet"]
            if nxt in visited: continue
            visited.add(nxt); path.append({"wallet":nxt,"edge":c["edge"]})
            dfs(nxt,path,depth+1)
            path.pop(); visited.remove(nxt)
    dfs(target_address,[{"wallet":target_address,"edge":None}],0)
    return paths

def calculate_attribution_score(result):
    hops=result["hops"]; score=100
    if hops==1: score-=5
    elif hops==2: score-=12
    elif hops==3: score-=25
    else: score-=40
    edges=[x["edge"] for x in result["path"] if x.get("edge")]
    unique=len({e.get("tx_hash") for e in edges if e.get("tx_hash")})
    if unique>=5: score+=5
    elif unique>=2: score+=3
    assets={e.get("asset") for e in edges if e.get("asset")}
    if len(assets)>=2: score+=4
    if result["vasp"].get("verified"): score+=5
    return max(0,min(score,99))

def generate_evidence(result,score):
    v=result["vasp"]; edges=[x["edge"] for x in result["path"] if x.get("edge")]
    unique=len({e.get("tx_hash") for e in edges if e.get("tx_hash")})
    assets=sorted({e.get("asset") for e in edges if e.get("asset")})
    evidence=[
        f"Transaction path reaches a known {v['category']} endpoint.",
        f"VASP-associated endpoint: {v['vasp']}.",
        f"Path distance: {result['hops']} hop(s).",
        f"{unique} transaction relationship(s) observed along the path.",
    ]
    if assets: evidence.append(f"Asset(s) involved: {', '.join(assets)}.")
    if v.get("verified"): evidence.append("Endpoint is marked as verified in the prototype registry.")
    evidence.append("This result indicates transaction-path association, not confirmed wallet ownership or customer identity.")
    return evidence

def rank_vasp_candidates(graph,target_address,max_hops=3):
    results=find_vasp_paths(graph,target_address,max_hops)
    out=[]
    for r in results:
        score=calculate_attribution_score(r)
        out.append({"vasp":r["vasp"]["vasp"],"category":r["vasp"]["category"],"endpoint":r["vasp"]["address"],"label":r["vasp"]["label"],"confidence":score,"hops":r["hops"],"path":r["path"],"evidence":generate_evidence(r,score)})
    return sorted(out,key=lambda x:x["confidence"],reverse=True)
