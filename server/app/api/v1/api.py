from fastapi import APIRouter

from app.api.v1.endpoints import auth_mongo, data_mongo, files_mongo, conversion_mongo, export_mongo, companies, billing_history

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth_mongo.router, prefix="/auth", tags=["authentication"])
api_router.include_router(companies.router, prefix="/companies", tags=["company management"])
api_router.include_router(files_mongo.router, prefix="/files", tags=["file management"])
api_router.include_router(conversion_mongo.router, prefix="/conversion", tags=["ocr conversion"])
api_router.include_router(data_mongo.router, prefix="/data", tags=["extracted data"])
api_router.include_router(export_mongo.router, prefix="/export", tags=["data export"])
api_router.include_router(billing_history.router, prefix="/billing-history", tags=["billing history"]) 