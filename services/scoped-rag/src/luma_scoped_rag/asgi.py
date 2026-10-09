"""Uvicorn import target. Invalid runtime configuration aborts startup."""
from .api import default_app

app = default_app()
