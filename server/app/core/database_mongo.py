from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from typing import Optional
import logging

from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# MongoDB client
client: Optional[AsyncIOMotorClient] = None


def get_database_url() -> str:
    """Get MongoDB connection URL."""
    if settings.MONGODB_URL:
        return settings.MONGODB_URL
    
    # Build URL from components
    if settings.MONGODB_USERNAME and settings.MONGODB_PASSWORD:
        auth = f"{settings.MONGODB_USERNAME}:{settings.MONGODB_PASSWORD}@"
    else:
        auth = ""
    
    return f"mongodb://{auth}{settings.MONGODB_HOST}:{settings.MONGODB_PORT}/{settings.MONGODB_DATABASE}"


async def connect_to_mongo():
    """Create database connection with improved error handling."""
    global client
    
    try:
        database_url = get_database_url()
        
        # Create client with connection options for better Windows compatibility
        client = AsyncIOMotorClient(
            database_url,
            serverSelectionTimeoutMS=5000,  # 5 second timeout
            connectTimeoutMS=10000,  # 10 second connection timeout
            socketTimeoutMS=20000,  # 20 second socket timeout
            maxPoolSize=10,  # Limit connection pool size
            minPoolSize=1,  # Minimum connections
            maxIdleTimeMS=30000,  # Close connections after 30 seconds of inactivity
            retryWrites=True,
            retryReads=True
        )
        
        # Test the connection with timeout
        await asyncio.wait_for(client.admin.command('ping'), timeout=5.0)
        
        # Get database
        database = client[settings.MONGODB_DATABASE]
        
        # Import all MongoDB models directly to avoid conflicts
        from app.models.user_mongo import User, ProvisionalUser, Company
        from app.models.file_upload_mongo import FileUpload
        from app.models.conversion_job_mongo import ConversionJob
        from app.models.extracted_data_mongo import ExtractedData
        from app.models.billing_history_mongo import BillingHistory
        
        # Initialize beanie with the models
        await init_beanie(
            database=database,
            document_models=[
                User,
                ProvisionalUser,
                Company,
                FileUpload,
                ConversionJob,
                ExtractedData,
                BillingHistory
            ]
        )
        
    except asyncio.TimeoutError:
        logger.error("MongoDB connection timeout")
        raise Exception("MongoDB connection timeout")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection():
    """Close database connection with proper cleanup."""
    global client
    if client is not None:
        try:
            # Close all connections gracefully with timeout
            if hasattr(client, 'close') and callable(client.close):
                await asyncio.wait_for(client.close(), timeout=2.0)
        except (Exception, asyncio.TimeoutError) as e:
            logger.warning(f"Error closing MongoDB connection (this is usually harmless): {e}")
            # Force close if graceful close fails
            try:
                if client is not None and hasattr(client, 'close'):
                    if asyncio.iscoroutinefunction(client.close):
                        await client.close()
                    else:
                        client.close()
            except Exception:
                pass
        finally:
            client = None


def get_database():
    """Get the database instance."""
    if client:
        return client[settings.MONGODB_DATABASE]
    return None 