"""
خدمة التخزين المؤقت بـ Redis
Redis Cache Service
"""
import json
import logging
from typing import Any, Optional
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self):
        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            await self.redis.ping()
            logger.info("Redis connected successfully")
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis = None

    async def disconnect(self):
        if self.redis:
            await self.redis.close()

    async def get(self, key: str) -> Optional[Any]:
        if not self.redis:
            return None
        try:
            value = await self.redis.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            logger.error(f"Cache get error for {key}: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        if not self.redis:
            return False
        try:
            await self.redis.setex(key, ttl, json.dumps(value, ensure_ascii=False))
            return True
        except Exception as e:
            logger.error(f"Cache set error for {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        if not self.redis:
            return False
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error for {key}: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        if not self.redis:
            return 0
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache delete pattern error for {pattern}: {e}")
            return 0

    async def increment(self, key: str) -> int:
        if not self.redis:
            return 0
        try:
            return await self.redis.incr(key)
        except Exception as e:
            logger.error(f"Cache increment error for {key}: {e}")
            return 0

    async def publish(self, channel: str, message: Any) -> bool:
        if not self.redis:
            return False
        try:
            await self.redis.publish(channel, json.dumps(message, ensure_ascii=False))
            return True
        except Exception as e:
            logger.error(f"Cache publish error for {channel}: {e}")
            return False


# Singleton
cache = CacheService()
