"""
shared/db.py — Conexão com PostgreSQL
Reutilizado por todas as Cloud Functions.
"""
import os
import psycopg2
import psycopg2.extras

DB_URL = os.getenv("DATABASE_URL")


def get_conn():
    """Abre uma conexão com o banco. Lembre de fechar no finally."""
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def db_one(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    return cur.fetchone()


def db_all(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    return cur.fetchall()


def db_exec(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    conn.commit()
    try:
        return cur.fetchone()
    except Exception:
        return None
