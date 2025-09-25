from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import time
import logging
import asyncio
import sys
import signal
import socket

from app.core.config import settings
from app.core.database_mongo import connect_to_mongo, close_mongo_connection
from app.api.v1.api import api_router

# Set Windows event loop policy for better compatibility
if sys.platform.startswith('win'):
    # Use SelectorEventLoop instead of ProactorEventLoop to avoid connection reset errors
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    # Ignore SIGINT on Windows to prevent connection reset errors
    signal.signal(signal.SIGINT, signal.SIG_DFL)

# Custom log filter to suppress Windows connection reset errors
class WindowsConnectionFilter(logging.Filter):
    def filter(self, record):
        # Suppress Windows connection reset errors
        if "ConnectionResetError" in str(record.getMessage()):
            return False
        if "WinError 10054" in str(record.getMessage()):
            return False
        if "_call_connection_lost" in str(record.getMessage()):
            return False
        return True

# Configure logging to reduce console output
logging.basicConfig(
    level=logging.WARNING,  # Only show warnings and errors
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Apply filter to suppress Windows connection errors
logger = logging.getLogger(__name__)
asyncio_logger = logging.getLogger('asyncio')
asyncio_logger.addFilter(WindowsConnectionFilter())

# Also apply to root logger to catch all connection errors
root_logger = logging.getLogger()
root_logger.addFilter(WindowsConnectionFilter())

# Set Windows-specific asyncio policy if on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    try:
        await connect_to_mongo()
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise
    
    yield
    
    # Shutdown
    try:
        await close_mongo_connection()
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-powered OCR API for document processing and data extraction with MongoDB",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan
)

# Add CORS middleware with comprehensive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"] if settings.DEBUG else settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Add trusted host middleware for security
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "*.yourdomain.com"]
    )


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time header to responses."""
    start_time = time.time()
    try:
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = JSONResponse(content={})
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
            
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("origin", "*")
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response
    except ConnectionResetError:
        # Silently handle Windows connection reset errors
        return JSONResponse(
            status_code=200,
            content={"detail": "Connection reset by client"}
        )
    except Exception as e:
        # Only log non-connection errors
        if "ConnectionResetError" not in str(e) and "WinError 10054" not in str(e):
            logger.error(f"Request processing error: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Conex AI-OCR API", "version": settings.VERSION}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "message": "Server is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main_mongo:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.DEBUG,
        log_level="warning",  # Only show warnings and errors
        loop="asyncio",
        access_log=False,  # Disable access logs
        use_colors=True
    ) 