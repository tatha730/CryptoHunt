def build_controlled_demo_graph(target_address: str):
    target=target_address.lower()
    a="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    b="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    v="0x1111111111111111111111111111111111111111"
    return {
        "target_address": target,
        "node_count": 4,
        "edge_count": 3,
        "nodes": [
            {"id":target,"type":"target_wallet","incoming_count":0,"outgoing_count":1,"total_transactions":1},
            {"id":a,"type":"wallet","incoming_count":1,"outgoing_count":1,"total_transactions":2},
            {"id":b,"type":"wallet","incoming_count":1,"outgoing_count":1,"total_transactions":2},
            {"id":v,"type":"wallet","incoming_count":1,"outgoing_count":0,"total_transactions":1},
        ],
        "edges": [
            {"id":"demo_eth_1","source":target,"target":a,"asset":"ETH","amount":"1500000000000000000","amount_unit":"wei","tx_hash":"0xdemo000000000000000000000000000000000000000000000000000000000001","block_number":1,"timestamp":1757000000,"transaction_type":"ETH"},
            {"id":"demo_usdt_2","source":a,"target":b,"asset":"USDT","amount":"2500000000","amount_unit":6,"token_contract":"0xdddddddddddddddddddddddddddddddddddddddd","tx_hash":"0xdemo000000000000000000000000000000000000000000000000000000000002","block_number":2,"timestamp":1757003600,"transaction_type":"ERC20"},
            {"id":"demo_eth_3","source":b,"target":v,"asset":"ETH","amount":"1200000000000000000","amount_unit":"wei","tx_hash":"0xdemo000000000000000000000000000000000000000000000000000000000003","block_number":3,"timestamp":1757007200,"transaction_type":"ETH"},
        ],
    }

def build_demo_notice():
    return "CONTROLLED DEMO: the path and endpoint are simulated to demonstrate the attribution algorithm end-to-end; this is not real evidence of VASP ownership."
