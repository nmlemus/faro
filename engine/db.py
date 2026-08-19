"""Thin PostgREST/GoTrue client for the engine — pure stdlib, zero drivers.

The workers talk HTTP with the service key; every SQL-shaped operation is an RPC
defined in the migrations. Local-dev fallbacks are the public supabase demo keys.
"""
import json
import os
import urllib.request
import urllib.error

URL = os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321")
SERVICE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
)


def _req(method, path, body=None, headers=None):
    h = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
         "Content-Type": "application/json", "Prefer": "return=representation"}
    h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:400]}") from e


def select(table, query=""):
    return _req("GET", f"/rest/v1/{table}?{query}")

def insert(table, rows, upsert_on=None):
    h = {}
    path = f"/rest/v1/{table}"
    if upsert_on:
        path += f"?on_conflict={upsert_on}"
        h["Prefer"] = "return=representation,resolution=merge-duplicates"
    return _req("POST", path, rows, h)

def update(table, query, patch):
    return _req("PATCH", f"/rest/v1/{table}?{query}", patch)

def rpc(fn, args):
    return _req("POST", f"/rest/v1/rpc/{fn}", args)

def ensure_user(email, password, name):
    """GoTrue admin: create (or fetch) a confirmed user; returns user id."""
    try:
        u = _req("POST", "/auth/v1/admin/users",
                 {"email": email, "password": password, "email_confirm": True,
                  "user_metadata": {"name": name}})
        return u["id"]
    except RuntimeError as e:
        if "already been registered" not in str(e) and "already exists" not in str(e):
            raise
        users = _req("GET", "/auth/v1/admin/users?per_page=100")
        for u in users.get("users", users if isinstance(users, list) else []):
            if u["email"] == email:
                return u["id"]
        raise
