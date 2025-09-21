from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import List, Optional
import os
import uuid
import aiofiles
import logging
from pathlib import Path
from datetime import datetime
from bson import ObjectId

from app.core.config import settings
from app.api.v1.endpoints.auth_mongo import get_current_active_user
from app.models.user_mongo import User
from app.models.file_upload_mongo import FileUpload

logger = logging.getLogger(__name__)

router = APIRouter()

# Ensure upload directory exists
UPLOAD_DIR = getattr(settings, 'UPLOAD_DIR', './uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder_name: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Upload a file."""
    
    try:
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads") / str(current_user.id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Create database record
        file_upload = FileUpload(
            user_id=str(current_user.id),
            filename=unique_filename,
            original_name=file.filename,
            file_path=str(file_path),
            file_size=len(content),
            mime_type=file.content_type or "application/octet-stream",
            folder_name=folder_name,
            upload_status="completed",
            created_at=datetime.utcnow()
        )
        
        await file_upload.save()
        
        return {
            "success": True,
            "file_id": str(file_upload.id),
                "filename": file_upload.filename,
            "original_name": file_upload.original_name,
                "size": file_upload.file_size,
            "folder_name": file_upload.folder_name
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading file: {str(e)}"
        )


@router.post("/upload-multiple")
async def upload_multiple_files(
    files: List[UploadFile] = File(..., description="Files to upload"),
    folder_name: str = Form(None, description="Optional folder name for organizing files"),
    current_user: User = Depends(get_current_active_user)
):
    """Upload multiple files with optional folder organization."""
    
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )
    
    # Validate file size (default 100MB if not set)
    max_size = getattr(settings, 'MAX_FILE_SIZE', 100) * 1024 * 1024
    
    # Validate file extensions
    allowed_extensions = getattr(settings, 'ALLOWED_EXTENSIONS', ['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'xls', 'xlsx', 'doc', 'docx', 'txt'])
    
    uploaded_files = []
    errors = []
    
    # Create folder structure if folder_name is provided
    if folder_name:
        folder_path = os.path.join(UPLOAD_DIR, str(current_user.id), folder_name)
        os.makedirs(folder_path, exist_ok=True)
    else:
        folder_path = os.path.join(UPLOAD_DIR, str(current_user.id))
        os.makedirs(folder_path, exist_ok=True)
    
    for file in files:
        try:
            # Validate file size
            if file.size and file.size > max_size:
                errors.append(f"File {file.filename} exceeds maximum allowed size of {max_size // (1024*1024)}MB")
                continue
            
            # Validate file extension
            file_extension = Path(file.filename).suffix.lower().lstrip('.')
            if file_extension not in allowed_extensions:
                errors.append(f"File {file.filename} has unsupported type. Allowed: {', '.join(allowed_extensions)}")
                continue
            
            # Generate unique filename
            file_id = str(uuid.uuid4())
            filename = f"{file_id}.{file_extension}"
            
            # Save to user's folder
            file_path = os.path.join(folder_path, filename)
            
            # Save file to disk
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            # Create database record
            file_upload = FileUpload(
                original_name=file.filename,
                filename=filename,
                file_path=file_path,
                file_size=len(content),
                mime_type=file.content_type,
                user_id=str(current_user.id),
                folder_name=folder_name,
                upload_status="completed",
                created_at=datetime.utcnow()
            )
            
            await file_upload.save()
            
            uploaded_files.append({
                "id": str(file_upload.id),
                "filename": file_upload.filename,
                "originalName": file_upload.original_name,
                "mimeType": file_upload.mime_type,
                "size": file_upload.file_size,
                "path": file_upload.file_path,
                "folderName": file_upload.folder_name,
                "uploadedAt": file_upload.created_at.isoformat(),
                "userId": file_upload.user_id
            })
            
        except Exception as e:
            errors.append(f"Error uploading {file.filename}: {str(e)}")
            continue
    
    if not uploaded_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files were uploaded successfully. Errors: " + str(errors)
        )
    
    return {
        "success": True,
        "uploadedFiles": uploaded_files,
        "folderName": folder_name,
        "totalFiles": len(uploaded_files),
        "errors": errors if errors else []
    }


@router.get("/test/{file_id}")
async def test_file_exists(
    file_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Test if a file exists and is accessible."""
    
    try:
        # Try to convert to ObjectId first
        try:
            object_id = ObjectId(file_id)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file ID format: {str(e)}"
            )
        
        # Find the file
        file_upload = await FileUpload.get(object_id)
        if not file_upload:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Check if user owns this file or is admin
        if file_upload.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this file"
            )
        
        # Check if file exists on disk
        file_exists = os.path.exists(file_upload.file_path)
        
        return {
            "success": True,
            "file_id": file_id,
            "exists": file_exists,
                "file_path": file_upload.file_path,
            "original_name": file_upload.original_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error testing file: {str(e)}"
        )


@router.get("/test-delete/{file_id}")
async def test_delete_file(
    file_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Test endpoint to check if a file can be deleted."""
    
    try:
        # Try multiple approaches to find the file
        file_upload = None
        
        # Approach 1: Try as ObjectId
        try:
            from bson import ObjectId
            object_id = ObjectId(file_id)
            file_upload = await FileUpload.get(object_id)
            if file_upload:
                pass # Found file using ObjectId
        except Exception as e:
            pass # ObjectId conversion failed
        
        # Approach 2: Try as string ID
        if not file_upload:
            try:
                file_upload = await FileUpload.get(file_id)
                if file_upload:
                    pass # Found file using string ID
            except Exception as e:
                pass # String ID lookup failed
        
        # Approach 3: Search by filename or original_name
        if not file_upload:
            files = await FileUpload.find(
                FileUpload.user_id == str(current_user.id)
            ).to_list()
            
            for f in files:
                if str(f.id) == file_id or f.filename == file_id or f.original_name == file_id:
                    file_upload = f
                    break
        
        if not file_upload:
            return {
                "success": False,
                "message": "File not found",
                "file_id": file_id,
                "user_id": str(current_user.id)
            }
        
        # Check authorization
        can_delete = str(file_upload.user_id) == str(current_user.id) or current_user.is_admin
        
        # Check if file exists on disk
        file_exists_on_disk = os.path.exists(file_upload.file_path)
        
        return {
            "success": True,
            "message": "File found",
            "file": {
                "id": str(file_upload.id),
                "originalName": file_upload.original_name,
                "filename": file_upload.filename,
                "user_id": file_upload.user_id,
                "file_path": file_upload.file_path,
                "exists_on_disk": file_exists_on_disk,
                "can_delete": can_delete
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in test_delete_file: {str(e)}"
        )


@router.post("/cleanup-orphaned-files")
async def cleanup_orphaned_files(
    current_user: User = Depends(get_current_active_user)
):
    """Clean up orphaned database records (files that don't exist on disk)."""
    
    try:
        # Get all files for the current user
        files = await FileUpload.find(
            FileUpload.user_id == str(current_user.id)
        ).to_list()
        
        cleaned_count = 0
        orphaned_files = []
        
        for file_upload in files:
            # Check if file exists on disk
            if not os.path.exists(file_upload.file_path):
                orphaned_files.append({
                    "id": str(file_upload.id),
                    "originalName": file_upload.original_name,
                    "filename": file_upload.filename,
                    "file_path": file_upload.file_path
                })
                
                # Delete the database record
                try:
                    await file_upload.delete()
                    cleaned_count += 1
                except Exception as e:
                    pass # Ignore errors during cleanup
        
        return {
            "success": True,
            "message": f"Cleaned up {cleaned_count} orphaned files",
            "cleanedCount": cleaned_count,
            "orphanedFiles": orphaned_files
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cleaning up orphaned files: {str(e)}"
        )


@router.get("/debug/all-files")
async def debug_all_files(
    current_user: User = Depends(get_current_active_user)
):
    """Debug endpoint to list all files for the current user."""
    
    try:
        # Get all files for the current user
        files = await FileUpload.find(
            FileUpload.user_id == str(current_user.id),
            FileUpload.upload_status == "completed"
        ).to_list()
        
        file_list = []
        for file in files:
            file_info = {
                "id": str(file.id),
                "originalName": file.original_name,
                "filename": file.filename,
                "user_id": file.user_id,
                "file_path": file.file_path,
                "exists_on_disk": os.path.exists(file.file_path),
                "created_at": file.created_at.isoformat() if file.created_at else None
            }
            file_list.append(file_info)
        
        return {
            "success": True,
            "user_id": str(current_user.id),
            "total_files": len(files),
            "files": file_list
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in debug_all_files: {str(e)}"
        )


@router.get("/user/{user_id}")
async def get_user_files(
    user_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get all files uploaded by a specific user."""
    
    # Check if user is requesting their own files or is admin
    if str(current_user.id) != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view these files"
        )
    
    try:
        files = await FileUpload.find(
            FileUpload.user_id == user_id,
            FileUpload.upload_status == "completed"
        ).to_list()
        
        return {
            "success": True,
            "files": [
                {
                    "id": str(file.id),
                    "filename": file.filename,
                    "originalName": file.original_name,
                    "mimeType": file.mime_type,
                    "size": file.file_size,
                    "path": file.file_path,
                    "folderName": file.folder_name,
                    "uploadedAt": file.created_at.isoformat(),
                    "userId": file.user_id
                }
                for file in files
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving files: {str(e)}"
        )


@router.get("/user/{user_id}/folders")
async def get_user_folders(
    user_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get all folders created by a specific user."""
    
    # Check if user is requesting their own folders or is admin
    if str(current_user.id) != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view these folders"
        )
    
    try:
        # Get all files for the user
        files = await FileUpload.find(
            FileUpload.user_id == user_id,
            FileUpload.upload_status == "completed"
        ).to_list()
        
        # Group files by folder
        folders = {}
        for file in files:
            folder_name = file.folder_name or "その他"
            if folder_name not in folders:
                folders[folder_name] = {
                    "name": folder_name,
                    "fileCount": 0,
                    "files": [],
                    "uploadDate": file.created_at.isoformat()
                }
            folders[folder_name]["fileCount"] += 1
            folders[folder_name]["files"].append({
                "id": str(file.id),
                "filename": file.filename,
                "originalName": file.original_name,
                "mimeType": file.mime_type,
                "size": file.file_size
            })
        
        return {
            "success": True,
            "folders": list(folders.values())
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving folders: {str(e)}"
        )


@router.get("/user/{user_id}/items")
async def get_user_items(
    user_id: str,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_active_user)
):
    """Get all uploaded items (files and folders) for a specific user, separated by type with pagination."""
    
    # Check if user is requesting their own items or is admin
    if str(current_user.id) != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view these items"
        )
    
    try:
        # Get all files for the user with completed upload status
        files = await FileUpload.find(
            FileUpload.user_id == user_id,
            FileUpload.upload_status == "completed"
        ).to_list()
        
        # Validate file existence on disk
        valid_files = []
        for file in files:
            if os.path.exists(file.file_path):
                valid_files.append(file)
        
        # Separate files and folders
        individual_files = []
        folders = {}
        
        for file in valid_files:
            if file.folder_name:
                # File is part of a folder
                if file.folder_name not in folders:
                    folders[file.folder_name] = {
                        "name": file.folder_name,
                        "fileCount": 0,
                        "files": [],
                        "uploadDate": file.created_at.isoformat(),
                        "type": "folder"
                    }
                folders[file.folder_name]["fileCount"] += 1
                folders[file.folder_name]["files"].append({
                    "id": str(file.id),
                    "filename": file.filename,
                    "originalName": file.original_name,
                    "mimeType": file.mime_type,
                    "size": file.file_size
                })
            else:
                # Individual file (no folder)
                individual_files.append({
                    "id": str(file.id),
                    "filename": file.filename,
                    "originalName": file.original_name,
                    "mimeType": file.mime_type,
                    "size": file.file_size,
                    "uploadDate": file.created_at.isoformat(),
                    "type": "file"
                })
        
        # Convert folders to list
        folder_list = list(folders.values())
        
        # Apply pagination to individual files
        total_individual_files = len(individual_files)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_individual_files = individual_files[start_idx:end_idx]
        
        # Apply pagination to folders
        total_folders = len(folder_list)
        start_idx_folders = (page - 1) * limit
        end_idx_folders = start_idx_folders + limit
        paginated_folders = folder_list[start_idx_folders:end_idx_folders]
        
        return {
            "success": True,
            "individualFiles": paginated_individual_files,
            "folders": paginated_folders,
            "totalIndividualFiles": total_individual_files,
            "totalFolders": total_folders,
            "pagination": {
                "page": page,
                "limit": limit,
                "totalPages": max(1, (max(total_individual_files, total_folders) + limit - 1) // limit),
                "hasNext": (page * limit) < max(total_individual_files, total_folders),
                "hasPrev": page > 1
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving items: {str(e)}"
        )


@router.get("/")
async def list_files(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user)
):
    """List user's uploaded files."""
    
    return await get_user_files(str(current_user.id), skip, limit, current_user)


@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Download a specific file."""
    
    try:
        # Find the file
        file_upload = await FileUpload.get(file_id)
        if not file_upload:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Check if user owns the file or is admin
        if str(file_upload.user_id) != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to download this file"
            )
        
        # Check if file exists on disk
        if not os.path.exists(file_upload.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found on disk"
            )
        
        # Return file info for download
        return {
            "success": True,
            "file_info": {
                "id": str(file_upload.id),
                "filename": file_upload.filename,
                "original_name": file_upload.original_name,
                "file_path": file_upload.file_path,
                "file_size": file_upload.file_size,
                "mime_type": file_upload.mime_type,
                "download_url": f"/api/v1/files/serve/{file_id}"
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading file: {str(e)}"
        )


@router.get("/serve/{file_id}")
async def serve_file(
    file_id: str,
    token: str = None,
    current_user: User = Depends(get_current_active_user)
):
    """Serve a file for download."""
    
    try:
        # Find the file
        from bson import ObjectId
        try:
            # Try to convert to ObjectId if it's a valid ObjectId string
            if ObjectId.is_valid(file_id):
                file_upload = await FileUpload.get(ObjectId(file_id))
            else:
                # If not a valid ObjectId, search by filename or other fields
                file_upload = await FileUpload.find_one({"filename": file_id})
            
            if not file_upload:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found"
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Check if user owns the file or is admin
        if str(file_upload.user_id) != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this file"
            )
        
        # Check if file exists on disk
        if not os.path.exists(file_upload.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File not found on disk: {file_upload.file_path}"
            )
        
        # Check file size
        actual_size = os.path.getsize(file_upload.file_path)
        if actual_size == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File is empty"
            )
        
        # Read and return the file
        with open(file_upload.file_path, 'rb') as f:
            file_content = f.read()
        
        from fastapi.responses import Response
        headers = {
            "Content-Length": str(len(file_content)),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Disposition",
            "Access-Control-Expose-Headers": "Content-Disposition, Content-Type, Content-Length",
        }
        
        # Set proper content type and disposition based on file type
        headers["Content-Type"] = file_upload.mime_type
        
        # Safely handle filename encoding for Unicode characters (Japanese, etc.)
        import urllib.parse
        import os
        
        # Create a safe filename for Content-Disposition header
        safe_filename = None
        logger.info(f"Processing file: {file_upload.original_name} (mime: {file_upload.mime_type})")
        
        try:
            # Try to URL encode the original filename
            encoded_bytes = file_upload.original_name.encode('utf-8')
            safe_filename = urllib.parse.quote(encoded_bytes, safe='')
            logger.info(f"Successfully encoded filename: {safe_filename}")
        except Exception as e:
            logger.error(f"Failed to encode filename '{file_upload.original_name}': {e}")
            try:
                # Fallback: create a simple safe filename
                file_ext = os.path.splitext(file_upload.original_name)[1] if file_upload.original_name else '.bin'
                fallback_name = f"file_{str(file_upload.id)[:8]}{file_ext}"
                safe_filename = urllib.parse.quote(fallback_name.encode('utf-8'), safe='')
                logger.info(f"Using fallback filename: {safe_filename}")
            except Exception as e2:
                # Ultimate fallback
                safe_filename = f"file_{str(file_upload.id)[:8]}"
                logger.error(f"Using ultimate fallback: {safe_filename}, error: {e2}")
        
        # Set Content-Disposition header - simplified approach without filename
        try:
            if (file_upload.mime_type.startswith('image/') or 
                file_upload.mime_type == 'application/pdf' or
                file_upload.mime_type == 'application/vnd.ms-excel' or
                file_upload.mime_type == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'):
                headers["Content-Disposition"] = "inline"
                logger.info("Set Content-Disposition: inline (no filename)")
            else:
                headers["Content-Disposition"] = "attachment"
                logger.info("Set Content-Disposition: attachment (no filename)")
                
        except Exception as e:
            # Fallback to simple disposition without filename
            logger.error(f"Error setting Content-Disposition header: {e}")
            headers["Content-Disposition"] = "inline"
        
        try:
            logger.info(f"Creating response with headers: {headers}")
            response = Response(
                content=file_content,
                media_type=file_upload.mime_type,
                headers=headers
            )
            logger.info("Response created successfully")
            return response
        except Exception as e:
            logger.error(f"Error creating Response: {e}")
            # Try with minimal headers
            minimal_headers = {
                "Content-Length": str(len(file_content)),
                "Content-Type": file_upload.mime_type
            }
            return Response(
                content=file_content,
                media_type=file_upload.mime_type,
                headers=minimal_headers
            )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"Detailed error in serve_file: {error_traceback}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error serving file: {str(e)}"
        )


@router.get("/test/{file_id}")
async def test_file_access(
    file_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Test endpoint to check file access and existence."""
    try:
        # Find the file
        from bson import ObjectId
        try:
            if ObjectId.is_valid(file_id):
                file_upload = await FileUpload.get(ObjectId(file_id))
            else:
                file_upload = await FileUpload.find_one({"filename": file_id})
            
            if not file_upload:
                return {
                    "success": False,
                    "error": "File not found in database",
                    "file_id": file_id
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Database error: {str(e)}",
                "file_id": file_id
            }
        
        # Check authorization
        if str(file_upload.user_id) != str(current_user.id) and not current_user.is_admin:
            return {
                "success": False,
                "error": "Not authorized",
                "file_id": file_id,
                "file_user_id": file_upload.user_id,
                "current_user_id": str(current_user.id)
            }
        
        # Check file existence
        file_exists = os.path.exists(file_upload.file_path)
        file_size = os.path.getsize(file_upload.file_path) if file_exists else 0
        
        return {
            "success": True,
            "file": {
                "id": str(file_upload.id),
                "filename": file_upload.filename,
                "original_name": file_upload.original_name,
                "file_path": file_upload.file_path,
                "file_size": file_upload.file_size,
                "mime_type": file_upload.mime_type,
                "user_id": file_upload.user_id,
                "exists_on_disk": file_exists,
                "actual_size": file_size,
                "current_working_dir": os.getcwd()
            }
        }
        
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in test_file_access: {str(e)}"
        )

@router.get("/debug/files")
async def debug_files(current_user: User = Depends(get_current_active_user)):
    """Debug endpoint to list all files for the current user."""
    try:
        files = await FileUpload.find({"user_id": str(current_user.id)}).to_list()
        return {
            "success": True,
            "files": [
                {
                    "id": str(f.id),
                    "filename": f.filename,
                    "original_name": f.original_name,
                    "file_path": f.file_path,
                    "file_size": f.file_size,
                    "mime_type": f.mime_type,
                    "exists_on_disk": os.path.exists(f.file_path) if f.file_path else False
                }
                for f in files
            ]
        }
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in debug_files: {str(e)}"
        )

@router.get("/view/{file_id}")
async def view_file(
    file_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get file information for viewing."""
    
    try:
        # Find the file
        file_upload = await FileUpload.get(file_id)
        if not file_upload:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Check if user owns the file or is admin
        if str(file_upload.user_id) != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this file"
            )
        
        # Return file information
        return {
            "success": True,
            "file": {
                "id": str(file_upload.id),
                "filename": file_upload.filename,
                "original_name": file_upload.original_name,
                "file_path": file_upload.file_path,
                "file_size": file_upload.file_size,
                "mime_type": file_upload.mime_type,
                "folder_name": file_upload.folder_name,
                "upload_status": file_upload.upload_status,
                "created_at": file_upload.created_at.isoformat(),
                "updated_at": file_upload.updated_at.isoformat() if file_upload.updated_at else None,
                "user_id": file_upload.user_id,
                "preview_url": f"/api/v1/files/serve/{file_id}" if file_upload.mime_type.startswith('image/') else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error viewing file: {str(e)}"
        )


# Temporarily removed to fix routing issue
# @router.get("/{file_id}")
# async def get_file(
#     file_id: str,
#     current_user: User = Depends(get_current_active_user)
# ):
#     """Get specific file information."""
#     pass


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Delete a file (only the file owner or admin can delete)."""
    
    try:
        # First, try to find the file by ID without ObjectId conversion
        
        # Try multiple approaches to find the file
        file_upload = None
        
        # Approach 1: Try as ObjectId
        try:
            from bson import ObjectId
            object_id = ObjectId(file_id)
            file_upload = await FileUpload.get(object_id)
            if file_upload:
                pass # Found file using ObjectId
        except Exception as e:
            pass # ObjectId conversion failed
        
        # Approach 2: Try as string ID
        if not file_upload:
            try:
                file_upload = await FileUpload.get(file_id)
                if file_upload:
                    pass # Found file using string ID
            except Exception as e:
                pass # String ID lookup failed
        
        # Approach 3: Search by filename or original_name
        if not file_upload:
            files = await FileUpload.find(
                FileUpload.user_id == str(current_user.id)
            ).to_list()
            
            for f in files:
                if str(f.id) == file_id or f.filename == file_id or f.original_name == file_id:
                    file_upload = f
                    break
        
        if not file_upload:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Check if user owns the file or is admin
        if str(file_upload.user_id) != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this file"
            )
        
        # Check if file exists on disk
        file_exists_on_disk = os.path.exists(file_upload.file_path)
        
        # Delete file from disk if it exists
        if file_exists_on_disk:
            try:
                os.remove(file_upload.file_path)
            except Exception as disk_error:
                # Continue with database deletion even if disk deletion fails
                pass
        else:
            pass # File not found on disk
        
        # Delete database record
        try:
            await file_upload.delete()
        except Exception as db_error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error deleting file record: {str(db_error)}"
            )
        
        return {
            "success": True,
            "message": "File deleted successfully",
            "deletedFile": {
                "id": str(file_upload.id),
                "originalName": file_upload.original_name,
                "filename": file_upload.filename,
                "existedOnDisk": file_exists_on_disk
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting file: {str(e)}"
        )


@router.delete("/folder/{folder_name}")
async def delete_folder(
    folder_name: str,
    current_user: User = Depends(get_current_active_user)
):
    """Delete all files in a folder (only the folder owner or admin can delete)."""
    
    try:
        # Get all files in the folder for this user
        files = await FileUpload.find(
            FileUpload.user_id == str(current_user.id),
            FileUpload.folder_name == folder_name
        ).to_list()
        
        if not files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found or empty"
            )
        
        deleted_files = []
        deleted_count = 0
        
        for file_upload in files:
            try:
                # Delete file from disk
                if os.path.exists(file_upload.file_path):
                    os.remove(file_upload.file_path)
                
                # Delete database record
                await file_upload.delete()
                deleted_count += 1
                
                deleted_files.append({
                    "id": str(file_upload.id),
                    "originalName": file_upload.original_name,
                    "filename": file_upload.filename
                })
                
            except Exception as e:
                continue
        
        if deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete any files from the folder"
            )
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} files from folder '{folder_name}'",
            "deletedFiles": deleted_files,
            "totalDeleted": deleted_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting folder: {str(e)}"
        ) 