from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, auth, books, change_orders, customers, documents, files, invites, milestones, payments, progress, projects, team

app = FastAPI(title="Sai Constructions API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, customers, projects, milestones, team, invites, files, payments, change_orders, progress, books, documents, admin):
    app.include_router(r.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}
