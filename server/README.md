# Conex AI-OCR Backend Server

A powerful FastAPI-based backend server for OCR (Optical Character Recognition) document processing with AI capabilities.

## 🚀 Features

- **Fast OCR Processing**: Tesseract-based OCR with AI enhancements
- **Multi-format Support**: PDF, PNG, JPG, JPEG, TIFF, BMP
- **Async Processing**: Background job processing with Celery + Redis
- **User Authentication**: JWT-based auth with refresh tokens
- **File Management**: Secure file upload with S3 integration
- **Data Export**: CSV, JSON, Excel export capabilities
- **Database Support**: PostgreSQL with async SQLAlchemy
- **API Documentation**: Auto-generated OpenAPI/Swagger docs
- **Production Ready**: Docker support, logging, monitoring

## 📋 Prerequisites

- Python 3.9+
- PostgreSQL 12+
- Redis 6+
- Tesseract OCR

### Install Tesseract

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-jpn
```

**macOS:**
```bash
brew install tesseract tesseract-lang
```

**Windows:**
Download from: https://github.com/UB-Mannheim/tesseract/wiki

## 🛠️ Installation

### 1. Clone and Setup

```bash
# Navigate to server directory
cd server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Database Setup

```bash
# Install PostgreSQL and create database
sudo -u postgres psql
CREATE DATABASE ocr_db;
CREATE USER ocr_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ocr_db TO ocr_user;
\q
```

### 3. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env with your settings
nano .env
```

Required environment variables:
```env
DATABASE_URL=postgresql://ocr_user:your_password@localhost:5432/ocr_db
SECRET_KEY=your-super-secret-key
REDIS_URL=redis://localhost:6379/0
TESSERACT_PATH=/usr/bin/tesseract
```

### 4. Initialize Database

```bash
# Run database migrations
python -m app.core.database
```

## 🚀 Running the Server

### Development

```bash
# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production

```bash
# Install production server
pip install gunicorn

# Run with Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Background Tasks (Celery)

```bash
# Start Redis
redis-server

# Start Celery worker
celery -A app.tasks.celery_app worker --loglevel=info

# Start Celery beat (for scheduled tasks)
celery -A app.tasks.celery_app beat --loglevel=info
```

## 📚 API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:8000/api/v1/docs
- **ReDoc**: http://localhost:8000/api/v1/redoc
- **OpenAPI JSON**: http://localhost:8000/api/v1/openapi.json

## 🔐 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user info

### File Management
- `POST /api/v1/files/upload` - Upload file
- `GET /api/v1/files/` - List user files
- `GET /api/v1/files/{file_id}` - Get file details
- `DELETE /api/v1/files/{file_id}` - Delete file

### OCR Conversion
- `POST /api/v1/conversion/start` - Start OCR job
- `GET /api/v1/conversion/` - List conversion jobs
- `GET /api/v1/conversion/{job_id}` - Get job status
- `POST /api/v1/conversion/{job_id}/cancel` - Cancel job

### Data Management
- `GET /api/v1/data/` - List extracted data
- `GET /api/v1/data/{data_id}` - Get specific data
- `PUT /api/v1/data/{data_id}` - Update extracted data
- `POST /api/v1/data/{data_id}/validate` - Validate data

### Export
- `POST /api/v1/export/csv` - Export to CSV
- `POST /api/v1/export/json` - Export to JSON
- `POST /api/v1/export/excel` - Export to Excel

## 🐳 Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/ocr_db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    environment:
      POSTGRES_DB: ocr_db
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    
  worker:
    build: .
    command: celery -A app.tasks.celery_app worker --loglevel=info
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
```

Run with:
```bash
docker-compose up -d
```

## 🔧 Configuration

### OCR Settings

```python
# app/core/config.py
TESSERACT_PATH = "/usr/bin/tesseract"
OCR_LANGUAGES = ["eng", "jpn"]  # Supported languages
DEFAULT_DPI = 300  # Image resolution for OCR
```

### File Upload Limits

```python
MAX_FILE_SIZE = 50  # MB
ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "tiff", "bmp"]
```

### Security Settings

```python
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
SECRET_KEY = "your-secret-key"
```

## 🧪 Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest

# Run with coverage
pytest --cov=app tests/
```

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8000/health
```

### Logs

```bash
# View application logs
tail -f logs/app.log

# View error logs
tail -f logs/error.log
```

## 🚀 Production Deployment

### Environment Setup

1. **Database**: Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
2. **Redis**: Use managed Redis (AWS ElastiCache, Redis Cloud)
3. **File Storage**: Configure AWS S3 or similar
4. **Monitoring**: Set up logging and monitoring

### Security Checklist

- [ ] Change default SECRET_KEY
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable database backups
- [ ] Configure log rotation

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the API documentation
- Review the logs for errors

## 🔄 Version History

- **v1.0.0** - Initial release with core OCR functionality
- **v1.1.0** - Added batch processing and improved accuracy
- **v1.2.0** - Added table extraction and form processing

---

Built with ❤️ using FastAPI, SQLAlchemy, and Tesseract OCR. 