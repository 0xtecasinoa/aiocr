#!/usr/bin/env python3
"""
MongoDB-based startup script for Conex AI-OCR Backend Server
"""

import os
import sys
import asyncio
import signal
import socket
import time

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set Windows event loop policy for better compatibility
if sys.platform.startswith('win'):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    # Ignore SIGINT on Windows to prevent connection reset errors
    signal.signal(signal.SIGINT, signal.SIG_DFL)

# Set environment variables for MongoDB
os.environ["MONGODB_HOST"] = "localhost"
os.environ["MONGODB_PORT"] = "27017"
os.environ["MONGODB_DATABASE"] = "ocr_db"
os.environ["SECRET_KEY"] = "dev-secret-key-for-testing-only"
os.environ["DEBUG"] = "True"

def check_port_available(port=8000, host="127.0.0.1"):
    """Check if a port is available"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(1)
            result = sock.connect_ex((host, port))
            return result != 0  # Port is available if connection fails
    except Exception:
        return False

def kill_process_on_port(port=8000):
    """Kill any process using the specified port"""
    try:
        if sys.platform.startswith('win'):
            import subprocess
            # Find process using the port
            result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
            lines = result.stdout.split('\n')
            for line in lines:
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        try:
                            subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
                            print(f"✅ Killed process {pid} using port {port}")
                            time.sleep(1)
                        except Exception:
                            pass
    except Exception as e:
        print(f"Warning: Could not kill process on port {port}: {e}")

async def check_imports():
    """Check if all required imports work"""
    try:
        print("✅ Checking imports...")
        import fastapi
        print(f"   FastAPI version: {fastapi.__version__}")
        
        import uvicorn
        print(f"   Uvicorn available")
        
        import motor
        print(f"   Motor available")
        
        import beanie
        print(f"   Beanie available")
        
        import pymongo
        print(f"   PyMongo available")
        
        print("✅ All imports successful!")
        return True
    except Exception as e:
        print(f"❌ Import error: {e}")
        return False

async def check_mongodb_connection():
    """Check MongoDB connection"""
    try:
        print("✅ Testing MongoDB connection...")
        from motor.motor_asyncio import AsyncIOMotorClient
        
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        await client.admin.command('ping')
        print("✅ MongoDB connection successful!")
        client.close()
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        print("💡 Make sure MongoDB is running on localhost:27017")
        print("   Download MongoDB from: https://www.mongodb.com/try/download/community")
        return False

async def check_app():
    """Check if the app can be imported"""
    try:
        print("✅ Testing app import...")
        from app.main_mongo import app
        print("✅ MongoDB app imported successfully!")
        return app
    except Exception as e:
        print(f"❌ App import error: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Start the server with better error handling"""
    print("🚀 Starting OCR Backend Server (MongoDB Mode)")
    print("=" * 50)
    
    # Check and free port 8000 if needed
    print("🔍 Checking port availability...")
    if not check_port_available(8000):
        print("⚠️  Port 8000 is in use. Attempting to free it...")
        kill_process_on_port(8000)
        time.sleep(2)
        if not check_port_available(8000):
            print("❌ Could not free port 8000. Please manually stop the process using port 8000.")
            return
    print("✅ Port 8000 is available")
    
    # Check imports first
    if not asyncio.run(check_imports()):
        print("❌ Import check failed. Please install dependencies:")
        print("   py -m pip install -r requirements.txt")
        return
    
    # Check MongoDB connection
    if not asyncio.run(check_mongodb_connection()):
        print("❌ MongoDB check failed. Please start MongoDB server.")
        return
    
    # Check app
    app = asyncio.run(check_app())
    if app is None:
        print("❌ App check failed. Check the error above.")
        return
    
    print("✅ Starting Uvicorn server...")
    print("📚 API Documentation: http://127.0.0.1:8000/docs")
    print("💡 Health Check: http://127.0.0.1:8000/health")
    print("🗄️  Database: MongoDB")
    print("-" * 50)
    
    try:
        import uvicorn
        uvicorn.run(
            "app.main_mongo:app",
            host="127.0.0.1",
            port=8000,
            log_level="warning",  # Reduce log noise
            reload=False,  # Disable reload for better stability
            loop="asyncio",  # Use asyncio loop
            workers=1,  # Single worker for better Windows compatibility
            access_log=False  # Disable access logs to reduce noise
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 