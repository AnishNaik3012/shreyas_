import uuid

def create_token() -> str:
    return str(uuid.uuid4())
