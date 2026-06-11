"""
shared/http_helpers.py — Utilitários HTTP para Cloud Functions
"""
import json


CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type":                 "application/json",
}


def cors_preflight():
    """Responde requisições OPTIONS (preflight CORS)."""
    return ("", 204, CORS_HEADERS)


def json_response(data, status=200):
    return (json.dumps(data, default=str, ensure_ascii=False), status, CORS_HEADERS)


def error_response(message, status=400):
    return json_response({"detail": message}, status)


def parse_body(request):
    """Retorna o body JSON da requisição como dict."""
    try:
        return request.get_json(force=True) or {}
    except Exception:
        return {}
