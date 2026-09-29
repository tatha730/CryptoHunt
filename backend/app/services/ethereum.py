import os
import requests
from dotenv import load_dotenv

load_dotenv()
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY")
BASE_URL = "https://api.etherscan.io/v2/api"

def etherscan_request(params: dict):
    if not ETHERSCAN_API_KEY:
        raise RuntimeError("ETHERSCAN_API_KEY is not configured in the .env file.")
    params["chainid"] = "1"
    params["apikey"] = ETHERSCAN_API_KEY
    response = requests.get(BASE_URL, params=params, timeout=20)
    response.raise_for_status()
    return response.json()

def _result(params, label):
    data = etherscan_request(params)
    if data.get("status") != "1":
        message = str(data.get("message", ""))
        if "No transactions" in message or data.get("result") == []:
            return []
        raise RuntimeError(f"Etherscan {label} API error: {message}")
    return data.get("result", [])

def get_transactions(address: str):
    return _result({
        "module":"account","action":"txlist","address":address,
        "startblock":0,"endblock":99999999,"page":1,"offset":100,"sort":"desc"
    }, "transaction")

def get_token_transfers(address: str):
    return _result({
        "module":"account","action":"tokentx","address":address,
        "startblock":0,"endblock":99999999,"page":1,"offset":100,"sort":"desc"
    }, "token")
