"""
OpenAI OCR Service for high-accuracy text extraction using GPT-4 Vision API.
Provides near 100% accuracy for Japanese and English text extraction.
"""

import asyncio
import logging
import base64
import json
from typing import Dict, Any, Optional, List
from pathlib import Path
import re
from PIL import Image
import io
import pandas as pd
from openai import AsyncOpenAI
from app.core.config import Settings

logger = logging.getLogger(__name__)
settings = Settings()


class OpenAIOCRService:
    """High-accuracy OCR service using OpenAI GPT-4 Vision API."""
    
    def __init__(self):
        self.client = None
        self.model = settings.OPENAI_MODEL
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.xls', '.xlsx']
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize OpenAI client with proper error handling."""
        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not set. OpenAI OCR service will not be available.")
            return
        
        try:
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info("OpenAI client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {str(e)}")
            self.client = None
        
    def _encode_image_to_base64(self, image_path: str) -> str:
        """Encode image to base64 for OpenAI API."""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def _optimize_image_for_ocr(self, image_path: str) -> str:
        """Optimize image for better OCR results."""
        try:
            # Open and process image
            with Image.open(image_path) as img:
                # Convert to RGB if needed
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize if too large (OpenAI has size limits)
                max_size = 2048
                if max(img.size) > max_size:
                    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                
                # Save optimized image
                optimized_path = str(Path(image_path).with_suffix('.optimized.jpg'))
                img.save(optimized_path, 'JPEG', quality=95, optimize=True)
                
                return optimized_path
                
        except Exception as e:
            logger.warning(f"Image optimization failed: {str(e)}, using original")
            return image_path
    
    async def extract_text_from_image(
        self,
        image_path: str,
        language: str = "jpn+eng",
        confidence_threshold: float = 30.0
    ) -> Dict[str, Any]:
        """
        Extract text from image using OpenAI GPT-4 Vision API.
        
        Args:
            image_path: Path to the image file
            language: Language hint (jpn+eng for Japanese and English)
            confidence_threshold: Not used for OpenAI (always high confidence)
        
        Returns:
            Dict containing extracted text and metadata
        """
        if not self.client:
            raise Exception("OpenAI client is not initialized. Please check OPENAI_API_KEY configuration.")
        
        try:
            start_time = asyncio.get_event_loop().time()
            
            # Optimize image for better results
            optimized_path = self._optimize_image_for_ocr(image_path)
            
            # Encode image to base64
            base64_image = self._encode_image_to_base64(optimized_path)
            
            # Determine language context
            language_context = ""
            if "jpn" in language.lower():
                language_context = "This image contains Japanese text (hiragana, katakana, kanji). "
            if "eng" in language.lower():
                language_context += "This image contains English text. "
            
            # Create comprehensive OCR prompt for maximum accuracy
            ocr_prompt = f"""
            {language_context}
            
            Please perform high-accuracy OCR (Optical Character Recognition) on this image.
            
            INSTRUCTIONS:
            1. Extract ALL visible text from the image with 100% accuracy
            2. Preserve exact spacing, line breaks, and formatting
            3. Include ALL characters including punctuation, symbols, and special characters
            4. If text is partially obscured or unclear, make your best interpretation
            5. Maintain the original reading order (top to bottom, left to right for mixed languages)
            6. For Japanese text, preserve kanji, hiragana, and katakana exactly as shown
            7. For numbers, prices, codes, preserve exact formatting (including ¥, $, -, etc.)
            
            PRODUCT INFORMATION EXTRACTION:
            After extracting the raw text, also identify and extract these specific product details if visible:
            - Product name/title
            - Brand name
            - Price (including currency symbols)
            - SKU or product code
            - JAN/EAN barcode numbers
            - Quantity or volume information
            - Category or type of product
            - Any special editions or versions
            - Manufacturer information
            - Dimensions or specifications
            
            Please respond in this JSON format:
            {{
                "raw_text": "All extracted text exactly as it appears",
                "confidence_score": 95.0,
                "language_detected": "japanese" or "english" or "mixed",
                "product_info": {{
                    "product_name": "extracted product name",
                    "brand": "extracted brand",
                    "price": "extracted price with currency",
                    "sku": "extracted SKU/code",
                    "jan_code": "extracted JAN/barcode",
                    "category": "inferred product category",
                    "description": "brief product description based on visible text"
                }},
                "word_confidences": {{}},
                "processing_metadata": {{
                    "method": "openai_gpt4_vision",
                    "model": "{self.model}"
                }}
            }}
            """
            
            print(f"🤖 OPENAI OCR: Processing image with {self.model}")
            
            # Call OpenAI Vision API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": ocr_prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                    "detail": "high"  # High detail for better OCR accuracy
                                }
                            }
                        ]
                    }
                ],
                max_tokens=4000,
                temperature=0.1  # Low temperature for consistent, accurate results
            )
            
            # Parse response
            response_text = response.choices[0].message.content
            
            try:
                # Try to parse as JSON first
                if response_text.strip().startswith('{'):
                    result = json.loads(response_text)
                else:
                    # If not JSON, extract JSON from markdown code blocks
                    json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
                    if json_match:
                        result = json.loads(json_match.group(1))
                    else:
                        # Fallback: treat entire response as raw text
                        result = {
                            "raw_text": response_text,
                            "confidence_score": 90.0,
                            "language_detected": "unknown",
                            "product_info": {},
                            "word_confidences": {},
                            "processing_metadata": {"method": "openai_gpt4_vision", "model": self.model}
                        }
                        
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse OpenAI response as JSON: {e}")
                # Fallback to treating response as raw text
                result = {
                    "raw_text": response_text,
                    "confidence_score": 90.0,
                    "language_detected": "unknown", 
                    "product_info": {},
                    "word_confidences": {},
                    "processing_metadata": {"method": "openai_gpt4_vision", "model": self.model}
                }
            
            # Clean up optimized image if it was created
            if optimized_path != image_path:
                try:
                    Path(optimized_path).unlink()
                except:
                    pass
            
            # Calculate processing time
            processing_time_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
            result["processing_time_ms"] = processing_time_ms
            
            # Ensure required fields exist
            result.setdefault("raw_text", "")
            result.setdefault("confidence_score", 95.0)  # OpenAI typically has high confidence
            result.setdefault("language_detected", "unknown")
            result.setdefault("word_confidences", {})
            result.setdefault("bounding_boxes", [])
            result.setdefault("text_blocks", [])
            result.setdefault("structured_data", result.get("product_info", {}))
            
            print(f"✅ OPENAI OCR SUCCESS: Extracted {len(result['raw_text'])} characters in {processing_time_ms}ms")
            
            return result
            
        except Exception as e:
            logger.error(f"OpenAI OCR processing failed: {str(e)}")
            raise ValueError(f"OpenAI OCR processing failed: {str(e)}")
    
    async def extract_text_from_excel(
        self,
        excel_path: str,
        language: str = "jpn+eng",
        confidence_threshold: float = 30.0
    ) -> Dict[str, Any]:
        """
        Extract text from Excel file (.xls/.xlsx) using pandas and OpenAI for structured analysis.
        """
        try:
            start_time = asyncio.get_event_loop().time()
            
            # Read Excel file
            try:
                # Try to read with openpyxl engine for .xlsx files
                if excel_path.endswith('.xlsx'):
                    df = pd.read_excel(excel_path, engine='openpyxl', sheet_name=None)
                else:
                    # Use xlrd for .xls files
                    df = pd.read_excel(excel_path, engine='xlrd', sheet_name=None)
            except Exception as e:
                logger.error(f"Failed to read Excel file: {str(e)}")
                raise ValueError(f"Failed to read Excel file: {str(e)}")
            
            # Process all sheets
            all_text = []
            structured_data = {}
            
            for sheet_name, sheet_df in df.items():
                # Convert DataFrame to text representation
                sheet_text = f"=== Sheet: {sheet_name} ===\n"
                
                # Add column headers
                if not sheet_df.empty:
                    headers = [str(col) for col in sheet_df.columns]
                    sheet_text += "Columns: " + " | ".join(headers) + "\n\n"
                    
                    # Add data rows
                    for idx, row in sheet_df.iterrows():
                        row_text = []
                        for col in sheet_df.columns:
                            cell_value = row[col]
                            if pd.notna(cell_value):
                                row_text.append(str(cell_value))
                            else:
                                row_text.append("")
                        sheet_text += " | ".join(row_text) + "\n"
                
                all_text.append(sheet_text)
                
                # Store structured data for each sheet
                structured_data[sheet_name] = {
                    "columns": list(sheet_df.columns) if not sheet_df.empty else [],
                    "data": sheet_df.to_dict('records') if not sheet_df.empty else [],
                    "row_count": len(sheet_df),
                    "col_count": len(sheet_df.columns) if not sheet_df.empty else 0
                }
            
            # Combine all text
            raw_text = "\n\n".join(all_text)
            
            # Use OpenAI to analyze and extract key information
            analysis_prompt = f"""
            Analyze this Excel file data and extract key information:
            
            {raw_text[:4000]}  # Limit to first 4000 characters to avoid token limits
            
            Please provide:
            1. A summary of what this document contains
            2. Key data points or important information
            3. Any patterns or insights you notice
            4. Structure the response in JSON format
            
            Respond in {language} language context.
            """
            
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an expert data analyst. Analyze Excel data and provide structured insights in JSON format."
                        },
                        {
                            "role": "user",
                            "content": analysis_prompt
                        }
                    ],
                    max_tokens=1000,
                    temperature=0.1
                )
                
                ai_analysis = response.choices[0].message.content
                
                # Try to extract JSON from the response
                try:
                    import json
                    # Look for JSON in the response
                    json_start = ai_analysis.find('{')
                    json_end = ai_analysis.rfind('}') + 1
                    if json_start != -1 and json_end != -1:
                        ai_structured = json.loads(ai_analysis[json_start:json_end])
                    else:
                        ai_structured = {"analysis": ai_analysis}
                except:
                    ai_structured = {"analysis": ai_analysis}
                
            except Exception as e:
                logger.warning(f"OpenAI analysis failed: {str(e)}")
                ai_structured = {"analysis": "Analysis unavailable"}
            
            # Calculate processing time
            processing_time_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
            
            result = {
                "raw_text": raw_text,
                "confidence_score": 95.0,  # Excel parsing is very reliable
                "language_detected": language,
                "word_confidences": {},
                "bounding_boxes": [],
                "text_blocks": [],
                "structured_data": {
                    **structured_data,
                    "ai_analysis": ai_structured,
                    "file_type": "excel",
                    "total_sheets": len(df),
                    "total_text_length": len(raw_text)
                },
                "processing_metadata": {
                    "method": "excel_pandas_openai", 
                    "model": self.model,
                    "sheets_processed": list(df.keys())
                },
                "processing_time_ms": processing_time_ms
            }
            
            print(f"✅ EXCEL OCR SUCCESS: Processed {len(df)} sheets, {len(raw_text)} characters in {processing_time_ms}ms")
            
            return result
            
        except Exception as e:
            logger.error(f"Excel OCR processing failed: {str(e)}")
            raise ValueError(f"Excel OCR processing failed: {str(e)}")
    
    async def extract_text_from_pdf(
        self,
        pdf_path: str,
        language: str = "jpn+eng",
        confidence_threshold: float = 30.0
    ) -> Dict[str, Any]:
        """
        Extract text from PDF file by converting to images and using OpenAI Vision.
        """
        try:
            import fitz  # PyMuPDF
            
            start_time = asyncio.get_event_loop().time()
            logger.info(f"🤖 PDF OCR: Processing PDF with {self.model}")
            
            # Open PDF
            pdf_document = fitz.open(pdf_path)
            all_text = []
            all_structured_data = {}
            total_confidence = 0
            processed_pages = 0
            
            # Process each page
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                
                # Convert page to image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
                img_data = pix.tobytes("png")
                
                # Convert to base64 for OpenAI
                import base64
                base64_image = base64.b64encode(img_data).decode('utf-8')
                
                # Process with OpenAI
                try:
                    response = await self.client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": f"""Please extract all text from this PDF page image. 
                                        Language: {language}
                                        
                                        Please provide:
                                        1. All visible text exactly as it appears
                                        2. Any structured data you can identify (product names, prices, codes, etc.)
                                        
                                        Format the response as JSON with 'raw_text' and 'structured_data' fields."""
                                    },
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/png;base64,{base64_image}",
                                            "detail": "high"
                                        }
                                    }
                                ]
                            }
                        ],
                        max_tokens=4000,
                        temperature=0.1
                    )
                    
                    response_text = response.choices[0].message.content
                    
                    # Try to parse as JSON
                    try:
                        import json
                        page_result = json.loads(response_text)
                        page_text = page_result.get('raw_text', response_text)
                        page_structured = page_result.get('structured_data', {})
                    except json.JSONDecodeError:
                        page_text = response_text
                        page_structured = {}
                    
                    all_text.append(f"=== Page {page_num + 1} ===\n{page_text}")
                    
                    # Merge structured data
                    for key, value in page_structured.items():
                        if key not in all_structured_data and value:
                            all_structured_data[key] = value
                    
                    total_confidence += 85.0  # Assume good confidence for PDF OCR
                    processed_pages += 1
                    
                except Exception as page_error:
                    logger.warning(f"Failed to process PDF page {page_num + 1}: {page_error}")
                    # Try to extract text directly from PDF
                    try:
                        page_text = page.get_text()
                        if page_text.strip():
                            all_text.append(f"=== Page {page_num + 1} (Direct) ===\n{page_text}")
                            processed_pages += 1
                            total_confidence += 70.0
                    except:
                        pass
            
            # Store total pages before closing document
            total_pages = len(pdf_document)
            
            pdf_document.close()
            
            # Calculate final confidence
            final_confidence = total_confidence / max(processed_pages, 1) if processed_pages > 0 else 0
            
            # Combine all text
            raw_text = "\n\n".join(all_text)
            
            # Calculate processing time
            processing_time_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
            
            result = {
                "raw_text": raw_text,
                "confidence_score": final_confidence,
                "language_detected": language,
                "word_confidences": {},
                "bounding_boxes": [],
                "text_blocks": [],
                "structured_data": {
                    **all_structured_data,
                    "file_type": "pdf",
                    "total_pages": total_pages,
                    "processed_pages": processed_pages,
                    "total_text_length": len(raw_text)
                },
                "processing_metadata": {
                    "method": "pdf_pymupdf_openai", 
                    "model": self.model,
                    "pages_processed": processed_pages
                },
                "processing_time_ms": processing_time_ms
            }
            
            print(f"✅ PDF OCR SUCCESS: Processed {processed_pages}/{total_pages} pages, {len(raw_text)} characters in {processing_time_ms}ms")
            
            return result
            
        except ImportError:
            # Fallback: try to use direct text extraction if PyMuPDF is not available
            logger.warning("PyMuPDF not available, trying alternative PDF processing")
            return await self._extract_pdf_fallback(pdf_path, language, confidence_threshold)
        except Exception as e:
            logger.error(f"PDF OCR processing failed: {str(e)}")
            raise ValueError(f"PDF OCR processing failed: {str(e)}")
    
    async def _extract_pdf_fallback(self, pdf_path: str, language: str, confidence_threshold: float) -> Dict[str, Any]:
        """Fallback PDF processing without PyMuPDF"""
        try:
            # Simple fallback - return minimal structure
            return {
                "raw_text": f"PDF file: {Path(pdf_path).name} (processing unavailable)",
                "confidence_score": 0.0,
                "language_detected": language,
                "word_confidences": {},
                "bounding_boxes": [],
                "text_blocks": [],
                "structured_data": {
                    "file_type": "pdf",
                    "status": "processing_unavailable"
                },
                "processing_metadata": {
                    "method": "fallback", 
                    "error": "PDF processing libraries not available"
                },
                "processing_time_ms": 0
            }
        except Exception as e:
            raise ValueError(f"PDF fallback processing failed: {str(e)}")
    
    async def extract_text_from_file(
        self,
        file_path: str,
        language: str = "jpn+eng",
        preprocessing: bool = True,
        confidence_threshold: float = 30.0
    ) -> Dict[str, Any]:
        """
        Extract text from file. Supports images and Excel files.
        """
        if not self.client:
            raise Exception("OpenAI client is not initialized. Please check OPENAI_API_KEY configuration.")
        
        file_path_obj = Path(file_path)
        file_extension = file_path_obj.suffix.lower()
        
        if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            return await self.extract_text_from_image(
                file_path, language, confidence_threshold
            )
        elif file_extension in ['.xls', '.xlsx']:
            return await self.extract_text_from_excel(
                file_path, language, confidence_threshold
            )
        elif file_extension == '.pdf':
            return await self.extract_text_from_pdf(
                file_path, language, confidence_threshold
            )
        else:
            raise ValueError(f"Unsupported file format: {file_extension}") 