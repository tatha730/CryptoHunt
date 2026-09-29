from typing import Optional
from pydantic import BaseModel

class Transaction(BaseModel):
    hash: str
    from_address: str
    to_address: Optional[str] = None
    value_wei: int
    block_number: int
    timestamp: int
    is_error: bool
    transaction_type: str = "ETH"

class TokenTransfer(BaseModel):
    hash: str
    from_address: str
    to_address: Optional[str] = None
    token_contract: str
    token_name: str
    token_symbol: str
    token_decimals: int
    token_value: str
    block_number: int
    timestamp: int
    transaction_type: str = "ERC20"
