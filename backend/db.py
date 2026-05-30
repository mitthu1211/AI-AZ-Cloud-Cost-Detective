import os
import json
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
local_users = []
local_analyses = []
local_user_id = 1
local_analysis_id = 1

async def get_db_pool():
    if not DATABASE_URL:
        # Fallback to None if not configured, allowing app to start without DB for local testing if needed
        # But we will raise an error if they try to query.
        return None
    return await asyncpg.create_pool(DATABASE_URL)

async def init_db(pool):
    if not pool:
        return
    async with pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS analyses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                resource_group VARCHAR(255) NOT NULL,
                resources_scanned INTEGER,
                issues_found INTEGER,
                estimated_savings VARCHAR(255),
                analysis_result JSONB,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        # Insert a mock user if we don't have auth yet
        await conn.execute('''
            INSERT INTO users (id, email, password_hash) 
            VALUES (1, 'demo@example.com', 'mockhash') 
            ON CONFLICT (email) DO NOTHING
        ''')

async def save_analysis(pool, user_id, resource_group, resources_scanned, issues_found, estimated_savings, analysis_result, status):
    global local_analysis_id
    if not pool:
        record = {
            "id": local_analysis_id,
            "user_id": user_id,
            "resource_group": resource_group,
            "resources_scanned": resources_scanned,
            "issues_found": issues_found,
            "estimated_savings": estimated_savings,
            "analysis_result": analysis_result,
            "status": status,
            "created_at": None
        }
        local_analysis_id += 1
        local_analyses.append(record)
        return format_analysis_record(record)
    async with pool.acquire() as conn:
        record = await conn.fetchrow('''
            INSERT INTO analyses (user_id, resource_group, resources_scanned, issues_found, estimated_savings, analysis_result, status)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            RETURNING id, resource_group, resources_scanned, issues_found, estimated_savings, analysis_result, status, created_at
        ''', user_id, resource_group, resources_scanned, issues_found, estimated_savings, json.dumps(analysis_result), status)
        return format_analysis_record(record)

def format_analysis_record(record):
    if not record:
        return None
    analysis_result = record["analysis_result"]
    if isinstance(analysis_result, str):
        analysis_result = json.loads(analysis_result)
    return {
        "id": record["id"],
        "resource_group": record["resource_group"],
        "resources_scanned": record["resources_scanned"],
        "issues_found": record["issues_found"],
        "estimated_savings": record["estimated_savings"],
        "analysis_result": analysis_result,
        "status": record["status"],
        "created_at": record["created_at"].isoformat() if hasattr(record["created_at"], "isoformat") else record["created_at"]
    }

async def get_history(pool, user_id):
    if not pool:
        return [
            {
                "id": record["id"],
                "resource_group": record["resource_group"],
                "resources_scanned": record["resources_scanned"],
                "issues_found": record["issues_found"],
                "estimated_savings": record["estimated_savings"],
                "status": record["status"],
                "created_at": record["created_at"]
            }
            for record in reversed(local_analyses)
            if record["user_id"] == user_id
        ]
    async with pool.acquire() as conn:
        records = await conn.fetch('''
            SELECT id, resource_group, resources_scanned, issues_found, estimated_savings, status, created_at 
            FROM analyses WHERE user_id = $1 ORDER BY created_at DESC
        ''')
        # Convert asyncpg.Record to dict and format datetime
        return [
            {
                "id": record["id"],
                "resource_group": record["resource_group"],
                "resources_scanned": record["resources_scanned"],
                "issues_found": record["issues_found"],
                "estimated_savings": record["estimated_savings"],
                "status": record["status"],
                "created_at": record["created_at"].isoformat() if record["created_at"] else None
            }
            for record in records
        ]

async def get_analysis_by_id(pool, user_id, analysis_id):
    if not pool:
        for record in local_analyses:
            if record["user_id"] == user_id and record["id"] == analysis_id:
                return format_analysis_record(record)
        return None
    async with pool.acquire() as conn:
        record = await conn.fetchrow('''
            SELECT id, resource_group, resources_scanned, issues_found, estimated_savings, analysis_result, status, created_at
            FROM analyses WHERE user_id = $1 AND id = $2
        ''', user_id, analysis_id)
        return format_analysis_record(record)

async def get_user_by_email(pool, email: str):
    if not pool:
        for user in local_users:
            if user["email"] == email:
                return user
        return None
    async with pool.acquire() as conn:
        record = await conn.fetchrow('SELECT * FROM users WHERE email = $1', email)
        if record:
            return dict(record)
        return None

async def create_user(pool, email: str, password_hash: str):
    global local_user_id
    if not pool:
        if any(user["email"] == email for user in local_users):
            return None
        user = {"id": local_user_id, "email": email, "password_hash": password_hash}
        local_user_id += 1
        local_users.append(user)
        return {"id": user["id"], "email": user["email"]}
    async with pool.acquire() as conn:
        try:
            record = await conn.fetchrow(
                'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
                email, password_hash
            )
            return dict(record)
        except asyncpg.exceptions.UniqueViolationError:
            return None
