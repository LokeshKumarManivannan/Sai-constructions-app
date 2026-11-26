from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, change_orders, customers, files, invites, milestones, payments, projects, team

app = FastAPI(title="Sai Constructions API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, customers, projects, milestones, team, invites, files, payments, change_orders):
    app.include_router(r.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
