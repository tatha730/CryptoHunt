from collections import defaultdict
def normalize_address(address):
    return (address or "").lower()

def build_transaction_graph(target_address, transactions, token_transfers):
    target_address=normalize_address(target_address)
    nodes={target_address:{"id":target_address,"type":"target_wallet"}}
    edges=[]
    for tx in transactions:
        a=normalize_address(getattr(tx,"from_address",None)); b=normalize_address(getattr(tx,"to_address",None))
        if not a or not b: continue
        nodes.setdefault(a,{"id":a,"type":"wallet"}); nodes.setdefault(b,{"id":b,"type":"wallet"})
        edges.append({"id":f"eth_{tx.hash}","source":a,"target":b,"asset":"ETH","amount":str(tx.value_wei),"amount_unit":"wei","tx_hash":tx.hash,"block_number":tx.block_number,"timestamp":tx.timestamp,"transaction_type":"ETH"})
    for tx in token_transfers:
        a=normalize_address(getattr(tx,"from_address",None)); b=normalize_address(getattr(tx,"to_address",None))
        if not a or not b: continue
        nodes.setdefault(a,{"id":a,"type":"wallet"}); nodes.setdefault(b,{"id":b,"type":"wallet"})
        edges.append({"id":f"erc20_{tx.hash}_{tx.token_contract}","source":a,"target":b,"asset":tx.token_symbol,"amount":tx.token_value,"amount_unit":tx.token_decimals,"token_contract":tx.token_contract,"tx_hash":tx.hash,"block_number":tx.block_number,"timestamp":tx.timestamp,"transaction_type":"ERC20"})
    stats=defaultdict(lambda:{"incoming_count":0,"outgoing_count":0,"total_transactions":0})
    for e in edges:
        stats[e["source"]]["outgoing_count"]+=1; stats[e["target"]]["incoming_count"]+=1
    for a in stats: stats[a]["total_transactions"]=stats[a]["incoming_count"]+stats[a]["outgoing_count"]
    final_nodes=[{**node,**stats.get(a,{"incoming_count":0,"outgoing_count":0,"total_transactions":0})} for a,node in nodes.items()]
    return {"target_address":target_address,"node_count":len(final_nodes),"edge_count":len(edges),"nodes":final_nodes,"edges":edges}

def aggregate_graph_edges(graph):
    aggregated={}
    for e in graph["edges"]:
        key=(e["source"],e["target"],e["asset"])
        item=aggregated.setdefault(key,{"source":e["source"],"target":e["target"],"asset":e["asset"],"transaction_count":0,"transaction_hashes":[],"first_timestamp":e["timestamp"],"last_timestamp":e["timestamp"]})
        item["transaction_count"]+=1; item["transaction_hashes"].append(e["tx_hash"])
        item["first_timestamp"]=min(item["first_timestamp"],e["timestamp"]); item["last_timestamp"]=max(item["last_timestamp"],e["timestamp"])
    return list(aggregated.values())
