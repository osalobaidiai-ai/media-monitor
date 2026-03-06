"""
WebSocket للتحديثات الفورية
Real-time WebSocket Updates
"""
import json
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return

        dead_connections = set()
        for connection in self.active_connections.copy():
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.add(connection)

        for conn in dead_connections:
            self.disconnect(conn)

    async def broadcast_alert(self, alert_data: dict):
        message = {
            "type": "crisis_alert",
            "data": alert_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.broadcast(message)

    async def broadcast_new_article(self, article_data: dict):
        message = {
            "type": "new_article",
            "data": article_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.broadcast(message)

    async def broadcast_stats_update(self, stats: dict):
        message = {
            "type": "stats_update",
            "data": stats,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.broadcast(message)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # إرسال رسالة ترحيب
        await manager.send_personal_message(
            {
                "type": "connected",
                "message": "مرحباً بك في منظومة رصد الإعلام السعودي",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            websocket,
        )

        # الاستماع للرسائل الواردة
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                message = json.loads(data)

                if message.get("type") == "ping":
                    await manager.send_personal_message(
                        {"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()},
                        websocket,
                    )

            except asyncio.TimeoutError:
                # إرسال heartbeat
                await manager.send_personal_message(
                    {"type": "heartbeat", "timestamp": datetime.now(timezone.utc).isoformat()},
                    websocket,
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
