VASP_REGISTRY = [
    {"address":"0x1111111111111111111111111111111111111111","vasp":"Binance","category":"Centralized Exchange","label":"Binance Demo Deposit","verified":True},
    {"address":"0x2222222222222222222222222222222222222222","vasp":"Coinbase","category":"Centralized Exchange","label":"Coinbase Demo Deposit","verified":True},
    {"address":"0x3333333333333333333333333333333333333333","vasp":"Kraken","category":"Centralized Exchange","label":"Kraken Demo Deposit","verified":True},
    {"address":"0x4444444444444444444444444444444444444444","vasp":"OKX","category":"Centralized Exchange","label":"OKX Demo Deposit","verified":True},
]
def get_vasp_by_address(address: str):
    address=address.lower()
    return next((x for x in VASP_REGISTRY if x["address"].lower()==address), None)
def get_all_vasp_addresses():
    return VASP_REGISTRY
