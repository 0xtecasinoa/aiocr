"""
OCR Processor for handling conversion jobs asynchronously.
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path


from app.services.openai_ocr_service import OpenAIOCRService
from app.models.conversion_job_mongo import ConversionJob
from app.models.file_upload_mongo import FileUpload
from app.models.extracted_data_mongo import ExtractedData
from app.crud import user_mongo as user_crud
from app.core.config import Settings

logger = logging.getLogger(__name__)


class OCRProcessor:
    """
    OCR Processor for handling conversion jobs asynchronously.
    Supports both image and PDF files.
    """
    
    def __init__(self):
        self.active_jobs: Dict[str, asyncio.Task] = {}
        self.settings = Settings()
        self.openai_ocr_service = None
        
        # Initialize OpenAI OCR service
        try:
            self.openai_ocr_service = OpenAIOCRService()
            if self.openai_ocr_service.client:
                print("🤖 OCR Processor: Using OpenAI GPT-4 Vision for high-accuracy OCR")
            else:
                print("⚠️  OCR Processor: OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.")
        except Exception as e:
            print(f"⚠️  OCR Processor: Failed to initialize OpenAI service: {str(e)}")
            self.openai_ocr_service = None
    
    async def process_conversion_job(self, job_id: str) -> bool:
        """
        Process a conversion job by performing OCR on all associated files.
        
        Args:
            job_id: The MongoDB ObjectId of the conversion job
            
        Returns:
            bool: True if processing completed successfully, False otherwise
        """
        try:
            # Get the conversion job
            job = await ConversionJob.get(job_id)
            if not job:
                logger.error(f"Conversion job {job_id} not found")
                return False
            
            # Mark job as processing
            await job.update({
                "$set": {
                    "status": "processing",
                    "started_at": datetime.utcnow(),
                    "progress": 0,
                    "processed_files": 0,
                    "updated_at": datetime.utcnow()
                }
            })
            
            # Get files to process
            files_to_process = []
            for file_id in job.file_ids:
                try:
                    file_upload = await FileUpload.get(file_id)
                    if file_upload and Path(file_upload.file_path).exists():
                        files_to_process.append(file_upload)
                except Exception as e:
                    logger.warning(f"Could not load file {file_id}: {str(e)}")
                    continue
            
            if not files_to_process:
                await self._mark_job_failed(job, "No valid files found to process")
                return False
            
            # Update total files count
            await job.update({
                "$set": {
                    "total_files": len(files_to_process),
                    "updated_at": datetime.utcnow()
                }
            })
            
            processed_count = 0
            extraction_results = []
            
            for i, file_upload in enumerate(files_to_process):
                try:
                    logger.info(f"Processing file {i+1}/{len(files_to_process)}: {file_upload.original_name}")
                    
                    # Perform OCR on the file
                    ocr_result = await self._process_single_file(file_upload, job)
                    
                    if ocr_result:
                        extraction_results.append(ocr_result)
                        processed_count += 1
                    
                    # Update progress
                    progress = (i + 1) / len(files_to_process) * 100
                    await job.update({
                        "$set": {
                            "progress": round(progress, 2),
                            "processed_files": processed_count,
                            "updated_at": datetime.utcnow()
                        }
                    })
                    
                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Error processing file {file_upload.original_name}: {error_msg}")
                    
                    # Check if it's an API quota error (temporary issue)
                    is_quota_error = "quota" in error_msg.lower() or "429" in error_msg
                    is_rate_limit = "rate" in error_msg.lower() and "limit" in error_msg.lower()
                    
                    if is_quota_error or is_rate_limit:
                        # For quota/rate limit errors, create a pending retry record
                        try:
                            retry_data = ExtractedData(
                                user_id=job.user_id,
                                conversion_job_id=str(job.id),
                                uploaded_file_id=str(file_upload.id),
                                folder_name=job.folder_name,
                                product_name=f"再試行待ち: {file_upload.original_name}",
                                raw_text=f"API制限により処理待ち: {error_msg}",
                                confidence_score=0.0,
                                status="pending_retry",
                                needs_review=True,
                                created_at=datetime.utcnow()
                            )
                            await retry_data.save()
                            logger.info(f"Created retry-pending record for {file_upload.original_name}")
                        except Exception as save_error:
                            logger.error(f"Failed to save retry record: {save_error}")
                    else:
                        # For other errors, create a failed extraction record
                        try:
                            failed_data = ExtractedData(
                                user_id=job.user_id,
                                conversion_job_id=str(job.id),
                                uploaded_file_id=str(file_upload.id),
                                folder_name=job.folder_name,
                                product_name=f"処理失敗: {file_upload.original_name}",
                                raw_text=f"処理エラー: {error_msg}",
                                confidence_score=0.0,
                                status="failed",
                                needs_review=True,
                                created_at=datetime.utcnow()
                            )
                            await failed_data.save()
                            logger.info(f"Created failed extraction record for {file_upload.original_name}")
                        except Exception as save_error:
                            logger.error(f"Failed to save error record: {save_error}")
                    
                    continue
            
            # Complete the job
            if processed_count > 0:
                await self._mark_job_completed(job, extraction_results, processed_count)
                logger.info(f"Job {job_id} completed successfully. Processed {processed_count}/{len(files_to_process)} files")
                return True
            else:
                await self._mark_job_failed(job, "No files were successfully processed")
                return False
                
        except Exception as e:
            logger.error(f"Error processing conversion job {job_id}: {str(e)}")
            try:
                job = await ConversionJob.get(job_id)
                if job:
                    await self._mark_job_failed(job, f"Processing error: {str(e)}")
            except:
                pass
            return False
        finally:
            # Remove from active jobs
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
    
    async def _process_single_file(self, file_upload: FileUpload, job: ConversionJob) -> Optional[Dict[str, Any]]:
        """Process a single file with OCR (supports both images and PDFs)."""
        try:
            # Check if file is supported
            if not self._is_supported_file(file_upload.mime_type, file_upload.original_name):
                logger.warning(f"Skipping unsupported file: {file_upload.original_name}")
                return None
            
            # Perform OCR
            ocr_settings = getattr(job, 'ocr_settings', {})
            language = ocr_settings.get('language', 'jpn+eng')
            confidence_threshold = ocr_settings.get('confidence_threshold', 30.0)
            preprocessing = ocr_settings.get('preprocessing', True)
            
            # Start OCR processing notification
            ocr_method = "OpenAI GPT-4 Vision"
            print(f"\n🚀 STARTING OCR PROCESSING: {file_upload.filename}")
            print(f"   Method: {ocr_method}")
            print(f"   Language: {language}")
            print(f"   Preprocessing: {preprocessing}")
            print(f"   Confidence Threshold: {confidence_threshold}%")
            
            # Use OpenAI OCR service
            if not self.openai_ocr_service or not self.openai_ocr_service.client:
                raise Exception("OpenAI OCR service is not available. Please configure OPENAI_API_KEY.")
            
            ocr_result = await self.openai_ocr_service.extract_text_from_file(
                file_path=file_upload.file_path,
                language=language,
                preprocessing=preprocessing,
                confidence_threshold=confidence_threshold
            )
            
            # Create ExtractedData record with enhanced fields
            structured = ocr_result['structured_data']
            extracted_data = ExtractedData(
                user_id=job.user_id,
                conversion_job_id=str(job.id),
                uploaded_file_id=str(file_upload.id),
                folder_name=job.folder_name,  # Set folder information for proper grouping
                
                # Enhanced product information from OCR
                product_name=structured.get('product_name'),
                sku=structured.get('sku'),
                jan_code=structured.get('jan_code'),
                price=self._safe_convert_to_float(structured.get('price')),
                stock=int(structured.get('stock', 0)) if structured.get('stock') and structured.get('stock').isdigit() else None,
                category=structured.get('category'),
                brand=structured.get('brand'),
                manufacturer=structured.get('manufacturer'),
                description=structured.get('description'),
                weight=structured.get('weight'),
                color=structured.get('color'),
                material=structured.get('material'),
                origin=structured.get('origin'),
                warranty=structured.get('warranty'),
                dimensions=structured.get('dimensions'),
                specifications=structured.get('specifications'),
                
                # OCR technical data
                raw_text=ocr_result['raw_text'],
                structured_data=ocr_result['structured_data'],
                confidence_score=ocr_result['confidence_score'],
                word_confidences=ocr_result['word_confidences'],
                bounding_boxes=ocr_result['bounding_boxes'],
                text_blocks=ocr_result['text_blocks'],
                tables=ocr_result.get('tables', []),
                language_detected=ocr_result['language_detected'],
                processing_metadata=ocr_result['processing_metadata'],
                
                # Status based on confidence and quality assessment
                status="completed" if ocr_result['confidence_score'] >= 70 else "needs_review",
                needs_review=ocr_result['confidence_score'] < 70,
                
                created_at=datetime.utcnow()
            )
            
            await extracted_data.save()
            
            # Console display of OCR extraction results
            print("\n" + "="*80)
            print(f"📄 OCR EXTRACTION RESULTS FOR: {file_upload.filename}")
            print("="*80)
            print(f"🆔 File ID: {extracted_data.id}")
            print(f"👤 User: {job.user_id}")
            print(f"📊 Confidence Score: {extracted_data.confidence_score}%")
            print(f"🌐 Language Detected: {extracted_data.language_detected}")
            print("\n📝 RAW EXTRACTED TEXT:")
            print("-" * 40)
            raw_text_display = extracted_data.raw_text[:500] + "..." if len(extracted_data.raw_text or "") > 500 else (extracted_data.raw_text or "No text extracted")
            print(raw_text_display)
            print("\n🏷️  STRUCTURED PRODUCT DATA:")
            print("-" * 40)
            print(f"Product Name: {extracted_data.product_name or 'Not detected'}")
            print(f"SKU: {extracted_data.sku or 'Not detected'}")
            print(f"JAN Code: {extracted_data.jan_code or 'Not detected'}")
            print(f"Price: {extracted_data.price or 'Not detected'}")
            print(f"Stock: {extracted_data.stock or 'Not detected'}")
            print(f"Category: {extracted_data.category or 'Not detected'}")
            print(f"Brand: {extracted_data.brand or 'Not detected'}")
            print(f"Description: {(extracted_data.description or 'Not detected')[:100]}{'...' if len(extracted_data.description or '') > 100 else ''}")
            
            if extracted_data.word_confidences:
                print(f"\n🔍 WORD CONFIDENCE SAMPLES (Top 10):")
                print("-" * 40)
                if isinstance(extracted_data.word_confidences, dict):
                    # Sort by confidence and show top 10
                    sorted_words = sorted(extracted_data.word_confidences.items(), key=lambda x: x[1], reverse=True)[:10]
                    for word, conf in sorted_words:
                        print(f"  '{word}': {conf}%")
                
            print("="*80 + "\n")
            
            # Return summary for job results
            return {
                "file_id": str(file_upload.id),
                "file_name": file_upload.original_name,
                "extracted_data_id": str(extracted_data.id),
                "confidence": ocr_result['confidence_score'],
                "text_length": len(ocr_result['raw_text']),
                "product_found": bool(ocr_result['structured_data'].get('product_name')),
                "status": extracted_data.status
            }
            
        except Exception as e:
            logger.error(f"Error processing file {file_upload.original_name}: {str(e)}")
            return None
    
    def _safe_convert_to_float(self, value: str) -> Optional[float]:
        """Safely convert string price to float."""
        if not value:
            return None
        try:
            # Remove commas and other formatting
            clean_value = str(value).replace(',', '').replace('¥', '').replace('円', '').strip()
            if clean_value and clean_value.replace('.', '').isdigit():
                return float(clean_value)
        except (ValueError, AttributeError):
            pass
        return None
    
    def _is_supported_file(self, mime_type: str, filename: str) -> bool:
        """Check if the file is a supported format (images, PDFs, or Excel files)."""
        # Check by MIME type
        supported_mimes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 
            'image/bmp', 'image/gif', 'image/webp', 'application/pdf',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
        
        if mime_type.lower() in supported_mimes:
            return True
        
        # Check by file extension as fallback
        file_ext = Path(filename).suffix.lower()
        supported_extensions = ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.webp', '.pdf', '.xls', '.xlsx']
        
        return file_ext in supported_extensions
    
    async def _mark_job_completed(self, job: ConversionJob, extraction_results: List[Dict], processed_count: int):
        """Mark job as completed and create folders."""
        try:
            # Update job status
            await job.update({
                "$set": {
                    "status": "completed",
                    "progress": 100,
                    "processed_files": processed_count,
                    "completed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "extraction_results": extraction_results
                }
            })
            
            # Create folders for organized data display
            await self._create_conversion_folders(job, extraction_results)
            
        except Exception as e:
            logger.error(f"Error marking job as completed: {str(e)}")
    
    async def _mark_job_failed(self, job: ConversionJob, error_message: str):
        """Mark job as failed."""
        try:
            await job.update({
                "$set": {
                    "status": "failed",
                    "error_message": error_message,
                    "completed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            })
        except Exception as e:
            logger.error(f"Error marking job as failed: {str(e)}")
    
    async def _create_conversion_folders(self, job: ConversionJob, extraction_results: List[Dict]):
        """Create organized folders for conversion results."""
        try:
            # Create three main folders for different data types
            folders = {
                "completed": [],  # High confidence, completed data
                "needs_review": [],  # Low confidence, needs manual review
                "failed": []  # Failed conversions
            }
            
            # Categorize results
            for result in extraction_results:
                if result['status'] == 'completed':
                    folders['completed'].append(result)
                elif result['status'] == 'needs_review':
                    folders['needs_review'].append(result)
                else:
                    folders['failed'].append(result)
            
            # Update job with folder information
            await job.update({
                "$set": {
                    "conversion_folders": folders,
                    "updated_at": datetime.utcnow()
                }
            })
            
        except Exception as e:
            logger.error(f"Error creating conversion folders: {str(e)}")
    
    async def start_job(self, job_id: str) -> bool:
        """Start processing a conversion job."""
        if job_id in self.active_jobs:
            logger.warning(f"Job {job_id} is already being processed")
            return False
        
        try:
            # Create async task for job processing
            task = asyncio.create_task(self.process_conversion_job(job_id))
            self.active_jobs[job_id] = task
            
            # Don't await the task here - let it run in background
            return True
            
        except Exception as e:
            logger.error(f"Error starting job {job_id}: {str(e)}")
            return False
        
    async def start_job_async(self, job_id: str) -> bool:
        """Alias for start_job method for backward compatibility."""
        return await self.start_job(job_id)
    
    def get_active_jobs(self) -> List[str]:
        """Get list of currently active job IDs."""
        return list(self.active_jobs.keys())
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get the current status of a job."""
        try:
            job = await ConversionJob.get(job_id)
            if not job:
                return None
            
            return {
                "id": str(job.id),
                "name": job.name,
                "status": job.status,
                "progress": job.progress,
                "processed_files": getattr(job, 'processed_files', 0),
                "total_files": getattr(job, 'total_files', len(job.file_ids)),
                "error_message": getattr(job, 'error_message', None),
                "is_active": job_id in self.active_jobs,
                "conversion_folders": getattr(job, 'conversion_folders', {})
            }
        except Exception as e:
            logger.error(f"Error getting job status for {job_id}: {str(e)}")
            return None
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running conversion job."""
        try:
            # Cancel the async task if it's running
            if job_id in self.active_jobs:
                task = self.active_jobs[job_id]
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
                # Remove from active jobs
                del self.active_jobs[job_id]
            
            # Update the job status in database
            job = await ConversionJob.get(job_id)
            if job and job.status not in ["completed", "cancelled", "failed"]:
                await job.update({
                    "$set": {
                        "status": "cancelled",
                        "completed_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                })
            
            logger.info(f"Job {job_id} cancelled successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error cancelling job {job_id}: {str(e)}")
            return False


# Global OCR processor instance (lazy initialization)
ocr_processor = None

def get_ocr_processor():
    """Get or create the global OCR processor instance."""
    global ocr_processor
    if ocr_processor is None:
        ocr_processor = OCRProcessor()
    return ocr_processor 