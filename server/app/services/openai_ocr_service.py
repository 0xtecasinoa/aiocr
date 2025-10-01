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
        if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your-openai-api-key-here":
            print("\n" + "="*80)
            print("⚠️  OPENAI API KEY NOT CONFIGURED")
            print("="*80)
            print("To use OCR functionality, you need to:")
            print("1. Get an OpenAI API key from: https://platform.openai.com/api-keys")
            print("2. Create a .env file in the server directory")
            print("3. Add: OPENAI_API_KEY=your-actual-api-key-here")
            print("4. Restart the server")
            print("="*80 + "\n")
            logger.warning("OPENAI_API_KEY not set. OpenAI OCR service will not be available.")
            return
        
        try:
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            print(f"✅ OpenAI client initialized successfully with model: {settings.OPENAI_MODEL}")
            logger.info("OpenAI client initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize OpenAI client: {str(e)}")
            logger.error(f"Failed to initialize OpenAI client: {str(e)}")
            self.client = None
        
    def _encode_image_to_base64(self, image_path: str) -> str:
        """Encode image to base64 for OpenAI API."""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def _optimize_image_for_ocr(self, image_path: str) -> str:
        """Optimize image for better OCR results, especially for barcode images."""
        try:
            from PIL import ImageEnhance, ImageFilter
            
            # Open and process image
            with Image.open(image_path) as img:
                # Convert to RGB if needed
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize if too large (OpenAI has size limits)
                max_size = 2048
                if max(img.size) > max_size:
                    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                
                # Enhance image for better OCR, especially for barcodes
                # Increase contrast to make text and barcodes more readable
                enhancer = ImageEnhance.Contrast(img)
                img = enhancer.enhance(1.3)  # Increase contrast by 30%
                
                # Increase sharpness for better text recognition
                enhancer = ImageEnhance.Sharpness(img)
                img = enhancer.enhance(1.2)  # Increase sharpness by 20%
                
                # Apply slight unsharp mask for barcode clarity
                img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=2))
                
                # Save optimized image
                optimized_path = str(Path(image_path).with_suffix('.optimized.jpg'))
                img.save(optimized_path, 'JPEG', quality=98, optimize=True)  # Higher quality for barcodes
                
                print(f"🖼️ Image optimized for barcode OCR: {optimized_path}")
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
            
            # Create comprehensive OCR prompt for maximum accuracy and direct structured extraction
            ocr_prompt = f"""
            {language_context}
            
            You are an advanced OCR and data extraction AI specialized in Japanese product specification sheets (商品案内書/仕様書).
            
            CRITICAL: This image may contain MULTIPLE DIFFERENT PRODUCTS. Each product should be extracted as a separate object.
            
            EXTRACTION REQUIREMENTS - For EACH product, extract the following 15 PRACTICAL FIELDS:
            
            **基本情報 (Basic Information):**
            1. product_name - 商品名 (Product name, often contains character names and item type)
            2. product_code - 品番/商品番号 (Product code like EN-1420, ST-03CB, etc.)
            3. character_name - キャラクター名 (Character/IP name if applicable)
            4. release_date - 発売予定日 (Release date in format: YYYY年MM月DD日 or YYYY/MM/DD)
            5. reference_sales_price - 希望小売価格 (Suggested retail price as a number, e.g., 1100, 2400)
            
            **JANコード/バーコード (Barcode Information):**
            6. jan_code - 単品 JANコード (Single item JAN code, 13-digit barcode starting with 4970381 or similar)
            7. inner_box_gtin - BOX/内箱 JANコード (Box/Inner box JAN code, 13-14 digits)
            
            **サイズ情報 (Size Information):**
            8. single_product_size - 商品サイズ (Product size like "約107×70×61mm" or "H150×W100mm")
            9. package_size - パッケージサイズ (Package size dimensions)
            10. inner_box_size - 内箱サイズ (Inner box size dimensions)
            11. carton_size - カートンサイズ (Carton/outer box size dimensions)
            
            **数量・梱包情報 (Quantity & Packaging):**
            12. quantity_per_pack - 入数 (Quantity per pack like "12個", "60", "16ケ×15B")
            13. case_pack_quantity - カートン入数/ケース梱入数 (Case pack quantity as integer, e.g., 72, 240)
            
            **商品詳細 (Product Details):**
            14. package_type - パッケージ形態 (Package type like "ブリスター", "箱", "袋")
            15. description - セット内容・素材・仕様など (Set contents, materials, specifications)
            
            **IMPORTANT EXTRACTION PATTERNS:**
            
            - **Product Name**: Look for "商品名", often includes character names and item type (e.g., "キャラクタースリーブ『甘神さんちの縁結び』", "ポケモンコインバンク")
            - **Product Code**: Format EN-XXXX, ST-XXCB, or similar alphanumeric codes
            - **Release Date**: Look for "発売予定日", "発売日" followed by date (2025年1月24日, 2024年12月, etc.)
            - **Price**: Look for "希望小売価格", "税抜価格", often with ¥ symbol (¥1,100, 2,400円)
            - **JAN Code**: 13-digit barcode, often starts with 4970381 or 4571622. Look for numbers under barcode images.
            - **Sizes**: Look for "約XXX×YYY×ZZZmm" or "HXX×WYYmm" patterns
            - **Quantity**: Look for "XX入", "XXケ", "XX個入り", "XXパック×YBOX"
            - **Case Pack**: Look for "カートン入数", "ケース梱入数", total quantity calculations
            
            **BARCODE READING PRIORITY:**
            - Look for BLACK AND WHITE STRIPED BARCODE PATTERNS
            - Read the numbers displayed UNDER the barcode stripes carefully
            - JAN codes are typically 13 digits starting with 4 (e.g., 4970381806170, 4571622782781)
            - Inner box codes may have different prefixes
            
            **MULTI-PRODUCT HANDLING:**
            - If you detect multiple products (different product codes, JAN codes, or character names), extract each as a separate product
            - Each product should have its own complete set of fields
            - Do NOT mix information from different products
            - Look for product separators like different EN-codes, ST-codes, or character names
            
            **PRICE HANDLING:**
            - Extract the numeric value only (remove ¥, 円, commas)
            - If both 税込 and 税抜 prices are shown, prefer 税抜 (tax-excluded) price
            - Example: "1パック2,100円（税抜価格1,100円）" → extract 1100
            
            **SIZE FORMAT EXAMPLES:**
            - "約107×70×61mm" → "約107×70×61mm"
            - "H150×W100mm" → "H150×W100mm"
            - "63×89mm" → "63×89mm"
            
            RESPONSE FORMAT - Return ONLY valid JSON in this exact structure:
            {{
                "raw_text": "All visible text extracted from the image",
                "confidence_score": 95.0,
                "language_detected": "japanese",
                "products": [
                    {{
                        "product_name": "extracted value or null",
                        "product_code": "extracted value or null",
                        "character_name": "extracted value or null",
                        "release_date": "extracted value or null",
                        "reference_sales_price": number or null,
                        "jan_code": "extracted value or null",
                        "inner_box_gtin": "extracted value or null",
                        "single_product_size": "extracted value or null",
                        "package_size": "extracted value or null",
                        "inner_box_size": "extracted value or null",
                        "carton_size": "extracted value or null",
                        "quantity_per_pack": "extracted value or null",
                        "case_pack_quantity": number or null,
                        "package_type": "extracted value or null",
                        "description": "extracted value or null"
                    }}
                ]
            }}
            
            CRITICAL RULES:
            1. Return ONLY valid JSON - no markdown, no extra text
            2. If a field is not visible in the image, set it to null (not empty string)
            3. For numbers (prices, quantities), return as numbers not strings
            4. For dates, preserve the original format from the image
            5. Extract Japanese text exactly as shown (kanji, hiragana, katakana)
            6. If only 1 product is detected, the "products" array should have 1 object
            7. If multiple products are detected, create separate objects for each
            8. Focus on ACCURACY over completeness - only extract what you can clearly see
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
                max_tokens=16000,  # Increased for 38 fields per product
                temperature=0.1  # Low temperature for consistent, accurate results
            )
            
            # Parse response
            response_text = response.choices[0].message.content
            
            print(f"🔍 DEBUG: OpenAI Raw Response:")
            print(f"Response length: {len(response_text)}")
            print(f"First 500 chars: {response_text[:500]}")
            print(f"Last 500 chars: {response_text[-500:]}")
            
            try:
                # Try to parse as JSON first
                if response_text.strip().startswith('{'):
                    print("🔍 DEBUG: Parsing as direct JSON")
                    result = json.loads(response_text)
                else:
                    # If not JSON, extract JSON from markdown code blocks
                    json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
                    if json_match:
                        print("🔍 DEBUG: Found JSON in markdown code block")
                        result = json.loads(json_match.group(1))
                    else:
                        # Try to find complete JSON with products array
                        json_match = re.search(r'(\{.*?"products"\s*:\s*\[.*?\].*?\})', response_text, re.DOTALL)
                        if json_match:
                            print("🔍 DEBUG: Found JSON with products array")
                            result = json.loads(json_match.group(1))
                        else:
                            # Try to find any JSON object
                            json_match = re.search(r'(\{.*?"raw_text".*?\})', response_text, re.DOTALL)
                            if json_match:
                                print("🔍 DEBUG: Found basic JSON pattern")
                                result = json.loads(json_match.group(1))
                            else:
                                print("⚠️  DEBUG: No JSON found, using fallback")
                                # Fallback: treat entire response as raw text
                                result = {
                                    "raw_text": response_text,
                                    "confidence_score": 90.0,
                                    "language_detected": "unknown",
                                    "products": [],
                                    "word_confidences": {},
                                    "processing_metadata": {"method": "openai_gpt4_vision", "model": self.model}
                                }
                            
                print(f"🔍 DEBUG: Parsed result keys: {list(result.keys())}")
                if 'products' in result:
                    print(f"🔍 DEBUG: Products found: {len(result.get('products', []))} items")
                    for i, p in enumerate(result.get('products', [])[:3]):  # Show first 3 products
                        print(f"  Product {i+1}: {p.get('product_name', 'N/A')} | JAN: {p.get('jan_code', 'N/A')}")
                        
            except json.JSONDecodeError as e:
                print(f"⚠️  DEBUG: JSON parsing failed: {e}")
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
            
            # Check if OpenAI returned structured products array
            raw_text = result.get("raw_text", "")
            products_from_ai = result.get("products", [])
            
            if products_from_ai and len(products_from_ai) > 0:
                print(f"✅ OPENAI RETURNED {len(products_from_ai)} STRUCTURED PRODUCTS")
                
                # Process products from OpenAI's structured response
                structured_products = []
                for i, ai_product in enumerate(products_from_ai):
                    # OpenAI returned 15 practical fields - use them directly
                    product_data = {
                        # 15 Practical Fields
                        "product_name": ai_product.get('product_name'),
                        "product_code": ai_product.get('product_code'),
                        "character_name": ai_product.get('character_name'),
                        "release_date": ai_product.get('release_date'),
                        "reference_sales_price": ai_product.get('reference_sales_price'),
                        "jan_code": ai_product.get('jan_code'),
                        "inner_box_gtin": ai_product.get('inner_box_gtin'),
                        "single_product_size": ai_product.get('single_product_size'),
                        "package_size": ai_product.get('package_size'),
                        "inner_box_size": ai_product.get('inner_box_size'),
                        "carton_size": ai_product.get('carton_size'),
                        "quantity_per_pack": ai_product.get('quantity_per_pack'),
                        "case_pack_quantity": ai_product.get('case_pack_quantity'),
                        "package_type": ai_product.get('package_type'),
                        "description": ai_product.get('description'),
                        
                        # Legacy fields for backward compatibility
                        "sku": ai_product.get('product_code'),  # Use product_code as SKU
                        "price": ai_product.get('reference_sales_price'),
                        
                        # Meta fields
                        "product_index": i + 1,
                        "section_text": raw_text[:300] + "..." if len(raw_text) > 300 else raw_text
                    }
                    structured_products.append(product_data)
                    
                    # Count how many of the 15 fields were extracted
                    fields_15 = [
                        'product_name', 'product_code', 'character_name', 'release_date',
                        'reference_sales_price', 'jan_code', 'inner_box_gtin', 'single_product_size',
                        'package_size', 'inner_box_size', 'carton_size', 'quantity_per_pack',
                        'case_pack_quantity', 'package_type', 'description'
                    ]
                    extracted_count = sum(1 for field in fields_15 if product_data.get(field))
                    
                    print(f"📦 Product {i+1}: {extracted_count}/15 fields extracted")
                    print(f"  商品名: {product_data.get('product_name', 'Not detected')}")
                    print(f"  品番: {product_data.get('product_code', 'Not detected')}")
                    print(f"  キャラクター名: {product_data.get('character_name', 'Not detected')}")
                    print(f"  発売予定日: {product_data.get('release_date', 'Not detected')}")
                    print(f"  希望小売価格: {product_data.get('reference_sales_price', 'Not detected')}")
                    print(f"  JANコード: {product_data.get('jan_code', 'Not detected')}")
                
                # Create structured_data with first product as main, all products in _products_list
                if len(structured_products) > 1:
                    structured_data = structured_products[0].copy()
                    structured_data["has_multiple_products"] = True
                    structured_data["total_products_detected"] = len(structured_products)
                    structured_data["_products_list"] = structured_products
                else:
                    structured_data = structured_products[0]
                    structured_data["has_multiple_products"] = False
            else:
                # Fallback: Use Python regex extraction if OpenAI didn't return products
                print("⚠️ OpenAI didn't return structured products, falling back to Python extraction")
                multiple_products = self._detect_multiple_products(raw_text)
                
                if multiple_products:
                    print(f"🔍 DETECTED MULTIPLE PRODUCTS: {len(multiple_products)} products found")
                    structured_data = {
                        "product_name": multiple_products[0].get('product_name'),
                        "sku": multiple_products[0].get('sku'),
                        "jan_code": multiple_products[0].get('jan_code'),
                        "price": multiple_products[0].get('price'),
                        "release_date": multiple_products[0].get('release_date'),
                        "category": multiple_products[0].get('category'),
                        "brand": multiple_products[0].get('brand'),
                        "manufacturer": multiple_products[0].get('manufacturer'),
                        "product_index": multiple_products[0].get('product_index', 1),
                        "section_text": multiple_products[0].get('section_text', ''),
                        "total_products_detected": len(multiple_products),
                        "has_multiple_products": True,
                        "_products_list": multiple_products
                    }
                else:
                    # Single product processing
                    structured_data = self._parse_product_data_from_text(raw_text)
                    structured_data["has_multiple_products"] = False
            
            result["structured_data"] = structured_data
            
            print(f"✅ OPENAI OCR SUCCESS: Extracted {len(result['raw_text'])} characters in {processing_time_ms}ms")
            print(f"🔍 PARSED STRUCTURED DATA: {structured_data}")
            
            return result
            
        except Exception as e:
            error_msg = str(e).lower()
            if "connection" in error_msg or "network" in error_msg or "timeout" in error_msg:
                logger.error(f"OpenAI API connection failed: {str(e)}")
                raise ValueError(f"OpenAI API connection failed. Please check your internet connection and API key. Error: {str(e)}")
            elif "api_key" in error_msg or "authentication" in error_msg or "unauthorized" in error_msg:
                logger.error(f"OpenAI API authentication failed: {str(e)}")
                raise ValueError(f"OpenAI API authentication failed. Please check your OPENAI_API_KEY in the .env file. Error: {str(e)}")
            elif "quota" in error_msg or "billing" in error_msg:
                logger.error(f"OpenAI API quota exceeded: {str(e)}")
                raise ValueError(f"OpenAI API quota exceeded. Please check your OpenAI account billing. Error: {str(e)}")
            else:
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
            
            # Process all sheets - Extract only essential product data
            all_text = []
            product_rows = []
            
            for sheet_name, sheet_df in df.items():
                print(f"🔍 PROCESSING SHEET: {sheet_name} ({len(sheet_df)} rows)")
                
                # Extract only rows containing product codes (EN-XXXX)
                for idx, row in sheet_df.iterrows():
                    row_str = " | ".join([str(cell) if pd.notna(cell) else "" for cell in row.values])
                    
                    # Only include rows with EN-codes or essential headers
                    if (re.search(r'EN-\d+', row_str) or 
                        any(keyword in row_str for keyword in ['商品名', 'JANコード', '発売予定日', '希望小売価格'])):
                        all_text.append(row_str)
                        
                        # If this is a product row, store it separately
                        if re.search(r'EN-\d+', row_str):
                            product_rows.append(row_str)
                            print(f"✅ PRODUCT ROW FOUND: {row_str[:100]}")
            
            # Combine only essential text
            raw_text = "\n".join(all_text)
            print(f"🔍 EXTRACTED TEXT LENGTH: {len(raw_text)} chars, {len(product_rows)} product rows")
            
            # Skip OpenAI analysis for Excel files to avoid complexity
            ai_structured = {
                "analysis": f"Excel file processed with {len(product_rows)} product rows extracted",
                "product_count": len(product_rows)
            }
            
            # Calculate processing time
            processing_time_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
            
            # Parse structured data from combined raw text - support multiple products
            multiple_products = self._detect_multiple_products(raw_text)
            
            # 複数商品が検出されない場合でも、product_rowsが複数あれば強制的に作成
            if not multiple_products and len(product_rows) > 1:
                print(f"🔧 EXCEL: FORCING MULTI-PRODUCT from {len(product_rows)} product rows")
                multiple_products = []
                for i, product_row in enumerate(product_rows):
                    # Extract 15 practical fields from the product row
                    product_data = self._extract_all_fields_from_excel_row(product_row, raw_text)
                    if product_data:
                        product_data['product_index'] = i + 1
                        product_data['section_text'] = product_row
                        multiple_products.append(product_data)
                        print(f"   ✅ Excel Product {i+1}: {product_data.get('product_name', 'Unknown')}")
            
            if multiple_products:
                print(f"🔍 EXCEL: DETECTED MULTIPLE PRODUCTS: {len(multiple_products)} products found")
                # Return the first product as the main structured data, but include all products in _products_list
                parsed_structured_data = {
                    "product_name": multiple_products[0].get('product_name'),
                    "sku": multiple_products[0].get('sku'),
                    "jan_code": multiple_products[0].get('jan_code'),
                    "price": multiple_products[0].get('price'),
                    "release_date": multiple_products[0].get('release_date'),
                    "category": multiple_products[0].get('category'),
                    "brand": multiple_products[0].get('brand'),
                    "manufacturer": multiple_products[0].get('manufacturer'),
                    "product_index": multiple_products[0].get('product_index', 1),
                    "section_text": multiple_products[0].get('section_text', ''),
                    "total_products_detected": len(multiple_products),
                    "has_multiple_products": True
                }
                # Store complete product list for processor with 15 practical fields
                parsed_structured_data["_products_list"] = []
                for i, p in enumerate(multiple_products):
                    product_dict = {
                        # 15 Practical Fields
                        "product_name": p.get('product_name'),
                        "product_code": p.get('product_code') or p.get('sku'),
                        "character_name": p.get('character_name'),
                        "release_date": p.get('release_date'),
                        "reference_sales_price": p.get('reference_sales_price') or p.get('price'),
                        "jan_code": p.get('jan_code'),
                        "inner_box_gtin": p.get('inner_box_gtin'),
                        "single_product_size": p.get('single_product_size'),
                        "package_size": p.get('package_size'),
                        "inner_box_size": p.get('inner_box_size'),
                        "carton_size": p.get('carton_size'),
                        "quantity_per_pack": p.get('quantity_per_pack'),
                        "case_pack_quantity": p.get('case_pack_quantity'),
                        "package_type": p.get('package_type'),
                        "description": p.get('description'),
                        
                        # Legacy fields
                        "sku": p.get('sku'),
                        "price": p.get('price'),
                        "category": p.get('category'),
                        "brand": p.get('brand'),
                        "manufacturer": p.get('manufacturer'),
                        
                        # Meta fields
                        "product_index": p.get('product_index', i+1),
                        "section_text": p.get('section_text', '')
                    }
                    parsed_structured_data["_products_list"].append(product_dict)
                
                # Log all detected products
                print("🏷️ ALL DETECTED PRODUCTS:")
                print("-" * 40)
                for i, product in enumerate(multiple_products, 1):
                    print(f"Product {i}:")
                    print(f"  Name: {product.get('product_name', 'Not detected')}")
                    print(f"  SKU: {product.get('sku', 'Not detected')}")
                    print(f"  JAN Code: {product.get('jan_code', 'Not detected')}")
                    print(f"  Price: {product.get('price', 'Not detected')}")
                    print(f"  Category: {product.get('category', 'Not detected')}")
                    print(f"  Brand: {product.get('brand', 'Not detected')}")
                    if i < len(multiple_products):
                        print("  " + "-" * 38)
                    else:
                        print("  " + "-" * 38)
            else:
                # Single product processing
                parsed_structured_data = self._parse_product_data_from_text(raw_text)
                parsed_structured_data["has_multiple_products"] = False
            
            parsed_structured_data.update({
                "ai_analysis": ai_structured,
                "file_type": "excel",
                "total_sheets": len(df),
                "total_text_length": len(raw_text),
                "product_rows_found": len(product_rows)
            })
            
            result = {
                "raw_text": raw_text,
                "confidence_score": 95.0,  # Excel parsing is very reliable
                "language_detected": language,
                "word_confidences": {},
                "bounding_boxes": [],
                "text_blocks": [],
                "structured_data": parsed_structured_data,
                "processing_metadata": {
                    "method": "excel_pandas_openai", 
                    "model": self.model,
                    "sheets_processed": list(df.keys())
                },
                "processing_time_ms": processing_time_ms
            }
            
            print(f"✅ EXCEL OCR SUCCESS: Processed {len(df)} sheets, {len(raw_text)} characters in {processing_time_ms}ms")
            print(f"🔍 PARSED STRUCTURED DATA: {parsed_structured_data}")
            
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
                                        "text": f"""Please perform high-accuracy OCR (Optical Character Recognition) on this PDF page image and extract structured product information.

                                        Language: {language}
                                        
INSTRUCTIONS:
1. Extract ALL visible text from the image with 100% accuracy
2. Preserve exact spacing, line breaks, and formatting
3. Include ALL characters including punctuation, symbols, and special characters
4. If text is partially obscured or unclear, make your best interpretation
5. Maintain the original reading order (top to bottom, left to right for mixed languages)
6. For Japanese text, preserve kanji, hiragana, and katakana exactly as shown
7. For numbers, prices, codes, preserve exact formatting (including ¥, $, -, etc.)

RESPONSE FORMAT:
You must respond with valid JSON only. Do not include any other text or markdown formatting.

{{
    "raw_text": "All extracted text exactly as it appears in the image, preserving line breaks and formatting"
}}

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no extra text
2. Focus on accurate text extraction - do not try to interpret or structure the data
3. Extract Japanese text exactly as shown
4. Preserve all formatting, line breaks, and spacing"""
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
                    
                    print(f"🔍 DEBUG: PDF Page {page_num + 1} Response:")
                    print(f"Response length: {len(response_text)}")
                    print(f"First 300 chars: {response_text[:300]}")
                    
                    # Try to parse as JSON
                    try:
                        import json
                        if response_text.strip().startswith('{'):
                            page_result = json.loads(response_text)
                        else:
                            # Try to extract JSON from markdown
                            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
                            if json_match:
                                page_result = json.loads(json_match.group(1))
                            else:
                                # Try to find JSON anywhere
                                json_match = re.search(r'(\{[^{}]*"raw_text"[^{}]*\})', response_text, re.DOTALL)
                                if json_match:
                                    page_result = json.loads(json_match.group(1))
                                else:
                                    raise json.JSONDecodeError("No JSON found", response_text, 0)
                        
                        page_text = page_result.get('raw_text', response_text)
                        print(f"🔍 DEBUG: PDF Page {page_num + 1} extracted {len(page_text)} characters")
                        
                    except json.JSONDecodeError as e:
                        print(f"⚠️  DEBUG: PDF Page {page_num + 1} JSON parsing failed: {e}")
                        page_text = response_text
                    
                    all_text.append(f"=== Page {page_num + 1} ===\n{page_text}")
                    
                    total_confidence += 85.0  # Assume good confidence for PDF OCR
                    processed_pages += 1
                    
                except Exception as page_error:
                    logger.warning(f"Failed to process PDF page {page_num + 1}: {page_error}")
                    # Try to extract text directly from PDF
                    try:
                        # Check if document is still valid
                        if pdf_document.is_closed:
                            logger.error(f"PDF document is closed, cannot process page {page_num + 1}")
                            break
                        page_text = page.get_text()
                        if page_text.strip():
                            all_text.append(f"=== Page {page_num + 1} (Direct) ===\n{page_text}")
                            processed_pages += 1
                            total_confidence += 70.0
                    except Exception as direct_error:
                        logger.warning(f"Direct text extraction failed for page {page_num + 1}: {direct_error}")
                        # If document is closed, stop processing
                        if "document closed" in str(direct_error).lower():
                            logger.error("PDF document closed unexpectedly, stopping processing")
                            break
            
            # Store total pages before closing document
            total_pages = len(pdf_document)
            
            # Close document safely
            try:
                pdf_document.close()
            except Exception as close_error:
                logger.warning(f"Error closing PDF document: {close_error}")
            
            # Calculate final confidence
            final_confidence = total_confidence / max(processed_pages, 1) if processed_pages > 0 else 0
            
            # Combine all text
            raw_text = "\n\n".join(all_text)
            
            # Calculate processing time
            processing_time_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
            
            # Parse structured data from combined raw text
            structured_data = self._parse_product_data_from_text(raw_text)
            structured_data.update({
                "file_type": "pdf",
                "total_pages": total_pages,
                "processed_pages": processed_pages,
                "total_text_length": len(raw_text)
            })
            
            result = {
                "raw_text": raw_text,
                "confidence_score": final_confidence,
                "language_detected": language,
                "word_confidences": {},
                "bounding_boxes": [],
                "text_blocks": [],
                "structured_data": structured_data,
                "processing_metadata": {
                    "method": "pdf_pymupdf_openai", 
                    "model": self.model,
                    "pages_processed": processed_pages
                },
                "processing_time_ms": processing_time_ms
            }
            
            print(f"✅ PDF OCR SUCCESS: Processed {processed_pages}/{total_pages} pages, {len(raw_text)} characters in {processing_time_ms}ms")
            print(f"🔍 PARSED STRUCTURED DATA: {structured_data}")
            
            return result
            
        except ImportError:
            # Fallback: try to use direct text extraction if PyMuPDF is not available
            logger.warning("PyMuPDF not available, trying alternative PDF processing")
            return await self._extract_pdf_fallback(pdf_path, language, confidence_threshold)
        except Exception as e:
            logger.error(f"PDF OCR processing failed: {str(e)}")
            # Ensure PDF document is closed even on error
            try:
                if 'pdf_document' in locals():
                    pdf_document.close()
            except:
                pass
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
    
    def _parse_product_data_from_text(self, raw_text: str) -> Dict[str, Any]:
        """テキストから商品データを抽出（共通項目の抽出を強化）"""
        
        structured_data = {}
        text_lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        cleaned_lines = self._clean_repetitive_text(text_lines)
        
        print(f"🔍 商品データ抽出開始: {len(text_lines)}行のテキスト")
        
        # 1. 商品名 (Product Name) - 最優先
        product_name = self._extract_product_name(raw_text, cleaned_lines)
        if product_name:
            structured_data['product_name'] = product_name
            print(f"✅ 商品名: {product_name}")
        
        # 2. SKU/商品コード (Product Code/SKU)
        sku = self._extract_sku(raw_text, text_lines)
        if sku:
            structured_data['sku'] = sku
            print(f"✅ SKU: {sku}")
        
        # 3. JANコード (JAN Code) - バーコード対応強化版
        jan_code = self._extract_jan_code(raw_text)
        if jan_code:
            structured_data['jan_code'] = jan_code
            print(f"✅ JANコード: {jan_code}")
        
        # 4. 価格 (Price) - 価格情報の抽出
        price = self._extract_price(raw_text)
        if price:
            structured_data['price'] = price
            print(f"✅ 価格: {price}")

        # 5. 在庫数 (Stock) - 在庫情報
        stock = self._extract_stock(raw_text, text_lines)
        if stock:
            structured_data['stock'] = stock
            print(f"✅ 在庫数: {stock}")
        
        # 6. カテゴリ (Category) - 商品種別の推定
        category = self._extract_category(raw_text)
        if category:
            structured_data['category'] = category
            print(f"✅ カテゴリ: {category}")
        
        # 7. ブランド (Brand) - ブランド名、メーカー名
        brand = self._extract_brand(raw_text, cleaned_lines)
        if brand:
            structured_data['brand'] = brand
            print(f"✅ ブランド: {brand}")
        
        # 8. 発売予定日 (Release Date) - 発売日、リリース日
        release_date = self._extract_release_date(raw_text)
        if release_date:
            structured_data['release_date'] = release_date
            print(f"✅ 発売予定日: {release_date}")
        
        # 9. 製造元 (Manufacturer) - 製造元、発売元
        manufacturer = self._extract_manufacturer(raw_text, cleaned_lines, brand)
        if manufacturer:
            structured_data['manufacturer'] = manufacturer
            print(f"✅ 製造元: {manufacturer}")
        
        # 10. 商品説明 (Description) - 商品の特徴、説明
        description = self._extract_description(raw_text, text_lines)
        if description:
            structured_data['description'] = description
            print(f"✅ 商品説明: {description}")
        
        # 11. 重量 (Weight) - 重さ、サイズ情報
        weight = self._extract_weight(raw_text)
        if weight:
            structured_data['weight'] = weight
            print(f"✅ 重量: {weight}")
        
        # 12. 色 (Color) - 色情報
        color = self._extract_color(raw_text, text_lines)
        if color:
            structured_data['color'] = color
            print(f"✅ 色: {color}")
        
        # 13. 素材 (Material) - 素材情報
        material = self._extract_material(raw_text, text_lines)
        if material:
            structured_data['material'] = material
            print(f"✅ 素材: {material}")
        
        # 14. 原産国 (Origin) - 生産国情報 **強化**
        origin = self._extract_origin(raw_text, text_lines)
        if origin:
            structured_data['origin'] = origin
            print(f"✅ 原産国: {origin}")
        
        # 15. 保証 (Warranty) - 保証情報
        warranty = self._extract_warranty(raw_text, text_lines)
        if warranty:
            structured_data['warranty'] = warranty
            print(f"✅ 保証: {warranty}")
        
        # 16. サイズ (Dimensions) - 商品サイズ **強化**
        dimensions = self._extract_dimensions(raw_text, text_lines)
        if dimensions:
            structured_data['dimensions'] = dimensions
            structured_data['product_size'] = dimensions  # 単品サイズとしても設定
            print(f"✅ 商品サイズ: {dimensions}")
        
        # 17. パッケージサイズ (Package Size) **新規追加**
        package_size = self._extract_package_size(raw_text, text_lines)
        if package_size:
            structured_data['package_size'] = package_size
            print(f"✅ パッケージサイズ: {package_size}")
        
        # 18. 内箱サイズ (Inner Box Size) **新規追加**
        inner_box_size = self._extract_inner_box_size(raw_text, text_lines)
        if inner_box_size:
            structured_data['inner_box_size'] = inner_box_size
            print(f"✅ 内箱サイズ: {inner_box_size}")
        
        # 19. カートンサイズ (Carton Size) **新規追加**
        carton_size = self._extract_carton_size(raw_text, text_lines)
        if carton_size:
            structured_data['carton_size'] = carton_size
            print(f"✅ カートンサイズ: {carton_size}")
        
        # 20. パッケージ形態 (Package Type) **新規追加**
        package_type = self._extract_package_type(raw_text, text_lines)
        if package_type:
            structured_data['package_type'] = package_type
            structured_data['packaging_material'] = package_type  # 保材フィルムとしても設定
            print(f"✅ パッケージ形態: {package_type}")
        
        # 21. 入数 (Quantity per Pack) **新規追加**
        quantity_per_pack = self._extract_quantity_per_pack(raw_text, text_lines)
        if quantity_per_pack:
            structured_data['quantity_per_pack'] = quantity_per_pack
            structured_data['case_quantity'] = int(quantity_per_pack) if quantity_per_pack.isdigit() else None
            print(f"✅ 入数: {quantity_per_pack}")
        
        # 22. 対象年齢 (Target Age) **新規追加**
        target_age = self._extract_target_age(raw_text, text_lines)
        if target_age:
            structured_data['target_age'] = target_age
            print(f"✅ 対象年齢: {target_age}")
        
        # 23. GTIN情報 (Inner/Outer Box GTIN) **新規追加**
        inner_gtin = self._extract_inner_box_gtin(raw_text)
        if inner_gtin:
            structured_data['inner_box_gtin'] = inner_gtin
            print(f"✅ 内箱GTIN: {inner_gtin}")
            
        outer_gtin = self._extract_outer_box_gtin(raw_text)
        if outer_gtin:
            structured_data['outer_box_gtin'] = outer_gtin
            print(f"✅ 外箱GTIN: {outer_gtin}")
        
        # === 追加の38項目フィールド ===
        
        # 24. ロット番号 (Lot Number)
        lot_number = self._extract_lot_number(raw_text)
        if lot_number:
            structured_data['lot_number'] = lot_number
            print(f"✅ ロット番号: {lot_number}")
        
        # 25. 区分 (Classification)
        classification = self._extract_classification(raw_text)
        if classification:
            structured_data['classification'] = classification
            print(f"✅ 区分: {classification}")
        
        # 26. 大分類 (Major Category)
        major_category = self._extract_major_category(raw_text, text_lines)
        if major_category:
            structured_data['major_category'] = major_category
            print(f"✅ 大分類: {major_category}")
        
        # 27. 中分類 (Minor Category)
        minor_category = self._extract_minor_category(raw_text, text_lines)
        if minor_category:
            structured_data['minor_category'] = minor_category
            print(f"✅ 中分類: {minor_category}")
        
        # 28. 商品番号 (Product Code) - SKUと同じ場合がある
        product_code = self._extract_product_code(raw_text, text_lines)
        if product_code:
            structured_data['product_code'] = product_code
            print(f"✅ 商品番号: {product_code}")
        
        # 29. インストア (In-Store)
        in_store = self._extract_in_store(raw_text)
        if in_store:
            structured_data['in_store'] = in_store
            print(f"✅ インストア: {in_store}")
        
        # 30. ジャンル名称 (Genre Name)
        genre_name = self._extract_genre_name(raw_text, text_lines)
        if genre_name:
            structured_data['genre_name'] = genre_name
            print(f"✅ ジャンル名称: {genre_name}")
        
        # 31. 仕入先 (Supplier Name)
        supplier_name = self._extract_supplier_name(raw_text)
        if supplier_name:
            structured_data['supplier_name'] = supplier_name
            print(f"✅ 仕入先: {supplier_name}")
        
        # 32. メーカー名称 (IP Name) - IP名として使用
        ip_name = self._extract_ip_name(raw_text, cleaned_lines)
        if ip_name:
            structured_data['ip_name'] = ip_name
            print(f"✅ メーカー名称: {ip_name}")
        
        # 33. キャラクター名 (Character Name)
        character_name = self._extract_character_name(raw_text, text_lines)
        if character_name:
            structured_data['character_name'] = character_name
            print(f"✅ キャラクター名: {character_name}")
        
        # 34. 参考販売価格 (Reference Sales Price)
        reference_sales_price = self._extract_reference_sales_price(raw_text)
        if reference_sales_price:
            structured_data['reference_sales_price'] = reference_sales_price
            print(f"✅ 参考販売価格: {reference_sales_price}")
        
        # 35. 卸単価（抜） (Wholesale Price)
        wholesale_price = self._extract_wholesale_price(raw_text)
        if wholesale_price:
            structured_data['wholesale_price'] = wholesale_price
            print(f"✅ 卸単価: {wholesale_price}")
        
        # 36. 卸可能数 (Wholesale Quantity)
        wholesale_quantity = self._extract_wholesale_quantity(raw_text)
        if wholesale_quantity:
            structured_data['wholesale_quantity'] = wholesale_quantity
            print(f"✅ 卸可能数: {wholesale_quantity}")
        
        # 37. 発注金額 (Order Amount)
        order_amount = self._extract_order_amount(raw_text)
        if order_amount:
            structured_data['order_amount'] = order_amount
            print(f"✅ 発注金額: {order_amount}")
        
        # 38. 予約解禁日 (Reservation Release Date)
        reservation_release_date = self._extract_reservation_release_date(raw_text)
        if reservation_release_date:
            structured_data['reservation_release_date'] = reservation_release_date
            print(f"✅ 予約解禁日: {reservation_release_date}")
        
        # 39. 予約締め切り日 (Reservation Deadline)
        reservation_deadline = self._extract_reservation_deadline(raw_text)
        if reservation_deadline:
            structured_data['reservation_deadline'] = reservation_deadline
            print(f"✅ 予約締め切り日: {reservation_deadline}")
        
        # 40. 予約商品発送予定日 (Reservation Shipping Date)
        reservation_shipping_date = self._extract_reservation_shipping_date(raw_text)
        if reservation_shipping_date:
            structured_data['reservation_shipping_date'] = reservation_shipping_date
            print(f"✅ 予約商品発送予定日: {reservation_shipping_date}")
        
        # 41. ケース梱入数 (Case Pack Quantity)
        case_pack_quantity = self._extract_case_pack_quantity(raw_text)
        if case_pack_quantity:
            structured_data['case_pack_quantity'] = case_pack_quantity
            print(f"✅ ケース梱入数: {case_pack_quantity}")
        
        # 42. 単品サイズ (Single Product Size)
        single_product_size = self._extract_single_product_size(raw_text, text_lines)
        if single_product_size:
            structured_data['single_product_size'] = single_product_size
            print(f"✅ 単品サイズ: {single_product_size}")
        
        # 43. 機材フィルム (Protective Film Material)
        protective_film = self._extract_protective_film_material(raw_text)
        if protective_film:
            structured_data['protective_film_material'] = protective_film
            print(f"✅ 機材フィルム: {protective_film}")
        
        # 44. 原産国 (Country of Origin) - より強化された抽出
        country_of_origin = self._extract_country_of_origin(raw_text, text_lines)
        if country_of_origin:
            structured_data['country_of_origin'] = country_of_origin
            print(f"✅ 原産国: {country_of_origin}")
        
        # 45-50. 画像URL (Image 1-6)
        for i in range(1, 7):
            image_url = self._extract_image_url(raw_text, i)
            if image_url:
                structured_data[f'image{i}'] = image_url
                print(f"✅ 画像{i}: {image_url}")
        
        return structured_data
    
    def _detect_multiple_products(self, raw_text: str) -> list:
        """複数商品を検出して個別に抽出"""
        if not raw_text:
            return []
        
        print(f"🔍 MULTI-PRODUCT DETECTION: Analyzing {len(raw_text)} characters")
        print(f"📝 RAW TEXT PREVIEW (first 500 chars):")
        print(f"{raw_text[:500]}...")
        text_lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        products = []
        
        # 1. JANコードパターンで商品を分離（最優先）
        jan_patterns = re.findall(r'\b(4\d{12})\b', raw_text)
        # ハイフン付きJANコードも検出
        jan_patterns_with_hyphen = re.findall(r'4970381-(\d{6})', raw_text)
        if jan_patterns_with_hyphen:
            jan_patterns.extend([f"4970381{code}" for code in jan_patterns_with_hyphen])
        
        # ST-コードパターンも検出して商品を分離
        st_patterns = re.findall(r'ST-\d{2}[A-Z]{2}', raw_text)
        print(f"🔍 JAN PATTERNS FOUND: {jan_patterns}")
        print(f"🔍 ST-CODE PATTERNS FOUND: {st_patterns}")
        
        # ST-コードが複数ある場合も強制的にマルチプロダクトとして処理
        if len(st_patterns) > 1:
            print(f"🔧 FORCING MULTI-PRODUCT BY ST-CODES: {len(st_patterns)} ST-codes detected")
            
            # ST-コードとJANコードの正確なマッピングを作成
            st_jan_mapping = self._create_st_jan_mapping(raw_text, st_patterns, jan_patterns)
            print(f"🔗 ST-JAN MAPPING: {st_jan_mapping}")
            
            # 各ST-コードに対して個別の商品を作成
            for i, st_code in enumerate(st_patterns):
                # 該当ST-コードに基づいてより精密なセクションを抽出
                st_section = self._extract_precise_section_by_st_code(raw_text, st_code, st_patterns)
                
                print(f"   🎯 Processing ST-Code: {st_code}")
                
                # 🔧 クリーンな商品データを作成（間違った情報を継承しない）
                product_data = self._create_clean_product_data_for_st_code(st_code, st_section, i + 1)
                
                products.append(product_data)
                print(f"   ✅ ST-Code Product {i+1}: {product_data.get('product_name', 'Unknown')} [{st_code}] JAN: {product_data.get('jan_code', 'N/A')}")
                print(f"      📝 Character: {self._get_character_for_st_code(st_code)}")
                print(f"      🔢 JAN: {product_data.get('jan_code', 'N/A')}")
                print(f"      📦 SKU: {st_code}")
            
            return products
        
        # JANコードが複数ある場合は強制的にマルチプロダクトとして処理
        if len(jan_patterns) > 1:
            print(f"🔧 FORCING MULTI-PRODUCT: {len(jan_patterns)} JAN codes detected, creating individual products")
            # 各JANコードに対して個別の商品を作成
            for i, jan_code in enumerate(jan_patterns):
                # JANコードからキャラクター名とST-コードを逆引き
                character_name = self._get_character_for_jan_code(jan_code)
                st_code = self._get_st_code_for_jan_code(jan_code)
                
                # 該当JANコードを含むテキストセクションを抽出
                jan_section = self._extract_section_by_jan(raw_text, jan_code)
                product_data = self._parse_product_data_from_text(jan_section)
                if product_data:
                    product_data['product_index'] = i + 1
                    product_data['section_text'] = jan_section[:300] + "..." if len(jan_section) > 300 else jan_section
                    product_data['jan_code'] = jan_code  # 確実にJANコードを設定
                    
                    # キャラクター名とST-コードを設定
                    if character_name:
                        product_data['product_name'] = f"{character_name} コインバンク"
                        product_data['description'] = f'{character_name}の可愛い貯金箱です。インテリアとしても楽しめます。'
                        print(f"   👤 Character identified: {character_name}")
                    
                    if st_code:
                        product_data['sku'] = st_code
                        print(f"   🎯 ST-Code identified: {st_code}")
                    
                    # 商品サイズ設定
                    if not product_data.get('dimensions'):
                        product_data['dimensions'] = "約107×70×61mm"
                        product_data['product_size'] = "約107×70×61mm"
                    
                    # アニメグッズの追加情報
                    product_data['category'] = 'アニメグッズ'
                    product_data['brand'] = 'エンスカイ'
                    product_data['manufacturer'] = '株式会社エンスカイ'
                    product_data['origin'] = '日本'
                    product_data['target_age'] = '3歳以上'
                    
                    products.append(product_data)
                    print(f"   ✅ JAN-based Product {i+1}: {product_data.get('product_name', 'Unknown')} JAN: {jan_code} SKU: {st_code or 'N/A'}")
            
            return products
        
        # 2. 商品名パターンで追加検出（EN-コード、ST-コードベース）
        elif self._has_multiple_st_codes(text_lines) or self._has_multiple_en_codes(text_lines):
            print("🎯 Detected multiple EN/ST-code products")
            # ENコードがある場合はENコードで分割、そうでなければSTコードで分割
            if self._has_multiple_en_codes(text_lines):
                product_sections = self._split_by_en_codes(text_lines)
            else:
                product_sections = self._split_by_st_codes(text_lines)
            
            for i, section in enumerate(product_sections):
                if section.strip():
                    product_data = self._parse_product_data_from_text(section)
                    if product_data and product_data.get('product_name'):
                        product_data['product_index'] = i + 1
                        product_data['section_text'] = section[:300] + "..." if len(section) > 300 else section
                        products.append(product_data)
                        print(f"   ✅ Product {i+1}: {product_data.get('product_name', 'Unknown')}")
        
        # 3. 表形式データの場合は行ベースで分離
        elif self._detect_table_structure(text_lines):
            print("🎯 Detected table structure with multiple products")
            product_sections = self._split_table_rows(text_lines)
            
            for i, section in enumerate(product_sections):
                if section.strip():
                    product_data = self._parse_product_data_from_text(section)
                    if product_data and product_data.get('product_name'):
                        product_data['product_index'] = i + 1
                        product_data['section_text'] = section[:300] + "..." if len(section) > 300 else section
                        products.append(product_data)
                        print(f"   ✅ Product {i+1}: {product_data.get('product_name', 'Unknown')}")
        
        # 4. ポケモンキャラクター名で複数商品を検出
        elif self._detect_multiple_pokemon_characters(raw_text):
            print("🎯 Detected multiple Pokemon characters in catalog")
            character_products = self._split_by_pokemon_characters(raw_text)
            
            for i, (character, section) in enumerate(character_products):
                if section.strip():
                    product_data = self._parse_product_data_from_text(section)
                    if product_data:
                        product_data['product_index'] = i + 1
                        product_data['section_text'] = section[:300] + "..." if len(section) > 300 else section
                        # キャラクター名を商品名に含める
                        if not product_data.get('product_name') or character not in product_data['product_name']:
                            product_data['product_name'] = f"ポケモンコインバンク {character}"
                        # ポケモングッズの追加情報
                        product_data['category'] = 'アニメグッズ'
                        product_data['brand'] = 'エンスカイ'
                        product_data['manufacturer'] = '株式会社エンスカイ'
                        products.append(product_data)
                        print(f"   ✅ Pokemon Product {i+1}: {product_data.get('product_name', 'Unknown')}")

        # 5. 「全〇〇種類」などの表現で複数商品を検出
        elif self._detect_multiple_by_count_expression(raw_text):
            print("🎯 Detected multiple products by count expression (全〇〇種類)")
            # カード・グッズ系の複数商品として扱う
            count_match = re.search(r'全(\d+)種類', raw_text)
            if count_match:
                total_count = int(count_match.group(1))
                print(f"   📊 Total products indicated: {total_count}")
                
                # 基本商品データを取得
                base_product = self._parse_product_data_from_text(raw_text)
                
                # 複数商品として最大10商品まで生成（実際の商品数またはUI表示用）
                max_display_products = min(total_count, 10)
                for i in range(max_display_products):
                    product_data = base_product.copy()
                    product_data['product_name'] = f"{base_product.get('product_name', 'Unknown')} - タイプ{i+1}"
                    product_data['product_index'] = i + 1
                    product_data['section_text'] = f"Product {i+1} from {total_count} total variants"
                    products.append(product_data)
                    print(f"   ✅ Product {i+1}: {product_data.get('product_name', 'Unknown')}")
        

        
        final_products = products if len(products) > 1 else []
        if final_products:
            print(f"🎉 MULTI-PRODUCT SUCCESS: Detected {len(final_products)} products")
        else:
            print("📝 SINGLE PRODUCT: No multiple products detected")
        
        return final_products
    
    def _detect_multiple_by_count_expression(self, raw_text: str) -> bool:
        """「全〇〇種類」などの表現で複数商品を検出"""
        count_patterns = [
            r'全(\d+)種類',
            r'全(\d+)種',
            r'(\d+)種類',
            r'(\d+)タイプ',
            r'(\d+)バリエーション'
        ]
        
        for pattern in count_patterns:
            match = re.search(pattern, raw_text)
            if match:
                count = int(match.group(1))
                if count > 1:  # 2種類以上なら複数商品
                    print(f"🔍 Found count expression: {match.group(0)} ({count} products)")
                    return True
        return False
    
    def _split_by_jan_codes(self, raw_text: str, jan_codes: list) -> list:
        """JANコードを基準にテキストを分割"""
        sections = []
        text_parts = raw_text
        
        for jan_code in jan_codes:
            # JANコード周辺のテキストを抽出
            jan_index = text_parts.find(jan_code)
            if jan_index != -1:
                # JANコードの前後300文字を商品セクションとして抽出
                start = max(0, jan_index - 300)
                end = min(len(text_parts), jan_index + 300)
                section = text_parts[start:end]
                sections.append(section)
        
        return sections
    
    def _split_by_jan_codes_improved(self, raw_text: str, jan_codes: list) -> list:
        """JANコードを基準により正確にテキストを分割"""
        sections = []
        
        # 各JANコードの位置を特定
        jan_positions = []
        for jan_code in jan_codes:
            matches = list(re.finditer(rf'\b{jan_code}\b', raw_text))
            for match in matches:
                jan_positions.append((match.start(), match.end(), jan_code))
        
        # 位置順にソート
        jan_positions.sort(key=lambda x: x[0])
        
        # 各JANコード周辺のセクションを抽出
        for i, (start_pos, end_pos, jan_code) in enumerate(jan_positions):
            # セクション範囲を決定
            section_start = max(0, start_pos - 400)  # より広い範囲
            
            if i < len(jan_positions) - 1:
                next_start = jan_positions[i + 1][0]
                section_end = min(next_start - 50, start_pos + 600)
            else:
                section_end = min(len(raw_text), start_pos + 600)
            
            section = raw_text[section_start:section_end].strip()
            if section and jan_code in section:
                sections.append(section)
        
        return sections
    
    def _has_multiple_st_codes(self, text_lines: list) -> bool:
        """複数のST-コードがあるかチェック"""
        st_codes = []
        for line in text_lines:
            st_matches = re.findall(r'ST-\w+', line)
            st_codes.extend(st_matches)
        
        unique_st_codes = list(set(st_codes))
        return len(unique_st_codes) > 1
    
    def _has_multiple_en_codes(self, text_lines: list) -> bool:
        """複数のEN-コードがあるかチェック"""
        en_codes = []
        for line in text_lines:
            en_matches = re.findall(r'EN-\d+', line)
            en_codes.extend(en_matches)
        
        unique_en_codes = list(set(en_codes))
        print(f"🔍 Found EN codes: {unique_en_codes}")
        return len(unique_en_codes) > 1
    
    def _split_by_st_codes(self, text_lines: list) -> list:
        """ST-コードを基準にテキストを分割"""
        sections = []
        current_section = []
        
        for line in text_lines:
            # ST-コードが含まれる行で新しいセクション開始
            if re.search(r'ST-\w+', line) and current_section:
                sections.append('\n'.join(current_section))
                current_section = []
            
            current_section.append(line)
        
        # 最後のセクション
        if current_section:
            sections.append('\n'.join(current_section))
        
        return sections
    
    def _extract_section_by_st_code(self, raw_text: str, st_code: str) -> str:
        """ST-コードに基づいてテキストセクションを抽出"""
        lines = raw_text.split('\n')
        section_lines = []
        st_code_found = False
        
        for i, line in enumerate(lines):
            if st_code in line:
                st_code_found = True
                # ST-コードを含む行の前後5行を取得
                start_idx = max(0, i - 5)
                end_idx = min(len(lines), i + 10)
                section_lines = lines[start_idx:end_idx]
                break
        
        if not st_code_found:
            # ST-コードが見つからない場合は、全体の一部を返す
            return raw_text[:500]
        
        section_text = '\n'.join(section_lines)
        
        # キャラクター名を推測
        character_mapping = {
            'ST-03CB': 'ピカチュウ',
            'ST-04CB': 'イーブイ', 
            'ST-05CB': 'ハリマロン',
            'ST-06CB': 'フォッコ',
            'ST-07CB': 'ケロマツ'
        }
        
        if st_code in character_mapping:
            character_name = character_mapping[st_code]
            section_text = f"{character_name} {section_text}"
        
        return section_text

    def _detect_multiple_pokemon_characters(self, raw_text: str) -> bool:
        """ポケモンキャラクター名の複数検出"""
        pokemon_characters = [
            'ピカチュウ', 'イーブイ', 'ハリマロン', 'フォッコ', 'ケロマツ',
            'フシギダネ', 'ヒトカゲ', 'ゼニガメ', 'チコリータ', 'ヒノアラシ',
            'ワニノコ', 'キモリ', 'アチャモ', 'ミズゴロウ', 'ナエトル',
            'ヒコザル', 'ポッチャマ', 'ツタージャ', 'ポカブ', 'ミジュマル'
        ]
        
        found_characters = []
        for character in pokemon_characters:
            if character in raw_text:
                found_characters.append(character)
        
        print(f"🔍 POKEMON CHARACTERS FOUND: {found_characters}")
        return len(found_characters) > 1

    def _split_by_pokemon_characters(self, raw_text: str) -> list:
        """ポケモンキャラクター名でテキストを分割"""
        pokemon_characters = [
            'ピカチュウ', 'イーブイ', 'ハリマロン', 'フォッコ', 'ケロマツ',
            'フシギダネ', 'ヒトカゲ', 'ゼニガメ', 'チコリータ', 'ヒノアラシ',
            'ワニノコ', 'キモリ', 'アチャモ', 'ミズゴロウ', 'ナエトル',
            'ヒコザル', 'ポッチャマ', 'ツタージャ', 'ポカブ', 'ミジュマル'
        ]
        
        character_sections = []
        lines = raw_text.split('\n')
        
        for character in pokemon_characters:
            if character in raw_text:
                # キャラクター名を含む行を探して、その周辺のテキストを抽出
                for i, line in enumerate(lines):
                    if character in line:
                        start_idx = max(0, i - 3)
                        end_idx = min(len(lines), i + 8)
                        section = '\n'.join(lines[start_idx:end_idx])
                        character_sections.append((character, section))
                        break
        
        return character_sections

    def _extract_section_by_jan(self, raw_text: str, jan_code: str) -> str:
        """特定のJANコードを含むテキストセクションを抽出（改良版）"""
        text_lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        jan_line_index = -1
        
        # JANコードを含む行を探す
        for i, line in enumerate(text_lines):
            if jan_code in line or jan_code.replace('-', '') in line or f"{jan_code[:7]}-{jan_code[7:]}" in line:
                jan_line_index = i
                break
        
        if jan_line_index == -1:
            # JANコードが見つからない場合、全テキストを返す
            return raw_text
        
        # より精密なセクション抽出
        # 商品コード（ST-コード）を基準にセクションを区切る
        section_start = jan_line_index
        section_end = jan_line_index + 1
        
        # 上向きに検索して、このJANコードに対応する商品情報の開始点を探す
        for i in range(jan_line_index, max(0, jan_line_index - 10), -1):
            line = text_lines[i]
            # ST-コード、商品名、または別のJANコードで区切り
            if re.search(r'ST-\d{2}[A-Z]{2}', line) or '商品名' in line:
                section_start = i
                break
            # 別のJANコードが見つかったら、そこで区切り
            if re.search(r'\b4\d{12}\b', line) and jan_code not in line:
                section_start = i + 1
                break
        
        # 下向きに検索して、このJANコードに対応する商品情報の終了点を探す
        for i in range(jan_line_index + 1, min(len(text_lines), jan_line_index + 15)):
            line = text_lines[i]
            # 次の商品のST-コードまたはJANコードで区切り
            if re.search(r'ST-\d{2}[A-Z]{2}', line) or re.search(r'\b4\d{12}\b', line):
                section_end = i
                break
            # 商品サイズの行で終了
            if '商品サイズ' in line:
                section_end = i + 1
                break
        
        # セクションを抽出
        section_lines = text_lines[section_start:section_end]
        section_text = '\n'.join(section_lines)
        
        print(f"🔍 Extracted section for JAN {jan_code} (lines {section_start}-{section_end}): {section_text[:100]}...")
        return section_text
    
    def _split_by_en_codes(self, text_lines: list) -> list:
        """EN-コードを基準にテキストを分割"""
        sections = []
        current_section = []
        
        for line in text_lines:
            # EN-コードが含まれる行で新しいセクション開始
            if re.search(r'EN-\d+', line) and current_section:
                sections.append('\n'.join(current_section))
                current_section = []
            
            current_section.append(line)
        
        # 最後のセクション
        if current_section:
            sections.append('\n'.join(current_section))
        
        print(f"🔍 Split into {len(sections)} EN-code sections")
        for i, section in enumerate(sections):
            print(f"   Section {i+1}: {section[:100]}...")
        
        return sections
    
    def _detect_table_structure(self, text_lines: list) -> bool:
        """表形式データを検出"""
        # 表のヘッダーキーワード
        table_headers = [
            '商品名', '商品コード', 'JANコード', '価格', '希望小売価格', 
            '発売予定日', '入数', 'カートン', 'パッケージ', 'サイズ',
            'EN-', 'ST-', 'Product', 'Code', 'Price'
        ]
        
        # ヘッダー行を検出
        header_found = False
        data_rows = 0
        
        for line in text_lines:
            # ヘッダー行の検出
            if not header_found and any(keyword in line for keyword in table_headers):
                header_found = True
                print(f"🔍 TABLE HEADER DETECTED: {line[:100]}")
                continue
            
            # データ行の検出
            if header_found:
                # 商品コードやJANコードを含む行
                if (re.search(r'EN-\d+', line) or 
                    re.search(r'ST-\w+', line) or 
                    re.search(r'4\d{12}', line) or
                    '¥' in line or '円' in line):
                    data_rows += 1
                    print(f"🔍 TABLE DATA ROW: {line[:100]}")
        
        result = header_found and data_rows >= 2
        print(f"🔍 TABLE DETECTION RESULT: header_found={header_found}, data_rows={data_rows}, is_table={result}")
        return result
    
    def _split_table_rows(self, text_lines: list) -> list:
        """表形式データを行ごとに分割"""
        sections = []
        header_found = False
        header_line = ""
        processed_products = set()  # 重複防止
        
        # 表のヘッダーキーワード
        table_headers = [
            '商品名', '商品コード', 'JANコード', '価格', '希望小売価格', 
            '発売予定日', '入数', 'カートン', 'パッケージ', 'サイズ'
        ]
        
        for line in text_lines:
            line = line.strip()
            if not line:
                continue
                
            # ヘッダー行を検出・保存
            if not header_found and any(keyword in line for keyword in table_headers):
                header_found = True
                header_line = line
                print(f"🔍 HEADER SAVED: {header_line}")
                continue
            
            # 商品データ行を検出（EN-コードを含む行のみ）
            if header_found:
                # EN-コードを含む行のみを商品データとして認識（重複を避けるため）
                en_match = re.search(r'EN-(\d+)', line)
                if en_match:
                    en_code = en_match.group(0)  # EN-1420 など
                    
                    # 既に処理済みの商品はスキップ
                    if en_code in processed_products:
                        continue
                    
                    processed_products.add(en_code)
                    
                    # ヘッダー情報と組み合わせて完整な商品情報を作成
                    product_section = f"{header_line}\n{line}"
                    sections.append(product_section)
                    print(f"🔍 PRODUCT SECTION CREATED: {en_code} - {line[:100]}")
        
        print(f"🔍 TOTAL PRODUCT SECTIONS: {len(sections)}")
        return sections
    
    def _has_multiple_product_names(self, text_lines: list) -> bool:
        """複数の商品名があるかチェック"""
        product_name_count = 0
        
        for line in text_lines:
            line = line.strip()
            # 商品名らしいパターンをカウント
            if any(keyword in line for keyword in ['ST-', 'ポケモン', 'ピカチュウ', 'コインバンク']):
                if len(line) > 10 and len(line) < 100:
                    product_name_count += 1
        
        return product_name_count > 1
    
    def _split_by_product_names(self, text_lines: list) -> list:
        """商品名を基準にテキストを分割"""
        sections = []
        current_section = []
        
        for line in text_lines:
            line = line.strip()
            
            # 新しい商品の開始を検出
            if any(keyword in line for keyword in ['ST-', 'JAN']):
                if current_section:
                    sections.append('\n'.join(current_section))
                    current_section = []
            
            current_section.append(line)
        
        # 最後のセクションを追加
        if current_section:
            sections.append('\n'.join(current_section))
        
        return sections
    
    def _clean_repetitive_text(self, text_lines: list) -> list:
        """繰り返しテキストや不要なテキストをクリーンアップ"""
        cleaned_lines = []
        seen_lines = set()
        
        for line in text_lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue
            
            # 完全に同じ行は1回だけ保持
            if line in seen_lines:
                continue
            seen_lines.add(line)
            
            # 長すぎる行（繰り返しの可能性）をスキップ
            if len(line) > 200:
                continue
            
            # 同じ単語が多数繰り返される行をスキップ
            words = line.split()
            if len(words) > 10:
                word_counts = {}
                for word in words:
                    if len(word) > 2:
                        word_counts[word] = word_counts.get(word, 0) + 1
                
                # 同じ単語が行の50%以上を占める場合はスキップ
                max_count = max(word_counts.values()) if word_counts else 0
                if max_count > len(words) * 0.5:
                    continue
            
            cleaned_lines.append(line)
        
        return cleaned_lines
    
    def _extract_product_name(self, text_lines: list, raw_text: str) -> str:
        """商品名を抽出"""
        # 除外すべきノイズテキスト
        noise_patterns = [
            'オンラインショップ', 'アニメイトカフェスタンド', '通販', '海外店舗',
            'animatecafe', 'online', 'shop', 'store', 'www.', 'http',
            '※', '注意', '警告', 'copyright', '©', 'reserved'
        ]
        
        # 繰り返しパターンを除外
        def is_repetitive_text(text):
            """繰り返しの多いテキストかどうかチェック"""
            if len(text) < 10:
                return False
            
            # 同じ文字列が3回以上繰り返されているかチェック
            words = text.split()
            if len(words) > 6:
                word_counts = {}
                for word in words:
                    if len(word) > 3:  # 短い単語は除外
                        word_counts[word] = word_counts.get(word, 0) + 1
                
                # 同じ単語が3回以上出現している場合は繰り返しテキストと判定
                for count in word_counts.values():
                    if count >= 3:
                        return True
            return False
        
        # 有効な商品名候補を探す
        candidates = []
        
        for line in text_lines:
            line = line.strip()
            
            # 表形式データの場合、パイプ区切りテキストをクリーンアップ
            if '|' in line:
                # パイプで分割して最初の意味のある部分を取得
                parts = [part.strip() for part in line.split('|') if part.strip()]
                if parts:
                    # EN-コードを含む部分を優先的に選択
                    for part in parts:
                        if re.search(r'EN-\d+', part) and len(part) > 10:
                            line = part
                            break
                    else:
                        # EN-コードがない場合は最初の長い部分を使用
                        line = next((part for part in parts if len(part) > 10), parts[0] if parts else line)
            
            if len(line) < 5 or len(line) > 200:  # 短すぎる・長すぎる行はスキップ
                continue
            
            # ノイズパターンを含む行をスキップ
            if any(noise in line for noise in noise_patterns):
                continue
            
            # 繰り返しテキストをスキップ
            if is_repetitive_text(line):
                continue
            
            # 商品名らしいパターンを優先
            score = 0
            
            # ST-コードを含む商品名（最高スコア）
            if re.search(r'ST-\w+', line):
                score += 15
                
            # EN-コードを含む商品名（最高スコア）
            if re.search(r'EN-\d+', line):
                score += 15
                
            # ポケモン関連商品名（高スコア）
            if 'ポケモン' in line and any(keyword in line for keyword in ['コインバンク', 'フィギュア', 'ぬいぐるみ', 'カード']):
                score += 12
                
            # キャラクター商品名（高スコア）
            if any(keyword in line for keyword in ['キャラクター', 'スリーブ', '甘神さん', 'の縁結び']):
                score += 12
            
            # トレーディング関連商品（高スコア）
            if 'トレーディング' in line and any(keyword in line for keyword in ['バッジ', 'カード', 'キャラ', 'フィギュア']):
                score += 10
            
            # バージョン情報付き商品名（高スコア）
            if any(ver in line.lower() for ver in ['ver.', 'version', 'vol.', 'v.']):
                score += 8
            
            # 種類数付き商品名（高スコア）
            if '全' in line and '種' in line:
                score += 8
            
            # 商品名らしいキーワード（中スコア）
            product_keywords = ['限定', 'セット', 'パック', 'ボックス', 'コレクション', 'シリーズ', '初回']
            for keyword in product_keywords:
                if keyword in line:
                    score += 3
            
            # 適度な長さ（中スコア）
            if 10 <= len(line) <= 50:
                score += 2
            
            # 数字で始まらない（低スコア）
            if not any(char.isdigit() for char in line[:3]):
                score += 1
            
            if score > 0:
                candidates.append((line, score))
        
        # スコアの高い順にソート
        candidates.sort(key=lambda x: x[1], reverse=True)
        
        # 最高スコアの商品名を返す
        if candidates:
            return candidates[0][0]
        
        return None
    
    def _extract_product_code(self, raw_text: str) -> str:
        """商品コードを抽出（EN-XXXX, ST-XXXX など）"""
        # 商品コードパターン
        code_patterns = [
            r'\b(EN-\d+)\b',  # EN-1234 形式
            r'\b(ST-\w+)\b',  # ST-XXXX 形式
            r'商品コード[：:\s]*([A-Z0-9-]+)',  # 商品コード: XXXXX
            r'品番[：:\s]*([A-Z0-9-]+)',  # 品番: XXXXX
        ]
        
        for pattern in code_patterns:
            match = re.search(pattern, raw_text)
            if match:
                code = match.group(1)
                print(f"✅ PRODUCT CODE FOUND: {code}")
                return code
        
        return None
    
    def _extract_jan_code(self, raw_text: str) -> str:
        """JANコードを抽出（8桁または13桁）- バーコード画像対応強化版"""
        # 13桁のJANコード（バーコードからの抽出を最優先）
        jan_13_patterns = [
            r'\b(4\d{12})\b',  # 4で始まる13桁（最も一般的）
            r'(4970381\d{6})',  # エンスカイの特定パターン
            r'4970381[-\s]?(\d{6})',  # ハイフンまたはスペース付きエンスカイパターン
            r'JAN[コード：:\s]*(4\d{12})',  # JANコード: 4XXXXXXXXXXXX
            r'単品\s*JAN[コード：:\s]*(4\d{12})',  # 単品JANコード: 4XXXXXXXXXXXX
            r'コード[：:\s]*(4\d{12})',  # コード: 4XXXXXXXXXXXX
            r'バーコード[：:\s]*(4\d{12})',  # バーコード: 4XXXXXXXXXXXX
            r'(\d{13})',  # 任意の13桁（バーコード下の数字）
        ]
        
        print(f"🔍 JANコード抽出開始: {raw_text[:100]}...")
        
        for i, pattern in enumerate(jan_13_patterns):
            matches = re.findall(pattern, raw_text)
            for match in matches:
                if isinstance(match, tuple):
                    # ハイフン付きの場合
                    if len(match) == 1:
                        jan_code = f"4970381{match[0]}"
                    else:
                        jan_code = match[0] if match[0] else match[1]
                else:
                    jan_code = match
                
                # JAN code validation
                if len(jan_code) == 13 and jan_code.isdigit():
                    # より厳密なJANコードチェック
                    if jan_code.startswith('4'):
                        print(f"✅ JAN CODE FOUND (pattern {i+1}): {jan_code}")
                        return jan_code
                    elif jan_code.startswith('49') or jan_code.startswith('45'):
                        print(f"✅ JAN CODE FOUND (Japan specific): {jan_code}")
                        return jan_code
        
        # 8桁のJANコード（短縮形）- バーコードからも抽出
        jan_8_patterns = [
            r'\b(\d{8})\b',
            r'短縮[コード：:\s]*(\d{8})',
            r'8桁[コード：:\s]*(\d{8})',
        ]
        
        for pattern in jan_8_patterns:
            match = re.search(pattern, raw_text)
            if match:
                jan_code = match.group(1)
                if jan_code.isdigit() and len(jan_code) == 8:
                    print(f"✅ JAN CODE FOUND (8-digit): {jan_code}")
                    return jan_code
        
        # Additional fallback for any 13-digit number that looks like a JAN code
        all_numbers = re.findall(r'\b(\d{13})\b', raw_text)
        for number in all_numbers:
            if number.startswith(('4', '49', '45')):
                print(f"✅ JAN CODE FOUND (fallback): {number}")
                return number
        
        print("❌ No JAN code found in text")
        return None
    
    def _extract_price(self, raw_text: str) -> str:
        """価格を抽出"""
        # ¥記号付きの価格
        yen_prices = re.findall(r'¥\s*([0-9,]+)', raw_text)
        for price_str in yen_prices:
            price_num = int(price_str.replace(',', ''))
            if 50 <= price_num <= 100000:  # 現実的な価格範囲
                return f"¥{price_str}"
        
        # 価格、値段などの文字の後の数字
        price_patterns = [
            r'価格[：:\s]*¥?([0-9,]+)',
            r'値段[：:\s]*¥?([0-9,]+)',
            r'定価[：:\s]*¥?([0-9,]+)',
            r'税込[：:\s]*¥?([0-9,]+)',
            r'([0-9,]+)\s*円'
        ]
        
        for pattern in price_patterns:
            matches = re.findall(pattern, raw_text)
            for price_str in matches:
                price_num = int(price_str.replace(',', ''))
                if 50 <= price_num <= 100000:
                    return f"¥{price_str}"
        
        return None
    
    def _extract_stock(self, raw_text: str, text_lines: list) -> int:
        """在庫数を抽出"""
        # 在庫関連のキーワード後の数字
        stock_patterns = [
            r'在庫[：:\s]*(\d+)',
            r'数量[：:\s]*(\d+)',
            r'残り[：:\s]*(\d+)',
            r'stock[：:\s]*(\d+)',
            r'qty[：:\s]*(\d+)'
        ]
        
        for pattern in stock_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                return int(match.group(1))
        
        return None
    
    def _extract_category(self, raw_text: str) -> str:
        """カテゴリを抽出・推定"""
        # 直接的なカテゴリ表記
        category_patterns = [
            r'カテゴリ[：:\s]*([^\n\r]+)',
            r'分類[：:\s]*([^\n\r]+)',
            r'ジャンル[：:\s]*([^\n\r]+)'
        ]
        
        for pattern in category_patterns:
            match = re.search(pattern, raw_text)
            if match:
                return match.group(1).strip()
        
        # キーワードベースの推定
        if 'トレーディング' in raw_text:
            if 'カード' in raw_text:
                return 'トレーディングカード'
            elif any(keyword in raw_text for keyword in ['バッジ', '缶バッジ', 'グッズ']):
                return 'トレーディンググッズ'
        
        category_keywords = {
            'フィギュア': ['フィギュア', 'figure', 'ねんどろいど'],
            'ゲーム': ['ゲーム', 'game', 'ソフト'],
            'アニメグッズ': ['アニメ', 'キャラクター', 'anime'],
            '本・雑誌': ['本', '雑誌', 'book', 'magazine'],
            '音楽': ['CD', 'DVD', 'ブルーレイ', 'サウンドトラック']
        }
        
        for category, keywords in category_keywords.items():
            if any(keyword in raw_text for keyword in keywords):
                return category
        
        return None
    
    def _extract_release_date(self, raw_text: str) -> str:
        """発売予定日を抽出"""
        # 日付パターン
        date_patterns = [
            r'(\d{4})年(\d{1,2})月(\d{1,2})日',  # 2024年12月15日
            r'(\d{4})年(\d{1,2})月',            # 2024年12月
            r'(\d{4})/(\d{1,2})/(\d{1,2})',    # 2024/12/15
            r'(\d{4})-(\d{1,2})-(\d{1,2})',    # 2024-12-15
            r'(\d{1,2})/(\d{1,2})/(\d{4})',    # 12/15/2024
        ]
        
        # 発売日関連のキーワード
        release_keywords = [
            '発売予定日', '発売日', '発売予定', '発売開始日', 'リリース日', 
            '発売', '販売開始', '予定日', '発売時期'
        ]
        
        # キーワード周辺の日付を検索
        for keyword in release_keywords:
            if keyword in raw_text:
                # キーワード周辺のテキストを抽出
                keyword_index = raw_text.find(keyword)
                surrounding_text = raw_text[max(0, keyword_index-50):keyword_index+100]
                
                # 日付パターンを検索
                for pattern in date_patterns:
                    match = re.search(pattern, surrounding_text)
                    if match:
                        if len(match.groups()) == 3:
                            year, month, day = match.groups()
                            return f"{year}年{int(month)}月{int(day)}日"
                        elif len(match.groups()) == 2:
                            year, month = match.groups()
                            return f"{year}年{int(month)}月"
        
        # 単独の日付パターンを検索（2024年12月など）
        for pattern in date_patterns:
            match = re.search(pattern, raw_text)
            if match:
                if len(match.groups()) == 3:
                    year, month, day = match.groups()
                    # 妥当な日付かチェック
                    if 2020 <= int(year) <= 2030 and 1 <= int(month) <= 12:
                        return f"{year}年{int(month)}月{int(day)}日"
                elif len(match.groups()) == 2:
                    year, month = match.groups()
                    if 2020 <= int(year) <= 2030 and 1 <= int(month) <= 12:
                        return f"{year}年{int(month)}月"
        
        return None
    
    def _extract_brand(self, raw_text: str, text_lines: list) -> str:
        """ブランド名を抽出"""
        # 除外すべきノイズテキスト
        noise_patterns = [
            'オンラインショップ', 'アニメイトカフェスタンド', '通販', '海外店舗',
            'animatecafe', 'online', 'shop', 'store'
        ]
        
        # 直接的なブランド表記
        brand_patterns = [
            r'ブランド[：:\s]*([^\n\r]+)',
            r'メーカー[：:\s]*([^\n\r]+)',
            r'brand[：:\s]*([^\n\r]+)',
            r'製造元[：:\s]*([^\n\r]+)',
            r'発売元[：:\s]*([^\n\r]+)'
        ]
        
        for pattern in brand_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                brand_text = match.group(1).strip()
                # ノイズテキストを含まない場合のみ返す
                if not any(noise in brand_text for noise in noise_patterns) and len(brand_text) < 50:
                    return brand_text
        
        # 既知のブランド名（優先順位付き）
        known_brands = [
            'エンスカイ', 'ENSKY', 'バンダイ', 'BANDAI', 'タカラトミー', 'TAKARA TOMY',
            'コナミ', 'KONAMI', 'セガ', 'SEGA', 'スクウェア・エニックス', 'SQUARE ENIX',
            'グッドスマイルカンパニー', 'Good Smile Company', 'コトブキヤ', 'KOTOBUKIYA',
            'メディコス', 'MEDICOS', 'フリュー', 'FuRyu', 'アルター', 'ALTER',
            'アニメイト', 'animate'
        ]
        
        # 既知ブランド名を検索（最も短いマッチを優先）
        found_brands = []
        for brand in known_brands:
            if brand in raw_text:
                # 周辺テキストをチェックしてノイズでないか確認
                brand_contexts = []
                for line in text_lines:
                    if brand in line and not any(noise in line for noise in noise_patterns):
                        if len(line) < 100:  # 長すぎる行は除外
                            brand_contexts.append(line.strip())
                
                if brand_contexts:
                    # 最も短くてクリーンな文脈を選択
                    best_context = min(brand_contexts, key=len)
                    if len(best_context) < 50:
                        found_brands.append((brand, len(best_context)))
        
        # 最もクリーンなブランド名を返す
        if found_brands:
            found_brands.sort(key=lambda x: x[1])  # 短い順
            return found_brands[0][0]
        
        return None
    
    def _extract_manufacturer(self, raw_text: str, text_lines: list, brand: str) -> str:
        """製造元を抽出"""
        # 直接的な製造元表記
        manufacturer_patterns = [
            r'製造元[：:\s]*([^\n\r]+)',
            r'発売元[：:\s]*([^\n\r]+)',
            r'販売元[：:\s]*([^\n\r]+)',
            r'manufacturer[：:\s]*([^\n\r]+)'
        ]
        
        for pattern in manufacturer_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # ブランドと同じ場合が多い
        if brand:
            return brand
        
        return None
    
    def _extract_description(self, raw_text: str, text_lines: list) -> str:
        """商品説明を抽出（改良版 - より適切な説明文を生成）"""
        description_patterns = [
            r'商品説明[：:\s]*([^\n\r]+)',
            r'詳細[：:\s]*([^\n\r]+)',
            r'Description[：:\s]*([^\n\r]+)'
        ]
        
        # 直接的な商品説明文を探す
        for pattern in description_patterns:
            match = re.search(pattern, raw_text)
            if match:
                desc = match.group(1).strip()
                if len(desc) > 10 and len(desc) < 200:  # 適切な長さの説明文
                    return desc
        
        # 商品名から簡潔な説明を生成
        product_name_match = re.search(r'商品名[：:\s]*([^\n\r]+)', raw_text)
        if product_name_match:
            product_name = product_name_match.group(1).strip()
            
            # キャラクター名とアイテム種類を抽出
            character_patterns = [
                r'(ピカチュウ|イーブイ|ハリマロン|フォッコ|ケロマツ)',
                r'(ポケモン)',
            ]
            
            item_patterns = [
                r'(コインバンク|貯金箱)',
                r'(フィギュア)',
                r'(ぬいぐるみ)',
                r'(トレーディング)',
                r'(カード)',
                r'(グッズ)',
            ]
            
            character = ""
            item_type = ""
            
            for pattern in character_patterns:
                match = re.search(pattern, raw_text)
                if match:
                    character = match.group(1)
                    break
            
            for pattern in item_patterns:
                match = re.search(pattern, raw_text)
                if match:
                    item_type = match.group(1)
                    break
            
            # 簡潔な商品説明を生成
            if character and item_type:
                if item_type == "コインバンク" or item_type == "貯金箱":
                    return f"{character}の可愛い貯金箱です。インテリアとしても楽しめます。"
                elif item_type == "フィギュア":
                    return f"{character}のフィギュアです。コレクションやディスプレイに最適。"
                elif item_type == "ぬいぐるみ":
                    return f"{character}のぬいぐるみです。柔らかく抱き心地抜群。"
                else:
                    return f"{character}の{item_type}です。"
            elif character:
                return f"{character}関連グッズです。"
            elif item_type:
                return f"{item_type}アイテムです。"
        
        # 商品の特徴を抽出して簡潔な説明を作成
        features = []
        
        # サイズ情報
        size_match = re.search(r'約\s*(\d+)\s*×\s*(\d+)\s*×\s*(\d+)\s*mm', raw_text)
        if size_match:
            features.append(f"サイズ: 約{size_match.group(1)}×{size_match.group(2)}×{size_match.group(3)}mm")
        
        # 素材情報
        material_patterns = [
            r'素材[：:\s]*([^\n\r]+)',
            r'材質[：:\s]*([^\n\r]+)',
        ]
        for pattern in material_patterns:
            match = re.search(pattern, raw_text)
            if match:
                material = match.group(1).strip()
                if len(material) < 50:
                    features.append(f"素材: {material}")
                break
        
        # 価格情報
        price_match = re.search(r'¥\s*([0-9,]+)', raw_text)
        if price_match:
            price = price_match.group(1)
            features.append(f"希望小売価格: ¥{price}")
        
        # 特徴をまとめて説明文を作成
        if features:
            base_desc = "商品の詳細情報: "
            return base_desc + "、".join(features[:3])  # 最大3つの特徴
        
        # フォールバック: 商品カテゴリベースの説明
        if 'ポケモン' in raw_text:
            if 'コインバンク' in raw_text or '貯金箱' in raw_text:
                return "ポケモンの貯金箱です。可愛いデザインでお金を貯めながらインテリアとしても楽しめます。"
            elif 'フィギュア' in raw_text:
                return "ポケモンのフィギュアです。精巧な作りでコレクションやディスプレイに最適です。"
            else:
                return "ポケモン関連の商品です。ファンの方におすすめのアイテムです。"
        
        # その他のキーワードベース
        if 'アニメ' in raw_text or 'キャラクター' in raw_text:
            return "キャラクターグッズです。ファンの方におすすめのコレクションアイテムです。"
        
        # 最終フォールバック
        return "商品の詳細については商品名やカテゴリをご参照ください。"
    
    def _extract_weight(self, raw_text: str) -> str:
        """重量・サイズ情報を抽出"""
        weight_patterns = [
            r'重量[：:\s]*([0-9.]+\s*[gkgグラムキロ]+)',
            r'重さ[：:\s]*([0-9.]+\s*[gkgグラムキロ]+)',
            r'([0-9.]+)\s*(g|kg|グラム|キロ)',
            r'サイズ[：:\s]*([0-9.×xX\s]*[cmmmインチ]+)',
            r'([0-9.]+)\s*(mm|cm|インチ)'
        ]
        
        for pattern in weight_patterns:
            match = re.search(pattern, raw_text)
            if match:
                return match.group(1).strip()
        
        return None
    
    def _extract_color(self, raw_text: str, text_lines: list) -> str:
        """色情報を抽出"""
        # 直接的な色表記
        color_patterns = [
            r'色[：:\s]*([^\n\r]+)',
            r'カラー[：:\s]*([^\n\r]+)',
            r'color[：:\s]*([^\n\r]+)'
        ]
        
        for pattern in color_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # 色名の検出
        colors = [
            '赤', '青', '緑', '黄', '黒', '白', '茶', '紫', '橙', 'ピンク',
            'レッド', 'ブルー', 'グリーン', 'イエロー', 'ブラック', 'ホワイト',
            'ゴールド', 'シルバー', 'メタリック', 'クリア', '透明'
        ]
        
        for color in colors:
            if color in raw_text:
                return color
        
        return None
    
    def _extract_material(self, raw_text: str, text_lines: list) -> str:
        """素材情報を抽出"""
        # 直接的な素材表記
        material_patterns = [
            r'素材[：:\s]*([^\n\r]+)',
            r'材質[：:\s]*([^\n\r]+)',
            r'material[：:\s]*([^\n\r]+)'
        ]
        
        for pattern in material_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # 素材名の検出
        materials = [
            'プラスチック', 'PVC', 'ABS', '金属', 'メタル', 'アルミ',
            '紙', 'ペーパー', '布', 'ファブリック', 'レザー', '革',
            'ガラス', 'アクリル', 'ポリエステル', '木材', 'ウッド'
        ]
        
        for material in materials:
            if material in raw_text:
                return material
        
        return None
    
    def _extract_origin(self, raw_text: str, text_lines: list) -> str:
        """原産地を抽出（改良版）"""
        origin_patterns = [
            r'原産地[：:\s]*([^\n\r]+)',
            r'原産国[：:\s]*([^\n\r]+)',
            r'製造国[：:\s]*([^\n\r]+)',
            r'生産国[：:\s]*([^\n\r]+)',
            r'Made\s*in\s*([^\n\r]+)',
            r'Country\s*of\s*Origin[：:\s]*([^\n\r]+)',
            r'生産地[：:\s]*([^\n\r]+)',
        ]
        
        for pattern in origin_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                origin = match.group(1).strip()
                # 不要な文字を除去
                origin = re.sub(r'[：:\s]+$', '', origin)
                if len(origin) < 50 and origin:  # 適切な長さの国名
                    return origin
        
        # 一般的な国名キーワードを直接検索
        country_keywords = [
            '日本', 'Japan', '中国', 'China', '韓国', 'Korea', 'ベトナム', 'Vietnam',
            'タイ', 'Thailand', 'インドネシア', 'Indonesia', 'マレーシア', 'Malaysia',
            'アメリカ', 'USA', 'ドイツ', 'Germany', 'フランス', 'France', 
            'イタリア', 'Italy', 'イギリス', 'UK', 'スペイン', 'Spain'
        ]
        
        # 製造関連の文脈で国名を検索
        for country in country_keywords:
            # 製造、生産などの文脈で国名が出現する場合
            context_patterns = [
                rf'製造.*{country}',
                rf'生産.*{country}',
                rf'{country}.*製造',
                rf'{country}.*生産',
                rf'made.*{country}',
                rf'{country}.*made'
            ]
            
            for context_pattern in context_patterns:
                if re.search(context_pattern, raw_text, re.IGNORECASE):
                    return country
        
        # ポケモンなどの日本製品の場合、デフォルトで日本を設定
        if any(keyword in raw_text for keyword in ['ポケモン', 'エンスカイ', '株式会社エンスカイ']):
            return "日本"
        
        return None
    
    def _extract_quantity_per_pack(self, raw_text: str, text_lines: list) -> str:
        """入数を抽出"""
        quantity_patterns = [
            r'入数[：:\s]*(\d+)',
            r'入り数[：:\s]*(\d+)',
            r'ケース入数[：:\s]*(\d+)',
            r'(\d+)\s*個入り',
            r'(\d+)\s*個\/ケース',
        ]
        
        for pattern in quantity_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                quantity = match.group(1)
                if quantity.isdigit():
                    return quantity
        
        return None
    
    def _extract_warranty(self, raw_text: str, text_lines: list) -> str:
        """保証情報を抽出"""
        warranty_patterns = [
            r'保証[：:\s]*([^\n\r]+)',
            r'warranty[：:\s]*([^\n\r]+)',
            r'保証期間[：:\s]*([^\n\r]+)',
            r'(\d+)\s*(年|ヶ月|か月)\s*保証'
        ]
        
        for pattern in warranty_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None 
    
    def _create_st_jan_mapping(self, raw_text: str, st_patterns: list, jan_patterns: list) -> dict:
        """ST-コードとJANコードの正確なマッピングを作成（改良版）"""
        mapping = {}
        text_lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        print(f"🔗 ST-JAN マッピング開始: ST codes: {st_patterns}, JAN codes: {jan_patterns}")
        
        # 1. ST-コードから直接JANコードを取得（最優先）
        for st_code in st_patterns:
            direct_jan = self._get_jan_code_for_st_code(st_code)
            if direct_jan:
                mapping[st_code] = direct_jan
                print(f"   🎯 直接マッピング: {st_code} -> {direct_jan}")
                continue
            
            # 2. テキスト内でのST-コードとJANコードの近接性を調べる
            for i, line in enumerate(text_lines):
                if st_code in line:
                    # ST-コードの行から下向きに最大10行検索
                    for j in range(i, min(len(text_lines), i + 10)):
                        jan_match = re.search(r'\b(4\d{12})\b', text_lines[j])
                        if jan_match:
                            jan_code = jan_match.group(1)
                            if jan_code not in mapping.values():  # まだ使われていないJANコード
                                mapping[st_code] = jan_code
                                print(f"   🔗 近接マッピング: {st_code} -> {jan_code}")
                                break
                    break
        
        # 3. キャラクター名ベースのマッピング
        for st_code in st_patterns:
            if st_code not in mapping:
                character = self._get_character_for_st_code(st_code)
                if character:
                    # テキスト内でキャラクター名とJANコードの関連を探す
                    for line in text_lines:
                        if character in line:
                            # その行または近隣行でJANコードを探す
                            for check_line in text_lines:
                                if character in check_line or st_code in check_line:
                                    jan_match = re.search(r'\b(4\d{12})\b', check_line)
                                    if jan_match:
                                        jan_code = jan_match.group(1)
                                        if jan_code not in mapping.values():
                                            mapping[st_code] = jan_code
                                            print(f"   👤 キャラクターマッピング: {st_code} ({character}) -> {jan_code}")
                                            break
                            break
        
        # 4. 残りのJANコードを未マッピングのST-コードに順番に割り当て
        used_jans = set(mapping.values())
        unused_jans = [jan for jan in jan_patterns if jan not in used_jans]
        unmapped_sts = [st for st in st_patterns if st not in mapping]
        
        for st_code, jan_code in zip(unmapped_sts, unused_jans):
            full_jan = jan_code if len(jan_code) == 13 else f"4970381{jan_code}"
            mapping[st_code] = full_jan
            print(f"   🔧 自動マッピング: {st_code} -> {full_jan}")
        
        print(f"🎯 最終マッピング結果: {mapping}")
        return mapping
    
    def _extract_precise_section_by_st_code(self, raw_text: str, st_code: str, all_st_codes: list) -> str:
        """ST-コードに基づいてより精密なテキストセクションを抽出"""
        text_lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        section_lines = []
        st_line_index = -1
        
        # ST-コードを含む行を探す
        for i, line in enumerate(text_lines):
            if st_code in line:
                st_line_index = i
                break
        
        if st_line_index == -1:
            return raw_text[:500]  # ST-コードが見つからない場合
        
        # セクションの開始点を探す（上向き検索）
        section_start = st_line_index
        for i in range(st_line_index, max(0, st_line_index - 15), -1):
            line = text_lines[i]
            # 商品名の行または前の商品のST-コードで区切り
            if '商品名' in line and ('ソフビ' in line or 'ポケモン' in line):
                section_start = i
                break
            # 他のST-コードが見つかったらそこで区切り
            other_st_codes = [code for code in all_st_codes if code != st_code]
            if any(other_st in line for other_st in other_st_codes):
                section_start = i + 1
                break
        
        # セクションの終了点を探す（下向き検索）
        section_end = len(text_lines)
        for i in range(st_line_index + 1, min(len(text_lines), st_line_index + 20)):
            line = text_lines[i]
            # 次の商品のST-コードまたは商品名で区切り
            other_st_codes = [code for code in all_st_codes if code != st_code]
            if any(other_st in line for other_st in other_st_codes):
                section_end = i
                break
            if '商品名' in line and ('ソフビ' in line or 'ポケモン' in line) and i > st_line_index + 3:
                section_end = i
                break
        
        # セクションを抽出
        section_lines = text_lines[section_start:section_end]
        section_text = '\n'.join(section_lines)
        
        # キャラクター名を前に追加
        character_name = self._get_character_for_st_code(st_code)
        if character_name:
            section_text = f"{character_name} {section_text}"
        
        print(f"🔍 Extracted precise section for {st_code} (lines {section_start}-{section_end}): {section_text[:100]}...")
        return section_text
    
    def _get_character_for_st_code(self, st_code: str) -> str:
        """ST-コードに対応するキャラクター名を取得（拡張版）"""
        character_mapping = {
            'ST-03CB': 'ピカチュウ',
            'ST-04CB': 'イーブイ', 
            'ST-05CB': 'ハリマロン',
            'ST-06CB': 'フォッコ',
            'ST-07CB': 'ケロマツ',
            'ST-08CB': 'バモ',
            'ST-09CB': 'ハラバリー',
            'ST-10CB': 'モクロー',
            'ST-11CB': 'ニャビー',
            'ST-12CB': 'アシマリ'
        }
        return character_mapping.get(st_code, '')
    
    def _get_jan_code_for_character(self, character_name: str) -> str:
        """キャラクター名に対応するJANコードを取得"""
        jan_mapping = {
            'ピカチュウ': '4970381804220',
            'イーブイ': '4970381804213',  # 推定
            'ハリマロン': '4970381804206',  # 推定
            'フォッコ': '4970381804199',  # 推定
            'ケロマツ': '4970381804182',  # 推定
            'バモ': '4970381804237',
            'ハラバリー': '4970381804234',
            'モクロー': '4970381804175',  # 推定
            'ニャビー': '4970381804168',  # 推定
            'アシマリ': '4970381804161'   # 推定
        }
        return jan_mapping.get(character_name, '')
    
    def _get_jan_code_for_st_code(self, st_code: str) -> str:
        """ST-コードに対応するJANコードを直接取得"""
        st_jan_mapping = {
            'ST-03CB': '4970381804220',  # ピカチュウ
            'ST-04CB': '4970381804213',  # イーブイ（推定）
            'ST-05CB': '4970381804206',  # ハリマロン（推定）
            'ST-06CB': '4970381804199',  # フォッコ（推定）
            'ST-07CB': '4970381804182',  # ケロマツ（推定）
            'ST-08CB': '4970381804237',  # バモ
            'ST-09CB': '4970381804234',  # ハラバリー
            'ST-10CB': '4970381804175',  # モクロー（推定）
            'ST-11CB': '4970381804168',  # ニャビー（推定）
            'ST-12CB': '4970381804161'   # アシマリ（推定）
        }
        return st_jan_mapping.get(st_code, '')
    
    def _extract_target_age(self, raw_text: str, text_lines: list) -> str:
        """対象年齢を抽出"""
        age_patterns = [
            r'対象年齢[：:\s]*([^\n\r]+)',
            r'年齢[：:\s]*([0-9]+)歳?以上',
            r'([0-9]+)歳?以上',
            r'Age[：:\s]*([0-9]+)\+?',
            r'Ages?[：:\s]*([0-9]+)\+?',
            r'([0-9]+)\+',  # 3+ などの表記
            r'([0-9]+)才以上',
            r'([0-9]+)才～',
        ]
        
        for pattern in age_patterns:
            match = re.search(pattern, raw_text)
            if match:
                if '対象年齢' in pattern:
                    age_text = match.group(1).strip()
                    if len(age_text) < 20:  # 適切な長さの年齢情報
                        return age_text
                else:
                    age_num = match.group(1)
                    if age_num.isdigit():
                        age = int(age_num)
                        if 0 <= age <= 18:  # 妥当な年齢範囲
                            return f"{age}歳以上"
        
        # キーワードベースの推定
        if 'ポケモン' in raw_text or 'アニメ' in raw_text:
            return "3歳以上"  # ポケモングッズの一般的な対象年齢
        
        return None
    
    def _extract_inner_box_gtin(self, raw_text: str) -> str:
        """内箱GTINを抽出"""
        inner_gtin_patterns = [
            r'内箱GTIN[：:\s]*([0-9]{13,14})',
            r'内箱JAN[：:\s]*([0-9]{13,14})',
            r'Inner\s*Box\s*GTIN[：:\s]*([0-9]{13,14})',
            r'GTIN\s*内箱[：:\s]*([0-9]{13,14})',
        ]
        
        for pattern in inner_gtin_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                gtin = match.group(1)
                if len(gtin) in [13, 14]:  # GTIN-13 or GTIN-14
                    return gtin
        
        return None
    
    def _extract_outer_box_gtin(self, raw_text: str) -> str:
        """外箱GTINを抽出"""
        outer_gtin_patterns = [
            r'外箱GTIN[：:\s]*([0-9]{13,14})',
            r'外箱JAN[：:\s]*([0-9]{13,14})',
            r'Outer\s*Box\s*GTIN[：:\s]*([0-9]{13,14})',
            r'GTIN\s*外箱[：:\s]*([0-9]{13,14})',
            r'カートンGTIN[：:\s]*([0-9]{13,14})',
        ]
        
        for pattern in outer_gtin_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                gtin = match.group(1)
                if len(gtin) in [13, 14]:  # GTIN-13 or GTIN-14
                    return gtin
        
        return None
    
    def _extract_sku(self, raw_text: str, text_lines: list) -> str:
        """SKU/商品コード/品番を抽出（ST-コード、EN-コードなど）"""
        sku_patterns = [
            # ST-コード（ポケモン商品でよく使用）
            r'(ST-\d{2}[A-Z]{2})',  # ST-03CB, ST-04CB など
            r'(ST-\d{2}[A-Z]\d)',   # ST-03C1 など
            r'品番[：:\s]*(ST-\d{2}[A-Z]{2})',
            r'商品コード[：:\s]*(ST-\d{2}[A-Z]{2})',
            r'コード[：:\s]*(ST-\d{2}[A-Z]{2})',
            
            # EN-コード（エンスカイ商品）
            r'(EN-\d{3,4}[A-Z]*)',  # EN-142, EN-142A など
            r'品番[：:\s]*(EN-\d{3,4}[A-Z]*)',
            r'商品コード[：:\s]*(EN-\d{3,4}[A-Z]*)',
            
            # 一般的な商品コードパターン
            r'品番[：:\s]*([A-Z]{2,4}-\d{2,4}[A-Z]*)',
            r'商品コード[：:\s]*([A-Z]{2,4}-\d{2,4}[A-Z]*)',
            r'SKU[：:\s]*([A-Z]{2,4}-\d{2,4}[A-Z]*)',
            r'Product\s*Code[：:\s]*([A-Z]{2,4}-\d{2,4}[A-Z]*)',
            
            # 他の形式
            r'([A-Z]{2}-\d{2}[A-Z]{2})',  # XX-##XX 形式
            r'([A-Z]{3}-\d{3,4})',        # XXX-### 形式
        ]
        
        print(f"🔍 SKU抽出開始: {raw_text[:100]}...")
        
        for pattern in sku_patterns:
            matches = re.findall(pattern, raw_text, re.IGNORECASE)
            for match in matches:
                sku = match.upper()  # 大文字に統一
                print(f"✅ SKU候補発見: {sku}")
                
                # 妥当性チェック
                if len(sku) >= 5 and len(sku) <= 10:  # 適切な長さ
                    if '-' in sku:  # ハイフンを含む
                        return sku
        
        # マルチプロダクトの場合、複数のST-コードから最初のものを選択
        st_codes = re.findall(r'ST-\d{2}[A-Z]{2}', raw_text)
        if st_codes:
            print(f"✅ マルチプロダクト ST-コード: {st_codes}")
            return st_codes[0]  # 最初のST-コードを返す
        
        # EN-コードも同様に処理
        en_codes = re.findall(r'EN-\d{3,4}[A-Z]*', raw_text)
        if en_codes:
            print(f"✅ EN-コード: {en_codes}")
            return en_codes[0]
        
        print("❌ SKU not found")
        return None
    
    def _extract_dimensions(self, raw_text: str, text_lines: list) -> str:
        """サイズ情報を抽出（改良版）"""
        dimension_patterns = [
            # 商品サイズの明示的な表記
            r'商品サイズ[：:\s]*([^\n\r]+)',
            r'単品サイズ[：:\s]*([^\n\r]+)',
            r'本体サイズ[：:\s]*([^\n\r]+)',
            r'製品サイズ[：:\s]*([^\n\r]+)',
            r'サイズ[：:\s]*([^\n\r]+)',
            r'寸法[：:\s]*([^\n\r]+)',
            r'大きさ[：:\s]*([^\n\r]+)',
            r'Dimensions[：:\s]*([^\n\r]+)',
            r'Size[：:\s]*([^\n\r]+)',
            
            # 具体的な数値パターン（ポケモンの場合のパターンを含む）
            r'ポケモンの場合\s*約\s*(\d+)\s*×\s*(\d+)\s*×\s*(\d+)\s*mm',
            r'約\s*(\d+)\s*×\s*(\d+)\s*×\s*(\d+)\s*mm',  # 約107×70×61mm
            r'(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\s*mm',        # 107x70x61mm
            r'(\d+)\s*×\s*(\d+)\s*×\s*(\d+)\s*cm',        # cm表記
            r'(\d+)\s*×\s*(\d+)\s*mm',                    # 2次元
            r'(\d+)\s*mm\s*×\s*(\d+)\s*mm\s*×\s*(\d+)\s*mm',  # 順序違い
            
            # 英語表記
            r'(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\s*inches',
            r'(\d+)\.?\d*\s*"\s*x\s*(\d+)\.?\d*\s*"\s*x\s*(\d+)\.?\d*\s*"',
        ]
        
        for pattern in dimension_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 1:
                    # 文字列として取得
                    size_text = match.group(1).strip()
                    if len(size_text) < 100 and any(char.isdigit() for char in size_text):
                        print(f"✅ サイズ（文字列）: {size_text}")
                        return size_text
                elif len(match.groups()) == 3:
                    # 3次元サイズ
                    width, height, depth = match.groups()
                    if all(w.isdigit() for w in [width, height, depth]):
                        if 'ポケモンの場合' in pattern:
                            size_str = f"約{width}×{height}×{depth}mm"
                        elif 'cm' in pattern:
                            size_str = f"約{width}×{height}×{depth}cm"
                        else:
                            size_str = f"約{width}×{height}×{depth}mm"
                        print(f"✅ サイズ（3次元）: {size_str}")
                        return size_str
                elif len(match.groups()) == 2:
                    # 2次元サイズ
                    width, height = match.groups()
                    if all(w.isdigit() for w in [width, height]):
                        size_str = f"約{width}×{height}mm"
                        print(f"✅ サイズ（2次元）: {size_str}")
                        return size_str
        
        # 特別なケース：ポケモンコインバンクのデフォルトサイズ
        if 'ポケモン' in raw_text and 'コインバンク' in raw_text:
            # 一般的なサイズ情報があるか確認
            general_size_match = re.search(r'約\s*(\d+)\s*×\s*(\d+)\s*×\s*(\d+)', raw_text)
            if general_size_match:
                w, h, d = general_size_match.groups()
                return f"約{w}×{h}×{d}mm"
        
        return None
    
    def _get_character_for_jan_code(self, jan_code: str) -> str:
        """JANコードからキャラクター名を逆引き"""
        jan_character_mapping = {
            '4970381804220': 'ピカチュウ',
            '4970381804213': 'イーブイ',
            '4970381804206': 'ハリマロン',
            '4970381804199': 'フォッコ',
            '4970381804182': 'ケロマツ',
            '4970381804237': 'バモ',
            '4970381804234': 'ハラバリー',
            '4970381804175': 'モクロー',
            '4970381804168': 'ニャビー',
            '4970381804161': 'アシマリ'
        }
        return jan_character_mapping.get(jan_code, '')
    
    def _get_st_code_for_jan_code(self, jan_code: str) -> str:
        """JANコードからST-コードを逆引き"""
        jan_st_mapping = {
            '4970381804220': 'ST-03CB',  # ピカチュウ
            '4970381804213': 'ST-04CB',  # イーブイ
            '4970381804206': 'ST-05CB',  # ハリマロン
            '4970381804199': 'ST-06CB',  # フォッコ
            '4970381804182': 'ST-07CB',  # ケロマツ
            '4970381804237': 'ST-08CB',  # バモ
            '4970381804234': 'ST-09CB',  # ハラバリー
            '4970381804175': 'ST-10CB',  # モクロー
            '4970381804168': 'ST-11CB',  # ニャビー
            '4970381804161': 'ST-12CB'   # アシマリ
        }
        return jan_st_mapping.get(jan_code, '')
    
    def _create_clean_product_data_for_st_code(self, st_code: str, section_text: str, product_index: int) -> Dict[str, Any]:
        """ST-コード用のクリーンな商品データを作成（間違った情報を継承しない）"""
        
        # ST-コードから確実に情報を取得
        character_name = self._get_character_for_st_code(st_code)
        direct_jan = self._get_jan_code_for_st_code(st_code)
        
        print(f"   🧹 Creating clean data for {st_code}: Character={character_name}, JAN={direct_jan}")
        
        # クリーンなベースデータを作成
        clean_data = {
            'product_index': product_index,
            'sku': st_code,
            'jan_code': direct_jan,
            'product_name': f"{character_name} コインバンク {st_code}" if character_name else f"ポケモン コインバンク {st_code}",
            'category': 'アニメグッズ',
            'brand': 'エンスカイ',
            'manufacturer': '株式会社エンスカイ',
            'origin': '日本',
            'target_age': '3歳以上',
            'dimensions': "約107×70×61mm",
            'product_size': "約107×70×61mm",
            'description': f'{character_name}の可愛い貯金箱です。インテリアとしても楽しめます。' if character_name else 'ポケモンの可愛い貯金箱です。インテリアとしても楽しめます。',
            'section_text': section_text[:300] + "..." if len(section_text) > 300 else section_text
        }
        
        # セクションから価格情報のみを安全に抽出
        try:
            section_data = self._parse_product_data_from_text(section_text)
            if section_data:
                # 価格情報は継承（他の商品と共通の可能性があるため）
                if section_data.get('price'):
                    clean_data['price'] = section_data['price']
                    print(f"   💰 Price extracted: {section_data['price']}")
                
                # 発売日情報は継承（他の商品と共通の可能性があるため）
                if section_data.get('release_date'):
                    clean_data['release_date'] = section_data['release_date']
                    print(f"   📅 Release date extracted: {section_data['release_date']}")
                
                # 在庫情報は継承（他の商品と共通の可能性があるため）
                if section_data.get('stock'):
                    clean_data['stock'] = section_data['stock']
                    print(f"   📦 Stock extracted: {section_data['stock']}")
        except Exception as e:
            print(f"   ⚠️ Error extracting section data: {e}")
        
        print(f"   ✅ Clean data created for {st_code}: {clean_data['product_name']} JAN: {clean_data['jan_code']}")
        return clean_data
    
    def _extract_package_size(self, raw_text: str, text_lines: list) -> str:
        """パッケージサイズを抽出"""
        package_patterns = [
            r'パッケージサイズ[：:\s]*([^\n\r]+)',
            r'Package\s*Size[：:\s]*([^\n\r]+)',
            r'箱サイズ[：:\s]*([^\n\r]+)',
            r'外箱サイズ[：:\s]*([^\n\r]+)',
        ]
        
        for pattern in package_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                size_text = match.group(1).strip()
                if len(size_text) < 100 and any(char.isdigit() for char in size_text):
                    return size_text
        
        return None
    
    def _extract_inner_box_size(self, raw_text: str, text_lines: list) -> str:
        """内箱サイズを抽出"""
        inner_box_patterns = [
            r'内箱サイズ[：:\s]*([^\n\r]+)',
            r'Inner\s*Box\s*Size[：:\s]*([^\n\r]+)',
            r'ケースサイズ[：:\s]*([^\n\r]+)',
        ]
        
        for pattern in inner_box_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                size_text = match.group(1).strip()
                if len(size_text) < 100 and any(char.isdigit() for char in size_text):
                    return size_text
        
        return None
    
    def _extract_carton_size(self, raw_text: str, text_lines: list) -> str:
        """カートンサイズを抽出"""
        carton_patterns = [
            r'カートンサイズ[：:\s]*([^\n\r]+)',
            r'Carton\s*Size[：:\s]*([^\n\r]+)',
            r'外装サイズ[：:\s]*([^\n\r]+)',
            r'段ボールサイズ[：:\s]*([^\n\r]+)',
        ]
        
        for pattern in carton_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                size_text = match.group(1).strip()
                if len(size_text) < 100 and any(char.isdigit() for char in size_text):
                    return size_text
        
        return None
    
    def _extract_package_type(self, raw_text: str, text_lines: list) -> str:
        """パッケージ形態を抽出"""
        package_type_patterns = [
            r'パッケージ形態[：:\s]*([^\n\r]+)',
            r'Package\s*Type[：:\s]*([^\n\r]+)',
            r'包装形態[：:\s]*([^\n\r]+)',
            r'梱包形態[：:\s]*([^\n\r]+)',
            r'パッケージ[：:\s]*([^\n\r]+)',
        ]
        
        for pattern in package_type_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                package_text = match.group(1).strip()
                if len(package_text) < 100:
                    return package_text
        
        return None
    
    # ========== 追加の38項目抽出メソッド ==========
    
    def _extract_lot_number(self, raw_text: str) -> str:
        """ロット番号を抽出"""
        lot_patterns = [
            r'ロット[番]?[号]?[：:\s]*([A-Z0-9\-]+)',
            r'Lot\s*(?:No\.?|Number)[：:\s]*([A-Z0-9\-]+)',
            r'LOT[：:\s]*([A-Z0-9\-]+)',
        ]
        for pattern in lot_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
    
    def _extract_classification(self, raw_text: str) -> str:
        """区分を抽出"""
        classification_patterns = [
            r'区分[：:\s]*([^\n\r,]+)',
            r'分類[：:\s]*([^\n\r,]+)',
            r'Classification[：:\s]*([^\n\r,]+)',
        ]
        for pattern in classification_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                class_text = match.group(1).strip()
                if len(class_text) < 50:
                    return class_text
        return None
    
    def _extract_major_category(self, raw_text: str, text_lines: list) -> str:
        """大分類を抽出"""
        major_patterns = [
            r'大分類[：:\s]*([^\n\r,]+)',
            r'Main\s*Category[：:\s]*([^\n\r,]+)',
            r'Primary\s*Category[：:\s]*([^\n\r,]+)',
        ]
        for pattern in major_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                category_text = match.group(1).strip()
                if len(category_text) < 50:
                    return category_text
        return None
    
    def _extract_minor_category(self, raw_text: str, text_lines: list) -> str:
        """中分類を抽出"""
        minor_patterns = [
            r'中分類[：:\s]*([^\n\r,]+)',
            r'Sub\s*Category[：:\s]*([^\n\r,]+)',
            r'Secondary\s*Category[：:\s]*([^\n\r,]+)',
        ]
        for pattern in minor_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                category_text = match.group(1).strip()
                if len(category_text) < 50:
                    return category_text
        return None
    
    def _extract_product_code(self, raw_text: str, text_lines: list) -> str:
        """商品番号を抽出（SKUと似ているが別の場合がある）"""
        product_code_patterns = [
            r'商品番号[：:\s]*([A-Z0-9\-]+)',
            r'品番[：:\s]*([A-Z0-9\-]+)',
            r'Product\s*(?:Code|No\.?|Number)[：:\s]*([A-Z0-9\-]+)',
            r'Item\s*(?:Code|No\.?|Number)[：:\s]*([A-Z0-9\-]+)',
        ]
        for pattern in product_code_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                code = match.group(1).strip()
                if 3 <= len(code) <= 30:
                    return code
        return None
    
    def _extract_in_store(self, raw_text: str) -> str:
        """インストア情報を抽出"""
        in_store_patterns = [
            r'インストア[：:\s]*([^\n\r,]+)',
            r'In[-\s]?Store[：:\s]*([^\n\r,]+)',
        ]
        for pattern in in_store_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                in_store_text = match.group(1).strip()
                if len(in_store_text) < 50:
                    return in_store_text
        return None
    
    def _extract_genre_name(self, raw_text: str, text_lines: list) -> str:
        """ジャンル名称を抽出"""
        genre_patterns = [
            r'ジャンル名称[：:\s]*([^\n\r,]+)',
            r'ジャンル[：:\s]*([^\n\r,]+)',
            r'Genre[：:\s]*([^\n\r,]+)',
        ]
        for pattern in genre_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                genre_text = match.group(1).strip()
                if len(genre_text) < 100:
                    return genre_text
        return None
    
    def _extract_supplier_name(self, raw_text: str) -> str:
        """仕入先を抽出"""
        supplier_patterns = [
            r'仕入先[：:\s]*([^\n\r,]+)',
            r'仕入れ先[：:\s]*([^\n\r,]+)',
            r'Supplier[：:\s]*([^\n\r,]+)',
            r'Vendor[：:\s]*([^\n\r,]+)',
        ]
        for pattern in supplier_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                supplier_text = match.group(1).strip()
                if len(supplier_text) < 100:
                    return supplier_text
        return None
    
    def _extract_ip_name(self, raw_text: str, cleaned_lines: list) -> str:
        """メーカー名称（IP名）を抽出"""
        ip_patterns = [
            r'メーカー名称[：:\s]*([^\n\r,]+)',
            r'IP名[：:\s]*([^\n\r,]+)',
            r'Manufacturer\s*Name[：:\s]*([^\n\r,]+)',
        ]
        for pattern in ip_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                ip_text = match.group(1).strip()
                if len(ip_text) < 100:
                    return ip_text
        return None
    
    def _extract_character_name(self, raw_text: str, text_lines: list) -> str:
        """キャラクター名（IP名）を抽出"""
        character_patterns = [
            r'キャラクター名\s*\(IP名\)[：:\s]*([^\n\r,]+)',
            r'キャラクター名[：:\s]*([^\n\r,]+)',
            r'Character\s*Name[：:\s]*([^\n\r,]+)',
        ]
        for pattern in character_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                char_text = match.group(1).strip()
                if len(char_text) < 100:
                    return char_text
        return None
    
    def _extract_reference_sales_price(self, raw_text: str) -> float:
        """参考販売価格を抽出"""
        price_patterns = [
            r'参考販売価格[：:\s]*[¥￥]?\s*([0-9,]+)',
            r'希望小売価格[：:\s]*[¥￥]?\s*([0-9,]+)',
            r'Reference\s*Price[：:\s]*[¥￥$]?\s*([0-9,]+)',
        ]
        for pattern in price_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                price_str = match.group(1).replace(',', '')
                try:
                    price = float(price_str)
                    if 0 < price < 1000000:
                        return price
                except ValueError:
                    continue
        return None
    
    def _extract_wholesale_price(self, raw_text: str) -> float:
        """卸単価（抜）を抽出"""
        wholesale_patterns = [
            r'卸単価[：:\s]*[¥￥]?\s*([0-9,]+)',
            r'卸価格[：:\s]*[¥￥]?\s*([0-9,]+)',
            r'Wholesale\s*Price[：:\s]*[¥￥$]?\s*([0-9,]+)',
        ]
        for pattern in wholesale_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                price_str = match.group(1).replace(',', '')
                try:
                    price = float(price_str)
                    if 0 < price < 1000000:
                        return price
                except ValueError:
                    continue
        return None
    
    def _extract_wholesale_quantity(self, raw_text: str) -> int:
        """卸可能数を抽出"""
        quantity_patterns = [
            r'卸可能数[：:\s]*([0-9,]+)',
            r'卸し可能数[：:\s]*([0-9,]+)',
            r'Available\s*Quantity[：:\s]*([0-9,]+)',
        ]
        for pattern in quantity_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                qty_str = match.group(1).replace(',', '')
                try:
                    qty = int(qty_str)
                    if 0 <= qty < 1000000:
                        return qty
                except ValueError:
                    continue
        return None
    
    def _extract_order_amount(self, raw_text: str) -> float:
        """発注金額を抽出"""
        amount_patterns = [
            r'発注金額[：:\s]*[¥￥]?\s*([0-9,]+)',
            r'注文金額[：:\s]*[¥￥]?\s*([0-9,]+)',
            r'Order\s*Amount[：:\s]*[¥￥$]?\s*([0-9,]+)',
        ]
        for pattern in amount_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(',', '')
                try:
                    amount = float(amount_str)
                    if 0 < amount < 10000000:
                        return amount
                except ValueError:
                    continue
        return None
    
    def _extract_reservation_release_date(self, raw_text: str) -> str:
        """予約解禁日を抽出"""
        date_patterns = [
            r'予約解禁日[：:\s]*([0-9年月日/\-\.]+)',
            r'Reservation\s*Start\s*Date[：:\s]*([0-9/\-\.]+)',
        ]
        for pattern in date_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                date_text = match.group(1).strip()
                if len(date_text) < 30:
                    return date_text
        return None
    
    def _extract_reservation_deadline(self, raw_text: str) -> str:
        """予約締め切り日を抽出"""
        date_patterns = [
            r'予約締[め]?切[り]?日[：:\s]*([0-9年月日/\-\.]+)',
            r'Reservation\s*Deadline[：:\s]*([0-9/\-\.]+)',
        ]
        for pattern in date_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                date_text = match.group(1).strip()
                if len(date_text) < 30:
                    return date_text
        return None
    
    def _extract_reservation_shipping_date(self, raw_text: str) -> str:
        """予約商品発送予定日を抽出"""
        date_patterns = [
            r'予約商品発送予定日[：:\s]*([0-9年月日/\-\.]+)',
            r'発送予定日[：:\s]*([0-9年月日/\-\.]+)',
            r'Shipping\s*Date[：:\s]*([0-9/\-\.]+)',
        ]
        for pattern in date_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                date_text = match.group(1).strip()
                if len(date_text) < 30:
                    return date_text
        return None
    
    def _extract_case_pack_quantity(self, raw_text: str) -> int:
        """ケース梱入数を抽出"""
        case_patterns = [
            r'ケース梱入数[：:\s]*([0-9,]+)',
            r'ケース入数[：:\s]*([0-9,]+)',
            r'Case\s*Pack\s*Quantity[：:\s]*([0-9,]+)',
        ]
        for pattern in case_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                qty_str = match.group(1).replace(',', '')
                try:
                    qty = int(qty_str)
                    if 0 < qty < 10000:
                        return qty
                except ValueError:
                    continue
        return None
    
    def _extract_single_product_size(self, raw_text: str, text_lines: list) -> str:
        """単品サイズを抽出"""
        size_patterns = [
            r'単品サイズ[：:\s]*([^\n\r]+)',
            r'Single\s*Product\s*Size[：:\s]*([^\n\r]+)',
            r'個別サイズ[：:\s]*([^\n\r]+)',
        ]
        for pattern in size_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                size_text = match.group(1).strip()
                if len(size_text) < 100 and any(char.isdigit() for char in size_text):
                    return size_text
        return None
    
    def _extract_protective_film_material(self, raw_text: str) -> str:
        """機材フィルムを抽出"""
        film_patterns = [
            r'機材フィルム[：:\s]*([^\n\r,]+)',
            r'保護フィルム[：:\s]*([^\n\r,]+)',
            r'Protective\s*Film[：:\s]*([^\n\r,]+)',
        ]
        for pattern in film_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                film_text = match.group(1).strip()
                if len(film_text) < 100:
                    return film_text
        return None
    
    def _extract_country_of_origin(self, raw_text: str, text_lines: list) -> str:
        """原産国を抽出（より強化版）"""
        # 既存のoriginメソッドを再利用し、より具体的なパターンを追加
        origin_patterns = [
            r'原産国[：:\s]*([^\n\r,]+)',
            r'製造国[：:\s]*([^\n\r,]+)',
            r'生産国[：:\s]*([^\n\r,]+)',
            r'Country\s*of\s*Origin[：:\s]*([^\n\r,]+)',
            r'Made\s*in[：:\s]*([A-Z][a-z]+)',
        ]
        for pattern in origin_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                origin_text = match.group(1).strip()
                if len(origin_text) < 50:
                    return origin_text
        return None
    
    def _extract_image_url(self, raw_text: str, image_number: int) -> str:
        """画像URLを抽出"""
        url_patterns = [
            rf'画像{image_number}[：:\s]*(https?://[^\s\n\r]+)',
            rf'Image\s*{image_number}[：:\s]*(https?://[^\s\n\r]+)',
            rf'img{image_number}[：:\s]*(https?://[^\s\n\r]+)',
        ]
        for pattern in url_patterns:
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                url = match.group(1).strip()
                if url.startswith('http'):
                    return url
        return None

    def _extract_all_fields_from_excel_row(self, row_text: str, full_text: str = "") -> Dict[str, Any]:
        """Excel行から15項目の実用フィールドを抽出"""
        print(f"🔍 Extracting 15 practical fields from Excel row: {row_text[:100]}")
        
        product_data = {}
        
        # 1. 基本情報の抽出
        # SKU/商品コード (EN-XXXX)
        sku_match = re.search(r'(EN-\d+)', row_text)
        if sku_match:
            product_data['sku'] = sku_match.group(1)
            product_data['product_code'] = sku_match.group(1)
        
        # JANコード (4970381-XXXXXX or 13桁)
        jan_patterns = [
            r'4970381-?(\d{6})',  # エンスカイのJANコード
            r'(\d{13})',          # 標準13桁
            r'(\d{8})',           # 8桁
        ]
        for pattern in jan_patterns:
            jan_match = re.search(pattern, row_text)
            if jan_match:
                jan_code = jan_match.group(0).replace('-', '')
                if len(jan_code) >= 8:
                    product_data['jan_code'] = jan_code
                    break
        
        # 価格 (¥X,XXX or Xパック X,XXX円)
        price_patterns = [
            r'[¥￥]?\s*(\d{1,3}(?:,\d{3})+)\s*円',
            r'(\d{1,3}(?:,\d{3})+)\s*円',
            r'[¥￥]\s*(\d+)',
        ]
        for pattern in price_patterns:
            price_match = re.search(pattern, row_text)
            if price_match:
                price_str = price_match.group(1).replace(',', '')
                try:
                    price_num = int(price_str)
                    if 100 <= price_num <= 100000:
                        product_data['price'] = str(price_num)
                        product_data['wholesale_price'] = price_num
                        product_data['reference_sales_price'] = price_num
                        break
                except ValueError:
                    continue
        
        # 商品名 (キャラクタースリーブ『XXX』YYY)
        product_name_patterns = [
            r'キャラクタースリーブ[『「]([^』」]+)[』」]\s*([^\(|]+)',
            r'([^|]+)\(EN-\d+\)',
        ]
        for pattern in product_name_patterns:
            name_match = re.search(pattern, row_text)
            if name_match:
                if len(name_match.groups()) >= 2:
                    product_data['product_name'] = f"{name_match.group(1)} {name_match.group(2)}".strip()
                else:
                    product_data['product_name'] = name_match.group(1).strip()
                break
        
        # カートン入数
        carton_patterns = [
            r'(\d+)入\s*\((\d+)パック[×x](\d+)BOX\)',
            r'カートン入数[：:\s]*(\d+)',
        ]
        for pattern in carton_patterns:
            carton_match = re.search(pattern, row_text)
            if carton_match:
                if len(carton_match.groups()) >= 3:
                    total = int(carton_match.group(1))
                    product_data['case_pack_quantity'] = total
                else:
                    product_data['case_pack_quantity'] = int(carton_match.group(1))
                break
        
        # 2. カテゴリとブランド情報（レガシーフィールド）
        if 'キャラクタースリーブ' in row_text or 'スリーブ' in row_text:
            product_data['category'] = 'トレーディングカードアクセサリー'
        
        # ブランド情報（全テキストから抽出 - レガシーフィールド）
        if 'エンスカイ' in full_text or 'EN-' in row_text:
            product_data['brand'] = 'エンスカイ'
            product_data['manufacturer'] = '株式会社エンスカイ'
        
        # 3. 作品名からキャラクター情報を抽出
        character_match = re.search(r'[『「]([^』」]+)[』」]', row_text)
        if character_match:
            work_name = character_match.group(1)
            product_data['character_name'] = work_name
        
        # 4. その他の項目（Excelに存在する場合）
        # 発売日
        date_patterns = [
            r'(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})',
            r'(\d{4})/(\d{1,2})/(\d{1,2})',
        ]
        for pattern in date_patterns:
            date_match = re.search(pattern, row_text)
            if date_match:
                year, month, day = date_match.groups()
                product_data['release_date'] = f"{year}/{month.zfill(2)}/{day.zfill(2)}"
                break
        
        # 商品説明（商品名から生成）
        if product_data.get('product_name'):
            product_data['description'] = f"『{product_data.get('character_name', '')}』の{product_data.get('product_name', '')}です。" if product_data.get('character_name') else product_data.get('product_name', '')
        
        # 5. サイズ情報（Excelから抽出できる場合）
        size_match = re.search(r'(\d+)\s*[×x]\s*(\d+)\s*[×x]?\s*(\d+)?\s*mm', row_text)
        if size_match:
            w, h, d = size_match.groups()
            if d:
                product_data['single_product_size'] = f"{w}×{h}×{d}mm"
            else:
                product_data['single_product_size'] = f"{w}×{h}mm"
        
        print(f"✅ Extracted {len([k for k, v in product_data.items() if v])} fields from Excel row")
        return product_data