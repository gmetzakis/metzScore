import json
import os

import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()
app = FastAPI(title="Sports Notifications API", description="API for sports notifications")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_URL = os.getenv("API_URL")

if not API_URL:
    raise ValueError("API_URL environment variable is not set. Please check your .env file.")

DEFAULT_HEADERS_JSON = os.getenv("DEFAULT_HEADERS")

if not DEFAULT_HEADERS_JSON:
    raise ValueError("DEFAULT_HEADERS environment variable is not set. Please check your .env file.")

DEFAULT_HEADERS = json.loads(DEFAULT_HEADERS_JSON)

@app.get("/api/live-matches")
def get_live_matches():
    try:
        response = requests.get(API_URL, headers=DEFAULT_HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        return {"error": str(e)}

@app.get("/")
def root():
    return {"message": "Sports Notifications API"}