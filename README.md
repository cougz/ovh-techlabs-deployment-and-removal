# TechLabs Automation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/release/python-311/)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-required-blue.svg)](https://www.docker.com/)

A comprehensive workshop environment management system designed to automate the lifecycle of OVHcloud Public Cloud Projects for technical workshops and customer demonstrations. The system eliminates manual deployment processes by providing a self-service platform where workshop organizers can create, manage, and automatically clean up isolated cloud environments for each attendee.

## 📌 Current Status

**Production Ready** - The system is fully operational and deployed in production. All features have been implemented and tested, including:
- ✅ Complete workshop lifecycle management
- ✅ OVH API integration with real resource provisioning
- ✅ CSV bulk import with OVH-compliant username validation
- ✅ Timezone-aware scheduling with automatic cleanup
- ✅ Dark mode theme with animated toggle
- ✅ Full test coverage (100% for implemented features)
- ✅ Docker deployment with health monitoring

## 🚀 Features

### Core Functionality
- **🔄 Automated Workshop Lifecycle**: Complete automation from creation to cleanup
- **🏢 Self-Service Platform**: Workshop organizers can manage environments independently
- **⏰ Scheduled Cleanup**: Automatic resource cleanup 72 hours after workshop completion
- **🏗️ Infrastructure-as-Code**: Terraform-based deployments for reliability and repeatability
- **💻 Modern Web Interface**: React-based dashboard with real-time updates

### Advanced Features
- **👥 Multi-Attendee Support**: Up to 50 attendees per workshop with isolated environments
- **📥 CSV Bulk Import**: Upload attendee lists with automatic validation and OVH-compliant username formatting
- **🌍 Timezone Support**: Workshop scheduling with timezone-aware dates and automatic cleanup
- **📋 Template System**: Extensible workshop templates (Generic template for OVH Public Cloud Projects)
- **🌓 Dark Mode**: Full dark theme support with animated toggle switch
- **🔐 Secure Credential Management**: Encrypted storage and automatic generation
- **📊 Real-time Monitoring**: Live deployment status and resource health checks
- **📧 Email Notifications**: Automated credential delivery and status updates
- **🔍 Audit Logging**: Complete activity tracking and deployment history
- **📱 Responsive Design**: Mobile-friendly interface with OVHcloud branding

## 🏗️ Architecture

### Technology Stack
- **Backend**: FastAPI with async support, Python 3.11+
- **Frontend**: React 18 with TypeScript, Redux Toolkit, Tailwind CSS, OVHcloud branding
- **Database**: PostgreSQL 15 with timezone-aware schemas and template support
- **Task Queue**: Celery with Redis for background processing
- **Infrastructure**: Terraform for OVHcloud resource orchestration
- **Deployment**: Docker Compose v2 with multi-stage builds
- **Monitoring**: Structured logging with health checks

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │    │   FastAPI       │    │   PostgreSQL    │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Terraform     │◄──►│   Celery        │◄──►│   Redis         │
│   (IaC Engine)  │    │   (Task Queue)  │    │   (Broker)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚦 Quick Start

### Prerequisites

- **Docker & Docker Compose v2**: Container orchestration
- **OVHcloud Account**: With API credentials configured
- **Node.js 18+**: For frontend development (optional)
- **Python 3.11+**: For backend development (optional)

### 🔧 Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/techlabs-automation.git
   cd techlabs-automation
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your OVHcloud API credentials
   ```

3. **Required OVHcloud Configuration**:
   ```bash
   # Get your API credentials from: https://eu.api.ovh.com/createToken/
   OVH_ENDPOINT=ovh-eu
   OVH_APPLICATION_KEY=your_application_key
   OVH_APPLICATION_SECRET=your_application_secret  
   OVH_CONSUMER_KEY=your_consumer_key
   ```

4. **Start development environment**:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   
   # View logs
   docker compose -f docker-compose.dev.yml logs -f
   ```

5. **Access the application**:
   - 🌐 **Frontend**: http://localhost:3000
   - 🔌 **API**: http://localhost:8000
   - 📚 **API Documentation**: http://localhost:8000/docs
   - 🗄️ **Database Admin**: http://localhost:5050 (PGAdmin)

6. **Default login credentials**:
   - **Username**: `admin`
   - **Password**: `admin`

### 🚀 Production Deployment

1. **Configure production environment**:
   ```bash
   cp .env.example .env
   # Set production values in .env
   ```

2. **Deploy with Docker Compose**:
   ```bash
   docker compose up -d
   ```

3. **Run database migrations**:
   ```bash
   docker compose exec api python database/migrations/migrate.py migrate
   ```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | ✅ |
| `DB_PASSWORD` | Database password | `postgres` | ✅ |
| `OVH_APPLICATION_KEY` | OVH API application key | - | ✅ |
| `OVH_APPLICATION_SECRET` | OVH API application secret | - | ✅ |
| `OVH_CONSUMER_KEY` | OVH API consumer key | - | ✅ |
| `SECRET_KEY` | Application secret key | - | ✅ |
| `SMTP_HOST` | Email server host | - | ❌ |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` | ✅ |

See [`.env.example`](.env.example) for complete configuration options.

## 📡 API Reference

### 🏫 Workshop Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/workshops` | Create new workshop |
| `GET` | `/api/workshops` | List all workshops |
| `GET` | `/api/workshops/{id}` | Get workshop details |
| `PUT` | `/api/workshops/{id}` | Update workshop |
| `DELETE` | `/api/workshops/{id}` | Delete workshop |
| `POST` | `/api/workshops/{id}/deploy` | Deploy all resources |
| `DELETE` | `/api/workshops/{id}/resources` | Manual cleanup |

### 👥 Attendee Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/attendees?workshop_id={id}` | Add attendee to workshop |
| `GET` | `/api/attendees/workshop/{id}` | List workshop attendees |
| `GET` | `/api/attendees/{id}` | Get attendee details |
| `DELETE` | `/api/attendees/{id}` | Remove attendee |
| `GET` | `/api/attendees/{id}/credentials` | Get attendee credentials |
| `POST` | `/api/attendees/{id}/deploy` | Deploy single attendee |
| `POST` | `/api/attendees/{id}/destroy` | Destroy attendee resources |

### 📊 Deployment Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/deployments/{id}` | Get deployment log details |
| `GET` | `/api/deployments/attendee/{id}` | Get attendee deployment logs |
| `GET` | `/api/deployments/workshop/{id}` | Get workshop deployment logs |

### 🔐 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Authenticate user |
| `POST` | `/api/auth/verify` | Verify access token |

## 🛠️ Development

### Backend Development

```bash
# Set up Python environment
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run database migrations
python database/migrations/migrate.py migrate

# Run Celery worker (separate terminal)
celery -A main.celery worker --loglevel=info

# Run Celery beat scheduler (separate terminal)
celery -A main.celery beat --loglevel=info
```

### Frontend Development

```bash
# Set up Node.js environment
cd frontend
npm install

# Run development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Lint and format code
npm run lint
npm run format
```

### Database Management

```bash
# Run migrations
python database/migrations/migrate.py migrate

# Check migration status
python database/migrations/migrate.py status

# Rollback migration
python database/migrations/migrate.py rollback --version 001_initial_schema
```

## 🧪 Testing

### Backend Tests
```bash
cd api
pytest --cov=. --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm test -- --coverage --watchAll=false
```

### Integration Tests
```bash
# Start test environment
docker compose -f docker-compose.test.yml up -d

# Run integration tests
pytest tests/integration/

# Cleanup
docker compose -f docker-compose.test.yml down -v
```

## 📋 Usage Guide

### Creating a Workshop

1. **Navigate to Workshops** → Click "New Workshop"
2. **Fill Workshop Details**:
   - Name and description
   - Start and end dates with timezone selection
   - Workshop template (Generic for OVH Public Cloud)
   - Workshop duration
3. **Add Attendees**: 
   - **Individual**: Enter username (dash-separated, e.g., john-doe) and email
   - **Bulk Import**: Upload CSV file (format: username,email per line)
   - **Note**: Usernames must use dashes, not dots or spaces (OVH IAM requirement)
4. **Deploy Resources**: Click "Deploy Workshop"
5. **Monitor Progress**: Real-time status updates via WebSocket
6. **Distribute Credentials**: Automatic email delivery or manual retrieval

### Managing Attendees

- **Add Individual**: Single attendee registration with OVH-compliant username validation
- **Bulk Import**: CSV file upload with automatic format validation
  - Format: `username,email` (one per line)
  - Example: `max-mustermann,max-mustermann@techlab.ovh`
  - Usernames must contain only alphanumeric, dash, underscore, plus symbols
- **Deploy Resources**: Individual or batch deployment with Terraform
- **View Credentials**: Secure credential retrieval from Terraform outputs
- **Monitor Status**: Real-time deployment tracking with WebSocket updates

### Resource Cleanup

- **Automatic**: 72 hours after workshop end (timezone-aware)
- **Manual**: Immediate cleanup via dashboard
- **Scheduled**: Automatic scheduling based on workshop timezone
- **Complete**: Removes all OVH resources, IAM policies, and Terraform state

## 🔧 Troubleshooting

### Common Issues

#### Docker Issues
```bash
# Clean up Docker resources
docker system prune -a
docker volume prune

# Rebuild containers
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

#### Database Connection Issues
```bash
# Check database status
docker compose logs postgres

# Reset database
docker compose down -v
docker compose up -d postgres
```

#### Terraform Issues
```bash
# Check Terraform workspace
docker compose exec api ls -la /tmp/terraform-workspaces

# Validate Terraform configuration
docker compose exec api terraform validate
```

### Logs and Monitoring

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f celery-worker

# Monitor resource usage
docker stats
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow coding standards
4. **Add tests**: Ensure good test coverage
5. **Commit changes**: Use conventional commits
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Submit Pull Request**: With detailed description

### Coding Standards

- **Python**: Follow PEP 8, use Black formatter
- **TypeScript**: Use ESLint + Prettier
- **Commits**: Use conventional commit format
- **Documentation**: Update README and inline docs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Full documentation](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/techlabs-automation/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/techlabs-automation/discussions)
- **Email**: support@techlabs-automation.com

## 🙏 Acknowledgments

- OVHcloud for cloud infrastructure
- Terraform for infrastructure automation
- FastAPI and React communities
- All contributors and testers

---

**Made with ❤️ for the developer community**