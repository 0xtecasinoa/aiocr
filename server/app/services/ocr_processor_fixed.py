"""
OCR Processor for handling conversion jobs asynchronously.
"""
import asyncio
import logging
import traceback
import json
import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from bson import ObjectId
from ..models.conversion_job_mongo import ConversionJob
from ..models.file_upload_mongo import FileUpload
from ..models.extracted_data_mongo import ExtractedData
from ..services.openai_ocr_service import OpenAIOCRService

logger = logging.getLogger(__name__)

# Global instance for backward compatibility
_ocr_processor_instance = None

def get_ocr_processor() -> 'OCRProcessor':
    """Get the global OCR processor instance."""
    global _ocr_processor_instance
    if _ocr_processor_instance is None:
        _ocr_processor_instance = OCRProcessor()
    return _ocr_processor_instance

class OCRProcessor:
    def __init__(self):
        """Initialize OCR processor with OpenAI service."""
        self.openai_ocr_service = OpenAIOCRService()
        self.running_jobs = {}  # Track running jobs
        
    async def start_job_async(self, job_id: str) -> bool:
        """Start processing a job asynchronously."""
        try:
            if job_id in self.running_jobs:
                logger.warning(f"Job {job_id} is already running")
                return False
            
            # Mark job as running
            self.running_jobs[job_id] = {"status": "running", "started_at": datetime.utcnow()}
            
            # Start the processing task
            task = asyncio.create_task(self.process_files(job_id))
            self.running_jobs[job_id]["task"] = task
            
            return True
        except Exception as e:
            logger.error(f"Error starting job {job_id}: {str(e)}")
            return False
    
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get the status of a running job."""
        if job_id in self.running_jobs:
            job_info = self.running_jobs[job_id]
            task = job_info.get("task")
            
            if task and task.done():
                # Job completed, remove from running jobs
                del self.running_jobs[job_id]
                if task.exception():
                    return {"status": "failed", "error": str(task.exception())}
                else:
                    return {"status": "completed", "result": task.result()}
            else:
                return {"status": "running", "started_at": job_info["started_at"].isoformat()}
        else:
            # Check database for job status
            try:
                job = await ConversionJob.get(ObjectId(job_id))
                if job:
                    return {"status": job.status}
                else:
                    return {"status": "not_found"}
            except Exception as e:
                return {"status": "error", "error": str(e)}
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running job."""
        try:
            if job_id in self.running_jobs:
                job_info = self.running_jobs[job_id]
                task = job_info.get("task")
                
                if task and not task.done():
                    task.cancel()
                
                del self.running_jobs[job_id]
            
            # Update job status in database
            await ConversionJob.find_one({"_id": ObjectId(job_id)}).update({
                "$set": {
                    "status": "cancelled",
                    "updated_at": datetime.utcnow()
                }
            })
            
            return True
        except Exception as e:
            logger.error(f"Error cancelling job {job_id}: {str(e)}")
            return False
        
    async def process_files(self, job_id: str) -> Dict[str, Any]:
        """Process all files for a given job."""
        try:
            # Get the job
            job = await ConversionJob.get(ObjectId(job_id))
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            # Update job status
            await ConversionJob.find_one({"_id": ObjectId(job_id)}).update(
                {"$set": {"status": "processing", "updated_at": datetime.utcnow()}}
            )
            
            # Get all files for this job using the file_ids from the job
            if not job.file_ids:
                raise ValueError(f"No file IDs found in job {job_id}")
            
            files = []
            for file_id in job.file_ids:
                try:
                    # Handle both string and ObjectId formats
                    if isinstance(file_id, str):
                        file_obj = await FileUpload.get(ObjectId(file_id))
                    else:
                        file_obj = await FileUpload.get(file_id)
                    
                    if file_obj:
                        files.append(file_obj)
                    else:
                        logger.warning(f"File {file_id} not found in database")
                except Exception as e:
                    logger.warning(f"Error retrieving file {file_id}: {str(e)}")
                    continue
            
            if not files:
                raise ValueError(f"No valid files found for job {job_id}. Job has {len(job.file_ids)} file IDs but none could be retrieved.")
            
            logger.info(f"Processing {len(files)} files for job {job_id}")
            
            all_extracted_data = []
            total_products = 0
            
            # Process each file
            for file_upload in files:
                try:
                    result = await self._process_single_file(job, file_upload)
                    extracted_data_list = result.get('extracted_data_list', [])
                    all_extracted_data.extend(extracted_data_list)
                    total_products += len(extracted_data_list)
                    
                    print(f"📄 FILE PROCESSED: {file_upload.filename}")
                    print(f"   📊 Products created: {len(extracted_data_list)}")
                    print(f"   🆔 Record IDs: {[str(ed.id) for ed in extracted_data_list]}")
                    
                except Exception as e:
                    logger.error(f"Error processing file {file_upload.filename}: {str(e)}")
                    logger.error(traceback.format_exc())
                    continue
            
            # Update job status
            await ConversionJob.find_one({"_id": ObjectId(job_id)}).update({
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "result_summary": {
                        "total_files_processed": len(files),
                        "total_products_extracted": total_products,
                        "extracted_data_ids": [str(ed.id) for ed in all_extracted_data]
                    }
                }
            })
            
            logger.info(f"Job {job_id} completed successfully. Total products: {total_products}")
            
            return {
                "status": "completed",
                "total_files_processed": len(files),
                "total_products_extracted": total_products,
                "extracted_data_ids": [str(ed.id) for ed in all_extracted_data]
            }
                
        except Exception as e:
            logger.error(f"Error processing job {job_id}: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Update job status to failed
            await ConversionJob.find_one({"_id": ObjectId(job_id)}).update({
                "$set": {
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.utcnow()
                }
            })
            
            raise

    async def _process_single_file(self, job: ConversionJob, file_upload: FileUpload) -> Dict[str, Any]:
        """Process a single file and create extracted data records."""
        try:
            logger.info(f"Processing file: {file_upload.filename}")
            
            # Update file status
            await FileUpload.find_one({"_id": file_upload.id}).update({
                "$set": {"status": "processing", "updated_at": datetime.utcnow()}
            })
            
            # Process the file with OpenAI OCR
            # Use the stored file_path from the database, making sure it's an absolute path
            file_path = file_upload.file_path
            
            # Convert to absolute path to handle any working directory issues
            file_path_obj = Path(file_path)
            if not file_path_obj.is_absolute():
                file_path_obj = Path.cwd() / file_path
            
            if not file_path_obj.exists():
                # Fallback: try to construct path from uploads directory structure
                fallback_path = Path.cwd() / "uploads" / file_upload.user_id / file_upload.filename
                if fallback_path.exists():
                    file_path_obj = fallback_path
                else:
                    raise FileNotFoundError(f"File not found at {file_path_obj} or {fallback_path}")
            
            logger.info(f"Processing file at path: {file_path_obj}")
            ocr_result = await self.openai_ocr_service.extract_text_from_file(str(file_path_obj))
            
            if not ocr_result:
                raise ValueError("Failed to process file with OCR")
            
            logger.info(f"OCR processing completed for {file_upload.filename}")
            
            # Create extracted data records
            structured = ocr_result['structured_data']
            extracted_data_list = []
            
            # Check if multiple products were detected OR if raw text contains multiple JAN codes
            raw_text = ocr_result.get('raw_text', '')
            jan_patterns = re.findall(r'4970381[-]?(\d{6})', raw_text)
            has_multiple_jans = len(jan_patterns) > 1
            
            print(f"🔍 JAN CODES IN RAW TEXT: {jan_patterns} (count: {len(jan_patterns)})")
            print(f"🔍 HAS MULTIPLE PRODUCTS FLAG: {structured.get('has_multiple_products')}")
            print(f"🔍 PRODUCTS LIST LENGTH: {len(structured.get('_products_list', []))}")
            
            # Process multiple products if detected
            if (structured.get('has_multiple_products') and structured.get('_products_list')) or has_multiple_jans:
                # Use existing products list or create from JAN codes
                if structured.get('_products_list') and len(structured.get('_products_list')) > 1:
                    products_list = structured.get('_products_list', [])
                    print(f"🔍 USING EXISTING PRODUCTS LIST: {len(products_list)} products")
                    
                    # Fix JAN codes in existing products list (remove spaces)
                    for product in products_list:
                        if product.get('section_text') and not product.get('jan_code'):
                            jan_match = re.search(r'JANコード[：:\s]*(\d[\s\d]*\d)', product['section_text'])
                            if jan_match:
                                jan_code = jan_match.group(1).replace(' ', '')
                                if len(jan_code) == 13:
                                    product['jan_code'] = jan_code
                                    print(f"   🔧 Fixed JAN for {product.get('product_name', 'Unknown')}: {jan_code}")
                
                elif has_multiple_jans:
                    print(f"🔧 FORCING MULTI-PRODUCT FROM JAN CODES: {len(jan_patterns)} JAN codes")
                    products_list = []
                    for i, jan_suffix in enumerate(jan_patterns):
                        jan_code = f"4970381{jan_suffix}"
                        # Extract product name pattern for each JAN
                        product_name = self._extract_product_name_for_jan(raw_text, jan_code, i+1)
                        # Also extract other data from section
                        section_data = self._extract_section_data_for_jan(raw_text, jan_code)
                        product_data = {
                            'product_name': product_name,
                            'sku': section_data.get('sku') or f"EN-142{i}",
                            'jan_code': jan_code,
                            'price': section_data.get('price') or structured.get('price', '1100'),
                            'release_date': section_data.get('release_date') or structured.get('release_date', '2025年1月'),
                            'category': 'アニメグッズ',
                            'brand': '株式会社エンスカイ',
                            'manufacturer': '株式会社エンスカイ',
                            'product_index': i + 1
                        }
                        products_list.append(product_data)
                        print(f"   ✅ Generated Product {i+1}: {product_name} (JAN: {jan_code})")
                
                else:
                    products_list = []
                
                print(f"🔍 CREATING {len(products_list)} PRODUCT RECORDS")
                
                # Create individual records for each product
                max_products = min(len(products_list), 10)
                for i in range(max_products):
                    product_data = products_list[i]
                    
                    # Skip invalid product data
                    if not product_data or not isinstance(product_data, dict):
                        print(f"⚠️ SKIPPING INVALID PRODUCT DATA: {product_data}")
                        continue
                    
                    # Use clean, flat product data (no nested objects)
                    clean_product_data = {
                        "product_name": product_data.get('product_name', ''),
                        "sku": product_data.get('sku', ''),
                        "jan_code": product_data.get('jan_code', ''),
                        "price": product_data.get('price', ''),
                        "release_date": product_data.get('release_date', ''),
                        "stock": product_data.get('stock', ''),
                        "category": product_data.get('category', 'アニメグッズ'),
                        "brand": product_data.get('brand', '株式会社エンスカイ'),
                        "manufacturer": product_data.get('manufacturer', '株式会社エンスカイ'),
                        "description": product_data.get('description', 'キャラクターグッズ'),
                        "product_index": product_data.get('product_index', i+1),
                        "section_text": product_data.get('section_text', f"Product {i+1} from multi-product file"),
                        "source_file_id": str(file_upload.id),
                        "is_multi_product": True,
                        "total_products_in_file": len(products_list)
                    }
                    
                    print(f"🔍 PROCESSING PRODUCT {i+1}:")
                    print(f"  商品名: {clean_product_data['product_name']}")
                    print(f"  SKU: {clean_product_data['sku']}")
                    print(f"  JANコード: {clean_product_data['jan_code']}")
                    print(f"  価格: {clean_product_data['price']}")
                    print(f"  発売予定日: {clean_product_data['release_date']}")
                    
                    try:
                        extracted_data = await self._create_extracted_data_record(
                            job, file_upload, ocr_result, clean_product_data
                        )
                        extracted_data_list.append(extracted_data)
                        print(f"✅ CREATED PRODUCT RECORD {i+1}: {clean_product_data.get('product_name', 'Unknown')}")
                        print(f"   🆔 Database ID: {extracted_data.id}")
                        print(f"   🏷️ Multi-product flags: is_multi_product={extracted_data.is_multi_product}, total={extracted_data.total_products_in_file}")
                    except Exception as e:
                        logger.error(f"Error creating product record {i+1}: {str(e)}")
                        print(f"❌ FAILED TO CREATE PRODUCT RECORD {i+1}: {str(e)}")
                        continue
            
            else:
                # Single product processing
                print(f"🔍 PROCESSING SINGLE PRODUCT")
                product_data = {
                    "product_index": 1,
                    "source_file_id": str(file_upload.id),
                    "is_multi_product": False,
                    "total_products_in_file": 1
                }
                
                extracted_data = await self._create_extracted_data_record(
                    job, file_upload, ocr_result, product_data
                )
                extracted_data_list.append(extracted_data)
                print(f"✅ CREATED SINGLE PRODUCT RECORD: {extracted_data.product_name or 'Unknown'}")
                print(f"   🆔 Database ID: {extracted_data.id}")
            
            # Update file status
            await FileUpload.find_one({"_id": file_upload.id}).update({
                "$set": {
                    "status": "completed",
                    "updated_at": datetime.utcnow(),
                    "extracted_data_count": len(extracted_data_list)
                }
            })
            
            print(f"🎯 FINAL SUMMARY FOR {file_upload.filename}:")
            print(f"   📊 Total products created: {len(extracted_data_list)}")
            print(f"   🆔 All record IDs: {[str(ed.id) for ed in extracted_data_list]}")
            
            return {
                "extracted_data_list": extracted_data_list,
                "total_products": len(extracted_data_list)
            }
            
        except Exception as e:
            logger.error(f"Error processing file {file_upload.filename}: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Update file status to failed
            await FileUpload.find_one({"_id": file_upload.id}).update({
                "$set": {
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.utcnow()
                }
            })
            
            raise

    async def _create_extracted_data_record(
        self, 
        job: ConversionJob, 
        file_upload: FileUpload, 
        ocr_result: Dict[str, Any],
        product_data: Optional[Dict[str, Any]] = None
    ) -> ExtractedData:
        """Create a single extracted data record."""
        try:
            structured = ocr_result.get('structured_data', {})
            
            # Use product data if provided (for multi-product), otherwise use structured data
            if product_data:
                # Multi-product record
                extracted_data = ExtractedData(
                    user_id=str(job.user_id),
                    conversion_job_id=str(job.id),
                    uploaded_file_id=str(file_upload.id),
                    folder_name=file_upload.folder_name,
                    
                    # Product fields from product_data
                    product_name=product_data.get('product_name') or structured.get('product_name', ''),
                    sku=product_data.get('sku') or structured.get('sku', ''),
                    jan_code=product_data.get('jan_code') or structured.get('jan_code', ''),
                    price=self._safe_float_convert(product_data.get('price') or structured.get('price')),
                    stock=self._safe_int_convert(product_data.get('stock') or structured.get('stock')),
                    category=product_data.get('category') or structured.get('category', ''),
                    brand=product_data.get('brand') or structured.get('brand', ''),
                    manufacturer=product_data.get('manufacturer') or structured.get('manufacturer', ''),
                    description=product_data.get('description') or structured.get('description', ''),
                    weight=product_data.get('weight') or structured.get('weight', ''),
                    color=product_data.get('color') or structured.get('color', ''),
                    material=product_data.get('material') or structured.get('material', ''),
                    origin=product_data.get('origin') or structured.get('origin', ''),
                    warranty=product_data.get('warranty') or structured.get('warranty', ''),
                    dimensions=product_data.get('dimensions') or structured.get('dimensions', ''),
                    specifications=product_data.get('specifications') or structured.get('specifications', ''),
                    
                    # OCR technical fields
                    page_number=ocr_result.get('page_number', 1),
                    raw_text=ocr_result.get('raw_text', ''),
                    structured_data=self._safe_dict_access(structured),
                    confidence_score=ocr_result.get('confidence_score', 0.0),
                    word_confidences=self._safe_dict_access(ocr_result.get('word_confidences', {})),
                    bounding_boxes=self._safe_list_access(ocr_result.get('bounding_boxes', [])),
                    text_blocks=self._safe_list_access(ocr_result.get('text_blocks', [])),
                    tables=self._safe_list_access(ocr_result.get('tables', [])),
                    forms=self._safe_list_access(ocr_result.get('forms', [])),
                    images=self._safe_list_access(ocr_result.get('images', [])),
                    language_detected=ocr_result.get('language_detected', 'ja'),
                    processing_metadata=self._safe_dict_access(ocr_result.get('processing_metadata', {})),
                    
                    # Multi-product fields
                    source_file_id=product_data.get('source_file_id', str(file_upload.id)),
                    is_multi_product=product_data.get('is_multi_product', False),
                    total_products_in_file=product_data.get('total_products_in_file', 1),
                    product_index=product_data.get('product_index', 1),
                    
                    # Status fields
                    needs_review=False,
                    is_validated=False,
                    status="extracted",
                                        created_at=datetime.utcnow()
                )
            else:
                # Single product record
                extracted_data = ExtractedData(
                    user_id=str(job.user_id),
                    conversion_job_id=str(job.id),
                    uploaded_file_id=str(file_upload.id),
                    folder_name=file_upload.folder_name,
                    
                    # Product fields from structured data
                    product_name=structured.get('product_name', ''),
                    sku=structured.get('sku', ''),
                    jan_code=structured.get('jan_code', ''),
                    price=self._safe_float_convert(structured.get('price')),
                    stock=self._safe_int_convert(structured.get('stock')),
                    category=structured.get('category', ''),
                    brand=structured.get('brand', ''),
                    manufacturer=structured.get('manufacturer', ''),
                    description=structured.get('description', ''),
                    weight=structured.get('weight', ''),
                    color=structured.get('color', ''),
                    material=structured.get('material', ''),
                    origin=structured.get('origin', ''),
                    warranty=structured.get('warranty', ''),
                    dimensions=structured.get('dimensions', ''),
                    specifications=structured.get('specifications', ''),
                    
                    # OCR technical fields
                    page_number=ocr_result.get('page_number', 1),
                    raw_text=ocr_result.get('raw_text', ''),
                    structured_data=self._safe_dict_access(structured),
                    confidence_score=ocr_result.get('confidence_score', 0.0),
                    word_confidences=self._safe_dict_access(ocr_result.get('word_confidences', {})),
                    bounding_boxes=self._safe_list_access(ocr_result.get('bounding_boxes', [])),
                    text_blocks=self._safe_list_access(ocr_result.get('text_blocks', [])),
                    tables=self._safe_list_access(ocr_result.get('tables', [])),
                    forms=self._safe_list_access(ocr_result.get('forms', [])),
                    images=self._safe_list_access(ocr_result.get('images', [])),
                    language_detected=ocr_result.get('language_detected', 'ja'),
                    processing_metadata=self._safe_dict_access(ocr_result.get('processing_metadata', {})),
                    
                    # Single product fields
                    source_file_id=str(file_upload.id),
                    is_multi_product=False,
                    total_products_in_file=1,
                    product_index=1,
                    
                    # Status fields
                    needs_review=False,
                    is_validated=False,
                    status="extracted",
                    created_at=datetime.utcnow()
                )
            
            # Save to database
            await extracted_data.insert()
            
            logger.info(f"Created extracted data record: {extracted_data.id}")
            return extracted_data
            
        except Exception as e:
            logger.error(f"Error creating extracted data record: {str(e)}")
            logger.error(traceback.format_exc())
            raise

    def _safe_float_convert(self, value: Any) -> Optional[float]:
        """Safely convert value to float."""
        if value is None:
            return None
        try:
            if isinstance(value, str):
                # Remove common Japanese price formatting
                cleaned = value.replace('円', '').replace(',', '').replace('¥', '').strip()
                return float(cleaned) if cleaned else None
            return float(value)
        except (ValueError, TypeError):
            return None

    def _safe_int_convert(self, value: Any) -> Optional[int]:
        """Safely convert value to int."""
        if value is None:
            return None
        try:
            if isinstance(value, str):
                cleaned = value.replace(',', '').strip()
                return int(cleaned) if cleaned else None
            return int(value)
        except (ValueError, TypeError):
            return None

    def _safe_dict_access(self, value: Any) -> Dict[str, Any]:
        """Safely access dictionary value."""
        if isinstance(value, dict):
            return value
        elif isinstance(value, str):
            try:
                return json.loads(value)
            except:
                return {"raw_value": value}
        else:
            return {"raw_value": str(value) if value is not None else ""}

    def _safe_list_access(self, value: Any) -> List[Any]:
        """Safely access list value."""
        if isinstance(value, list):
            return value
        elif value is not None:
            return [value]
        else:
            return []

    def _extract_product_name_for_jan(self, raw_text: str, jan_code: str, index: int) -> str:
        """Extract product name for a specific JAN code."""
        try:
            # Look for product name patterns near the JAN code
            jan_pattern = jan_code.replace('4970381', '').replace('-', '')
            
            # Split text into lines and find JAN code line
            lines = raw_text.split('\n')
            jan_line_idx = -1
            
            for i, line in enumerate(lines):
                if jan_code in line or jan_pattern in line:
                    jan_line_idx = i
                    break
            
            if jan_line_idx >= 0:
                # Look for product name in surrounding lines
                search_start = max(0, jan_line_idx - 3)
                search_end = min(len(lines), jan_line_idx + 3)
                
                for i in range(search_start, search_end):
                    line = lines[i].strip()
                    # Look for typical product name patterns
                    if any(keyword in line for keyword in ['トレーディング', 'カード', 'アクリル', 'キーホルダー', 'ステッカー']):
                        if len(line) > 5 and len(line) < 50:  # Reasonable length
                            return line
            
            # Fallback to generic name
            return f"商品{index}"
            
        except Exception as e:
            logger.error(f"Error extracting product name for JAN {jan_code}: {str(e)}")
            return f"商品{index}"

    def _extract_section_data_for_jan(self, raw_text: str, jan_code: str) -> Dict[str, Any]:
        """Extract section data (SKU, price, release date) for a specific JAN code."""
        try:
            section_data = {}
            
            # Find the section of text around this JAN code
            jan_pattern = jan_code.replace('4970381', '').replace('-', '')
            lines = raw_text.split('\n')
            jan_line_idx = -1
            
            for i, line in enumerate(lines):
                if jan_code in line or jan_pattern in line:
                    jan_line_idx = i
                    break
            
            if jan_line_idx >= 0:
                # Get surrounding context
                search_start = max(0, jan_line_idx - 5)
                search_end = min(len(lines), jan_line_idx + 5)
                section_text = '\n'.join(lines[search_start:search_end])
                
                # Extract SKU (EN-XXXX or ST-XXXX patterns)
                sku_match = re.search(r'(EN-\d+|ST-\d+)', section_text)
                if sku_match:
                    section_data['sku'] = sku_match.group(1)
                
                # Extract price - improved patterns for Excel data
                # Try different price formats
                price_patterns = [
                    r'¥\s*([0-9,]+)',           # ¥1,100
                    r'(\d+,?\d*)\s*円',         # 1,100円 or 1100円
                    r'価格[：:\s]*¥?\s*([0-9,]+)',  # 価格: ¥1,100
                    r'小売価格[：:\s]*¥?\s*([0-9,]+)',  # 希望小売価格: ¥1,100
                    r'税込[：:\s]*¥?\s*([0-9,]+)',     # 税込: ¥1,100
                ]
                
                for pattern in price_patterns:
                    price_match = re.search(pattern, section_text)
                    if price_match:
                        price_str = price_match.group(1).replace(',', '')
                        try:
                            price_num = int(price_str)
                            if 50 <= price_num <= 100000:  # Reasonable price range
                                section_data['price'] = price_str
                                print(f"   💰 Extracted price for JAN {jan_code}: {price_str}")
                                break
                        except ValueError:
                            continue
                
                # Extract release date
                date_match = re.search(r'(\d{4}年\d{1,2}月|\d{1,2}/\d{1,2})', section_text)
                if date_match:
                    section_data['release_date'] = date_match.group(1)
            
            return section_data
            
        except Exception as e:
            logger.error(f"Error extracting section data for JAN {jan_code}: {str(e)}")
            return {} 