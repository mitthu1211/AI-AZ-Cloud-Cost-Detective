import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import azure_scanner
import ai_analyzer
import db
import auth

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, analysis_id: str):
        await websocket.accept()
        self.active_connections[analysis_id] = websocket

    def disconnect(self, analysis_id: str):
        if analysis_id in self.active_connections:
            del self.active_connections[analysis_id]

    async def send_progress(self, message: str, analysis_id: str):
        if analysis_id in self.active_connections:
            try:
                await self.active_connections[analysis_id].send_text(message)
            except Exception:
                pass

manager = ConnectionManager()
db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    db_pool = await db.get_db_pool()
    await db.init_db(db_pool)
    yield
    if db_pool:
        await db_pool.close()

app = FastAPI(title="AI Cloud Cost Detective API", lifespan=lifespan)

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

class AnalyzeRequest(BaseModel):
    resource_group: str
    analysis_id: str | None = None  # Used for mapping websocket connections

@app.get("/api/resource-groups")
async def list_resource_groups(user_id: int = Depends(auth.get_current_user)):
    try:
        # Run synchronous blocking function in a threadpool
        groups = await asyncio.to_thread(azure_scanner.get_resource_groups)
        return {"status": "success", "data": groups}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/progress/{analysis_id}")
async def websocket_progress(websocket: WebSocket, analysis_id: str):
    await manager.connect(websocket, analysis_id)
    try:
        while True:
            # We just need to keep the connection open to send messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(analysis_id)

@app.post("/api/analyze")
async def analyze_resource_group(request: AnalyzeRequest, user_id: int = Depends(auth.get_current_user)):
    analysis_id = request.analysis_id
    try:
        if analysis_id:
            await manager.send_progress("Fetching resource groups...", analysis_id)
            
        if analysis_id:
            await manager.send_progress(f"Scanning resources in {request.resource_group}...", analysis_id)
            
        resources = await asyncio.to_thread(azure_scanner.get_resources_in_group, request.resource_group)
        
        if analysis_id:
            await manager.send_progress("Analyzing costs with AI...", analysis_id)
            
        analysis = await asyncio.to_thread(ai_analyzer.analyze_resources, resources)
        
        if analysis_id:
            await manager.send_progress("Storing results...", analysis_id)
            
        # Extract metrics for DB
        issues_found = len(analysis.get("issues", []))
        estimated_savings = analysis.get("estimated_savings", "Unknown")
        
        # Save to database using the authenticated user_id
        saved_analysis = await db.save_analysis(
            db_pool, 
            user_id=user_id, 
            resource_group=request.resource_group, 
            resources_scanned=len(resources), 
            issues_found=issues_found, 
            estimated_savings=estimated_savings, 
            analysis_result=analysis, 
            status="completed"
        )
        
        if analysis_id:
            await manager.send_progress("Analysis complete", analysis_id)
            
        return {
            "status": "success",
            "resource_group": request.resource_group,
            "resources_count": len(resources),
            "analysis": analysis,
            "saved_analysis": saved_analysis
        }
    except Exception as e:
        if analysis_id:
            await manager.send_progress(f"Error: {str(e)}", analysis_id)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def get_analysis_history(user_id: int = Depends(auth.get_current_user)):
    try:
        history = await db.get_history(db_pool, user_id=user_id)
        return {"status": "success", "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history/{analysis_id}")
async def get_analysis_detail(analysis_id: int, user_id: int = Depends(auth.get_current_user)):
    try:
        analysis = await db.get_analysis_by_id(db_pool, user_id=user_id, analysis_id=analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        return {"status": "success", "data": analysis}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
