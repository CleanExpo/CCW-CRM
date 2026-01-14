from fastapi import FastAPI

app = FastAPI(title="CCW-Online ERP Backend")

@app.get("/")
def read_root():
    return {"message": "Welcome to CCW-Online ERP API"}
