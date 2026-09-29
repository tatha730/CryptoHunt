import re
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.services.ethereum import get_transactions,get_token_transfers
from app.services.graph import build_transaction_graph,aggregate_graph_edges
from app.services.attribution import rank_vasp_candidates
from app.services.demo import build_controlled_demo_graph,build_demo_notice
from app.schemas import Transaction,TokenTransfer

app=FastAPI(title="ChainTrace API",description="Blockchain wallet attribution prototype",version="0.6.0")
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])

class WalletAnalysisRequest(BaseModel):
    address:str
    chain:str="ethereum"
    demo_mode:bool=False

@app.get("/")
def root(): return {"name":"ChainTrace API","status":"online","version":"0.6.0"}
@app.get("/health")
def health(): return {"status":"healthy"}

@app.post("/api/v1/analyze")
def analyze_wallet(request:WalletAnalysisRequest):
    chain=request.chain.lower().strip()
    if chain!="ethereum": raise HTTPException(status_code=400,detail="Currently only Ethereum is supported.")
    address=request.address.strip()
    if not re.fullmatch(r"^0x[a-fA-F0-9]{40}$",address):
        raise HTTPException(status_code=400,detail="Invalid Ethereum address. Expected 0x followed by exactly 40 hexadecimal characters.")

    # Controlled demonstration: use the real attribution algorithm against a simulated,
    # deterministic graph containing a registry endpoint.
    if request.demo_mode:
        demo_graph=build_controlled_demo_graph(address)
        candidates=rank_vasp_candidates(demo_graph,address,max_hops=3)
        return {
            "address":address,"chain":"ethereum","transaction_count":3,"token_transfer_count":1,
            "transactions":[],"token_transfers":[],"graph":demo_graph,
            "aggregated_graph":{"target_address":address.lower(),"node_count":demo_graph["node_count"],"relationship_count":3,"relationships":demo_graph["edges"]},
            "vasp_attribution":{"candidate_count":len(candidates),"candidates":candidates},
            "demo_attribution":{"demo_mode":True,"notice":build_demo_notice(),"candidates":candidates},
        }

    try: raw_transactions=get_transactions(address)
    except requests.RequestException as e: raise HTTPException(status_code=502,detail=f"Etherscan request failed: {str(e)}")
    except RuntimeError as e: raise HTTPException(status_code=502,detail=str(e))
    except Exception as e: raise HTTPException(status_code=500,detail=f"Unexpected blockchain error: {str(e)}")

    transactions=[]
    for tx in raw_transactions:
        try:
            transactions.append(Transaction(hash=tx["hash"],from_address=tx["from"],to_address=tx.get("to"),value_wei=int(tx.get("value",0)),block_number=int(tx["blockNumber"]),timestamp=int(tx["timeStamp"]),is_error=tx.get("isError","0")=="1",transaction_type="ETH"))
        except (KeyError,ValueError,TypeError): pass

    try: raw_token=get_token_transfers(address)
    except requests.RequestException as e: raise HTTPException(status_code=502,detail=f"Etherscan token API request failed: {str(e)}")
    except RuntimeError as e: raise HTTPException(status_code=502,detail=str(e))
    except Exception as e: raise HTTPException(status_code=500,detail=f"Unexpected token API error: {str(e)}")

    tokens=[]
    for tx in raw_token:
        try:
            tokens.append(TokenTransfer(hash=tx["hash"],from_address=tx["from"],to_address=tx.get("to"),token_contract=tx["contractAddress"],token_name=tx.get("tokenName","Unknown"),token_symbol=tx.get("tokenSymbol","UNKNOWN"),token_decimals=int(tx.get("tokenDecimal",18)),token_value=tx.get("value","0"),block_number=int(tx["blockNumber"]),timestamp=int(tx["timeStamp"]),transaction_type="ERC20"))
        except (KeyError,ValueError,TypeError): pass

    graph=build_transaction_graph(address,transactions,tokens)
    aggregated=aggregate_graph_edges(graph)
    candidates=rank_vasp_candidates(graph,address,max_hops=3)

    return {
        "address":address,"chain":"ethereum","transaction_count":len(transactions),"token_transfer_count":len(tokens),
        "transactions":transactions,"token_transfers":tokens,"graph":graph,
        "aggregated_graph":{"target_address":address.lower(),"node_count":graph["node_count"],"relationship_count":len(aggregated),"relationships":aggregated},
        "vasp_attribution":{"candidate_count":len(candidates),"candidates":candidates},
        "demo_attribution":{"demo_mode":False,"notice":"Live blockchain analysis. VASP attribution is based only on endpoints present in the configured registry.","candidates":candidates},
    }
