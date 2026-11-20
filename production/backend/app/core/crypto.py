from cryptography.fernet import Fernet


def new_fernet() -> Fernet:
    return Fernet(Fernet.generate_key())


def encrypt(fernet: Fernet, plaintext: str) -> str:
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt(fernet: Fernet, token: str) -> str:
    return fernet.decrypt(token.encode()).decode()
