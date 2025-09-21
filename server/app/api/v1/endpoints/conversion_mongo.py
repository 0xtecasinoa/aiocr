from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
import uuid
import os
import logging

logger = logging.getLogger(__name__)

from app.api.v1.endpoints.auth_mongo import get_current_active_user
from app.models.user_mongo import User
from app.models.conversion_job_mongo import ConversionJob
from app.models.file_upload_mongo import FileUpload
from app.services.ocr_processor import get_ocr_processor

router = APIRouter()


@router.post("/start")
async def start_conversion(
    conversion_data: dict,
    current_user: User = Depends(get_current_active_user)
):
    """Start a new conversion job with real OCR processing."""
    
    try:
        # Get file IDs to process
        file_ids = conversion_data.get("fileIds", [])
        if not file_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No files provided for conversion"
            )
        
        # Validate that all files exist and belong to the user
        valid_file_ids = []
        for file_id in file_ids:
            try:
                file_upload = await FileUpload.get(file_id)
                if file_upload and file_upload.user_id == str(current_user.id):
                    valid_file_ids.append(file_id)
                else:
                    logger.warning(f"File {file_id} not found or doesn't belong to user")
            except Exception as e:
                logger.warning(f"Error validating file {file_id}: {str(e)}")
                continue
        
        if not valid_file_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid files found for conversion"
            )
        
        # Extract OCR settings from conversion data
        ocr_settings = {
            "language": conversion_data.get("language", "jpn+eng"),
            "confidence_threshold": conversion_data.get("confidenceThreshold", 30.0),
            "preprocessing": conversion_data.get("preprocessing", True)
        }
        
        # Create new conversion job
        conversion_job = ConversionJob(
            name=conversion_data.get("name", f"Japanese OCR Job {datetime.now().strftime('%Y%m%d_%H%M%S')}"),
            status="pending",
            progress=0.0,
            file_ids=valid_file_ids,
            user_id=str(current_user.id),
            ocr_language=ocr_settings["language"],
            confidence_threshold=ocr_settings["confidence_threshold"],
            ocr_settings=ocr_settings,
            total_files=len(valid_file_ids),
            processed_files=0,
            created_at=datetime.utcnow()
        )
        
        await conversion_job.save()
        
        # Start OCR processing asynchronously
        job_started = await get_ocr_processor().start_job_async(str(conversion_job.id))
        
        if not job_started:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to start OCR processing"
            )
        
        return {
            "success": True,
            "job": {
                "id": str(conversion_job.id),
                "name": conversion_job.name,
                "status": conversion_job.status,
                "progress": conversion_job.progress,
                "fileIds": conversion_job.file_ids,
                "totalFiles": conversion_job.total_files,
                "processedFiles": conversion_job.processed_files,
                "ocrLanguage": conversion_job.ocr_language,
                "confidenceThreshold": conversion_job.confidence_threshold,
                "userId": conversion_job.user_id,
                "createdAt": conversion_job.created_at.isoformat(),
                "startedAt": None  # Will be set when processing actually starts
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting conversion: {str(e)}"
        )


@router.post("/start-with-folders")
async def start_conversion_with_folders(
    conversion_data: dict,
    current_user: User = Depends(get_current_active_user)
):
    """Start a new conversion job with folder-based processing."""
    
    try:
        # Get folder names to process
        folder_names = conversion_data.get("folderNames", [])
        if not folder_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No folders provided for conversion"
            )
        
        # Get all files from the specified folders
        all_file_ids = []
        folder_files = {}
        
        for folder_name in folder_names:
            # Find all files in this folder for the current user
            files_in_folder = await FileUpload.find(
                FileUpload.user_id == str(current_user.id),
                FileUpload.folder_name == folder_name,
                FileUpload.upload_status == "completed"
            ).to_list()
            
            if files_in_folder:
                folder_file_ids = [str(file.id) for file in files_in_folder]
                folder_files[folder_name] = folder_file_ids
                all_file_ids.extend(folder_file_ids)
            else:
                logger.warning(f"No files found in folder: {folder_name}")
        
        if not all_file_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid files found in the specified folders"
            )
        
        # Extract OCR settings from conversion data
        ocr_settings = {
            "language": conversion_data.get("language", "jpn+eng"),
            "confidence_threshold": conversion_data.get("confidenceThreshold", 30.0),
            "preprocessing": conversion_data.get("preprocessing", True)
        }
        
        # Create conversion job for each folder
        conversion_jobs = []
        
        for folder_name, file_ids in folder_files.items():
            if file_ids:  # Only create job if folder has files
                conversion_job = ConversionJob(
                    name=f"Folder: {folder_name} - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    status="pending",
                    progress=0.0,
                    file_ids=file_ids,
                    user_id=str(current_user.id),
                    folder_name=folder_name,
                    ocr_language=ocr_settings["language"],
                    confidence_threshold=ocr_settings["confidence_threshold"],
                    ocr_settings=ocr_settings,
                    total_files=len(file_ids),
                    processed_files=0,
                    created_at=datetime.utcnow()
                )
                
                await conversion_job.save()
                conversion_jobs.append(conversion_job)
                
                # Start OCR processing asynchronously for this folder
                job_started = await get_ocr_processor().start_job_async(str(conversion_job.id))
                
                if not job_started:
                    logger.error(f"Failed to start OCR processing for folder: {folder_name}")
        
        if not conversion_jobs:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create any conversion jobs"
            )
        
        return {
            "success": True,
            "jobs": [
                {
                    "id": str(job.id),
                    "name": job.name,
                    "status": job.status,
                    "progress": job.progress,
                    "fileIds": job.file_ids,
                    "folderName": job.folder_name,
                    "totalFiles": job.total_files,
                    "processedFiles": job.processed_files,
                    "ocrLanguage": job.ocr_language,
                    "confidenceThreshold": job.confidence_threshold,
                    "userId": job.user_id,
                    "createdAt": job.created_at.isoformat()
                }
                for job in conversion_jobs
            ],
            "totalFolders": len(conversion_jobs),
            "totalFiles": len(all_file_ids)
        }
        
    except Exception as e:
        logger.error(f"Error starting conversion with folders: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting conversion: {str(e)}"
        )


@router.get("/user/{user_id}")
async def get_user_conversion_jobs(
    user_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get all conversion jobs for a specific user."""
    
    # Check if user is requesting their own jobs or is admin
    if str(current_user.id) != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view these jobs"
        )
    
    try:
        jobs = await ConversionJob.find(
            ConversionJob.user_id == user_id
        ).to_list()
        
        # Validate that referenced files still exist
        valid_jobs = []
        for job in jobs:
            if job.file_ids:
                valid_file_ids = []
                for file_id in job.file_ids:
                    try:
                        file_upload = await FileUpload.get(ObjectId(file_id))
                        if file_upload and os.path.exists(file_upload.file_path):
                            valid_file_ids.append(file_id)
                    except Exception:
                        # File doesn't exist or other error, skip it
                        pass
                
                if valid_file_ids:
                    job.file_ids = valid_file_ids
                    valid_jobs.append(job)
        
        return {
            "success": True,
            "jobs": [
                {
                "id": str(job.id),
                "name": job.name,
                "status": job.status,
                "fileIds": job.file_ids,
                "createdAt": job.created_at.isoformat() if job.created_at else None,
                    "updatedAt": job.updated_at.isoformat() if job.updated_at else None,
                    "progress": job.progress,
                    "errorMessage": job.error_message
                }
                for job in valid_jobs
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving conversion jobs: {str(e)}"
        )


@router.get("/")
async def list_conversion_jobs(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user)
):
    """List user's conversion jobs."""
    
    return await get_user_conversion_jobs(str(current_user.id), skip, limit, current_user)


@router.get("/{job_id}")
async def get_conversion_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get specific conversion job details."""
    
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(job_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid job ID format"
            )
        
        # Find the conversion job
        job = await ConversionJob.get(ObjectId(job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversion job not found"
            )
        
        # Check if user owns this job or is admin
        if job.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this conversion job"
            )
        
        # Get real-time status from OCR processor
        processor_status = await get_ocr_processor().get_job_status(job_id)
        is_active = processor_status.get('is_active', False) if processor_status else False
        
        return {
            "id": str(job.id),
            "name": job.name,
            "status": job.status,
            "progress": job.progress,
            "fileIds": job.file_ids,
            "userId": job.user_id,
            "createdAt": job.created_at.isoformat() if job.created_at else None,
            "startedAt": job.started_at.isoformat() if job.started_at else None,
            "completedAt": job.completed_at.isoformat() if job.completed_at else None,
            "errorMessage": getattr(job, 'error_message', None),
            "processedFiles": getattr(job, 'processed_files', 0),
            "totalFiles": getattr(job, 'total_files', len(job.file_ids) if job.file_ids else 0),
            "ocrLanguage": getattr(job, 'ocr_language', 'jpn+eng'),
            "confidenceThreshold": getattr(job, 'confidence_threshold', 30.0),
            "settings": getattr(job, 'ocr_settings', {}),
            "results": getattr(job, 'results', []),
            "isActive": is_active,
            "estimatedTimeRemaining": getattr(job, 'estimated_time_remaining', None)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving conversion job: {str(e)}"
        )


@router.post("/{job_id}/cancel")
async def cancel_conversion_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Cancel a conversion job."""
    
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(job_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid job ID format"
            )
        
        # Find the conversion job
        job = await ConversionJob.get(ObjectId(job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversion job not found"
            )
        
        # Check if user owns this job or is admin
        if job.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this conversion job"
            )
        
        # Check if job can be cancelled
        if job.status in ["completed", "cancelled", "failed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel job with status: {job.status}"
            )
        
        # Cancel the job in the OCR processor if it's running
        await get_ocr_processor().cancel_job(job_id)
        
        # Update job status if not already updated by the processor
        if job.status not in ["cancelled"]:
            await job.update({
                "$set": {
                    "status": "cancelled",
                    "completed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            })
        
        return {"success": True, "message": "Conversion job cancelled successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cancelling conversion job: {str(e)}"
        )


@router.get("/{job_id}/status")
async def get_conversion_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Get conversion job status for polling."""
    
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(job_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid job ID format"
            )
        
        # Find the conversion job
        job = await ConversionJob.get(ObjectId(job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversion job not found"
            )
        
        # Check if user owns this job or is admin
        if job.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this conversion job"
            )
        
        return {
            "id": str(job.id),
            "status": job.status,
            "progress": job.progress,
            "processedFiles": getattr(job, 'processed_files', 0),
            "totalFiles": len(job.file_ids) if job.file_ids else 0,
            "errorMessage": getattr(job, 'error_message', None),
            "estimatedTimeRemaining": getattr(job, 'estimated_time_remaining', None)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting conversion status: {str(e)}"
        )


@router.post("/start-with-files")
async def start_conversion_with_files(
    conversion_data: dict,
    current_user: User = Depends(get_current_active_user)
):
    """Start conversion jobs for individual files."""
    
    try:
        file_ids = conversion_data.get("fileIds", [])
        if not file_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No files provided for conversion"
            )
        
        # Validate that all files exist and belong to the user
        valid_files = []
        for file_id in file_ids:
            try:
                file_upload = await FileUpload.get(file_id)
                if file_upload and file_upload.user_id == str(current_user.id):
                    valid_files.append(file_upload)
                else:
                    logger.warning(f"File {file_id} not found or doesn't belong to user")
            except Exception as e:
                logger.warning(f"Error validating file {file_id}: {str(e)}")
                continue
        
        if not valid_files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid files found for conversion"
            )
        
        # Extract OCR settings
        ocr_settings = {
            "language": conversion_data.get("language", "jpn+eng"),
            "confidence_threshold": conversion_data.get("confidenceThreshold", 30.0),
            "preprocessing": conversion_data.get("preprocessing", True)
        }
        
        # Create conversion jobs for individual files
        created_jobs = []
        
        for file_upload in valid_files:
            conversion_job = ConversionJob(
                name=f"File: {file_upload.original_name} - {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                status="pending",
                progress=0.0,
                file_ids=[str(file_upload.id)],
                user_id=str(current_user.id),
                folder_name=None,  # Individual file
                ocr_language=ocr_settings["language"],
                confidence_threshold=ocr_settings["confidence_threshold"],
                ocr_settings=ocr_settings,
                total_files=1,
                processed_files=0,
                created_at=datetime.utcnow()
            )
            
            await conversion_job.save()
            
            # Start OCR processing asynchronously
            job_started = await get_ocr_processor().start_job_async(str(conversion_job.id))
            
            if job_started:
                created_jobs.append({
                    "id": str(conversion_job.id),
                    "name": conversion_job.name,
                    "status": conversion_job.status,
                    "progress": conversion_job.progress,
                    "fileName": file_upload.original_name,
                    "fileIds": [str(file_upload.id)],
                    "totalFiles": 1,
                    "processedFiles": 0,
                    "ocrLanguage": conversion_job.ocr_language,
                    "confidenceThreshold": conversion_job.confidence_threshold,
                    "userId": conversion_job.user_id,
                    "createdAt": conversion_job.created_at.isoformat()
                })
        
        if not created_jobs:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create any conversion jobs"
            )
        
        return {
            "success": True,
            "totalFiles": len(created_jobs),
            "jobs": created_jobs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in start_conversion_with_files: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        ) 

@router.delete("/{job_id}")
async def delete_conversion_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Delete a conversion job and its associated data."""
    
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(job_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid job ID format"
            )
        
        # Find the conversion job
        job = await ConversionJob.get(ObjectId(job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversion job not found"
            )
        
        # Check if user owns this job or is admin
        if job.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this conversion job"
            )
        
        # Cancel the job if it's currently running
        if job.status in ["pending", "processing"]:
            await get_ocr_processor().cancel_job(job_id)
        
        # Delete associated extracted data
        try:
            from app.models.extracted_data_mongo import ExtractedData
            await ExtractedData.find(ExtractedData.conversion_job_id == job_id).delete()
        except Exception as e:
            logger.warning(f"Could not delete extracted data for job {job_id}: {str(e)}")
        
        # Delete the conversion job
        await job.delete()
        
        return {
            "success": True, 
            "message": "Conversion job deleted successfully",
            "deletedJobId": job_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting conversion job: {str(e)}"
        )


@router.delete("/user/{user_id}/bulk")
async def delete_user_conversion_jobs(
    user_id: str,
    job_ids: List[str] = None,
    delete_all: bool = False,
    current_user: User = Depends(get_current_active_user),
    request: Request = None
):
    """Delete multiple conversion jobs for a user."""
    
    try:
        # Check if user is authorized
        if str(current_user.id) != user_id and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete these conversion jobs"
            )
        
        deleted_count = 0
        failed_deletions = []
        
        # Try to get job_ids from query parameters if not provided in body
        if not job_ids and request:
            query_params = dict(request.query_params)
            if 'job_ids' in query_params:
                # Handle multiple job_ids in query parameters
                job_ids_param = query_params['job_ids']
                if isinstance(job_ids_param, list):
                    job_ids = job_ids_param
                else:
                    # Split by comma if it's a single string
                    job_ids = job_ids_param.split(',') if ',' in job_ids_param else [job_ids_param]
        
        if delete_all:
            # Delete all jobs for the user
            jobs = await ConversionJob.find(ConversionJob.user_id == user_id).to_list()
            job_ids = [str(job.id) for job in jobs]
        elif job_ids:
            # Validate that all job IDs belong to the user
            for job_id in job_ids:
                if not ObjectId.is_valid(job_id):
                    failed_deletions.append({"job_id": job_id, "error": "Invalid job ID format"})
                    continue
                
                job = await ConversionJob.get(ObjectId(job_id))
                if not job:
                    failed_deletions.append({"job_id": job_id, "error": "Job not found"})
                    continue
                
                if job.user_id != user_id:
                    failed_deletions.append({"job_id": job_id, "error": "Job does not belong to user"})
                    continue
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either job_ids or delete_all must be specified"
            )
        
        # Delete each job
        for job_id in job_ids:
            try:
                if not ObjectId.is_valid(job_id):
                    failed_deletions.append({"job_id": job_id, "error": "Invalid job ID format"})
                    continue
                
                job = await ConversionJob.get(ObjectId(job_id))
                if not job:
                    failed_deletions.append({"job_id": job_id, "error": "Job not found"})
                    continue
                
                # Cancel the job if it's currently running
                if job.status in ["pending", "processing"]:
                    await get_ocr_processor().cancel_job(job_id)
                
                # Delete associated extracted data
                try:
                    from app.models.extracted_data_mongo import ExtractedData
                    await ExtractedData.find(ExtractedData.conversion_job_id == job_id).delete()
                except Exception as e:
                    logger.warning(f"Could not delete extracted data for job {job_id}: {str(e)}")
                
                # Delete the conversion job
                await job.delete()
                deleted_count += 1
                
            except Exception as e:
                failed_deletions.append({"job_id": job_id, "error": str(e)})
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} conversion jobs",
            "deletedCount": deleted_count,
            "failedDeletions": failed_deletions,
            "totalRequested": len(job_ids) if job_ids else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting conversion jobs: {str(e)}"
        )


@router.post("/{job_id}/retry")
async def retry_conversion_job(
    job_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Retry a failed or cancelled conversion job."""
    
    try:
        # Validate ObjectId format
        if not ObjectId.is_valid(job_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid job ID format"
            )
        
        # Find the conversion job
        job = await ConversionJob.get(ObjectId(job_id))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversion job not found"
            )
        
        # Check if user owns this job or is admin
        if job.user_id != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to retry this conversion job"
            )
        
        # Check if job can be retried
        if job.status not in ["failed", "cancelled"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot retry job with status: {job.status}"
            )
        
        # Reset job status
        await job.update({
            "$set": {
                "status": "pending",
                "progress": 0.0,
                "processed_files": 0,
                "error_message": None,
                "started_at": None,
                "completed_at": None,
                "updated_at": datetime.utcnow()
            }
        })
        
        # Start OCR processing asynchronously
        job_started = await get_ocr_processor().start_job_async(job_id)
        
        if not job_started:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to start OCR processing"
            )
        
        return {
            "success": True,
            "message": "Conversion job restarted successfully",
            "jobId": job_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrying conversion job: {str(e)}"
        ) 