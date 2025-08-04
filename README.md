# OVHcloud TechLabs - Deployment and Removal Tools

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Programmatic deployment and removal tools for OVHcloud TechLabs environments - Automated infrastructure management using Terraform and OVHcloud Public Cloud APIs.

## Project Status

**Status**: Active development - Official TechLabs project  
**Support Level**: OVHcloud TechLabs team  
**Type**: Infrastructure automation and deployment tools

> **Note**: This repository contains the production automation platform used to deploy and manage OVHcloud TechLabs workshop environments programmatically.

## Quick Links

- **Source Repository**: [https://github.com/cougz/ovh-techlabs-deployment-and-removal](https://github.com/cougz/ovh-techlabs-deployment-and-removal)
- **Related**: [TechLabs Workbooks](https://github.com/cougz/ovh-techlabs-workbooks)

## Overview

This repository contains the core infrastructure deployment and removal tools used to programmatically manage TechLabs environments. The platform automates the complete lifecycle of cloud resources using Terraform, Docker, and OVHcloud APIs.

**Key Capabilities:**
- ✅ Automated Terraform-based resource deployment
- ✅ Programmatic environment cleanup and removal  
- ✅ OVHcloud Public Cloud API integration
- ✅ Docker-based deployment orchestration
- ✅ Workshop lifecycle management
- ✅ Real-time deployment monitoring
- ✅ Reliable cleanup mechanisms with retry logic

## Technology Stack

### Infrastructure Automation
- **Terraform**: Infrastructure as Code for OVHcloud Public Cloud
- **Docker Compose**: Container orchestration and deployment
- **OVHcloud APIs**: Resource provisioning and management
- **Celery**: Distributed task processing for deployments

### Backend Systems  
- **FastAPI**: Python-based REST API for deployment orchestration
- **PostgreSQL**: Database for deployment state and configuration
- **Redis**: Task queue and caching layer
- **WebSocket**: Real-time deployment status updates

### Frontend Dashboard
- **React 18**: Modern web interface for deployment monitoring
- **TypeScript**: Type-safe frontend development  
- **Redux Toolkit**: State management for deployment workflows
- **Tailwind CSS**: Responsive UI styling

## Repository Structure

```
ovh-techlabs-deployment-and-removal/
├── api/                      # FastAPI backend services
│   ├── routes/              # API endpoints for deployments
│   ├── services/            # Terraform and deployment services
│   ├── tasks/               # Celery background tasks
│   └── models/              # Database models for resources
├── frontend/                # React deployment dashboard
│   ├── src/pages/           # Deployment monitoring pages
│   ├── src/components/      # UI components for status display
│   └── src/services/        # API client for deployment calls
├── database/                # PostgreSQL schemas and migrations
├── docker/                  # Nginx configuration
├── docs/                    # Additional documentation
├── docker-compose.yml       # Production deployment config
├── docker-compose.dev.yml   # Development environment
├── rebuild.sh               # Platform rebuild script
├── .env.example             # Environment configuration template
├── AUTHORS                  # Copyright holders
├── CONTRIBUTING.md          # Contribution guidelines
├── CONTRIBUTORS             # List of contributors
├── LICENSE                  # MIT License
├── LICENSES/                # License information
└── MAINTAINERS             # Project maintainers
```

## Quick Start

### Prerequisites

- Docker and Docker Compose v2
- OVHcloud account with API credentials
- Terraform (for local development)

### Environment Setup

1. **Configure OVHcloud credentials:**
```bash
cp .env.example .env
# Edit .env with your OVHcloud API credentials from api.ovh.com/createToken
```

2. **Deploy the platform:**
```bash
# Production deployment
docker compose up -d

# Development with hot reload
docker compose -f docker-compose.dev.yml up -d
```

3. **Access the deployment dashboard:**
   - Production: `http://localhost:3000`
   - Development: `http://localhost:3001`

### Safe Platform Updates

```bash
# Rebuild platform preserving all deployment data
./rebuild.sh

# Reset all data (use with caution)
./rebuild.sh --reset-data
```

## Deployment Operations

### Creating Workshop Environments

The platform provides programmatic APIs for deploying isolated cloud environments:

```bash
# Create workshop with Terraform deployment
curl -X POST http://localhost:8000/api/workshops \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "AI Workshop",
    "template": "ai-endpoints",
    "attendee_count": 20,
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T17:00:00Z"
  }'
```

### Monitoring Deployments

Real-time deployment status via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/deployments');
ws.onmessage = (event) => {
  const status = JSON.parse(event.data);
  console.log('Deployment status:', status);
};
```

### Automated Cleanup

The platform includes robust cleanup mechanisms:

- **Scheduled Removal**: Environments automatically cleaned up after workshop ends
- **Manual Cleanup**: On-demand resource removal via API
- **Retry Logic**: Failed cleanups are automatically retried
- **State Recovery**: Terraform state is preserved for reliable operations

```bash
# Trigger manual cleanup
curl -X POST http://localhost:8000/api/workshops/{workshop_id}/cleanup \
  -H "Authorization: Bearer <token>"

# Process scheduled cleanups
curl -X POST http://localhost:8000/api/workshops/process-lifecycle \
  -H "Authorization: Bearer <token>"
```

## Terraform Integration

### Workshop Templates

The platform uses Terraform modules for different workshop types:

- **AI Endpoints**: GPU instances with pre-configured AI environments
- **Public Cloud**: Basic compute and networking resources
- **Custom Templates**: Configurable resource deployments

### Resource Management

- **State Management**: Terraform state stored securely in backend
- **Parallel Deployments**: Multiple environments deployed concurrently  
- **Resource Tagging**: All resources tagged for lifecycle management
- **Cost Optimization**: Automatic resource sizing and cleanup

## Monitoring and Operations

### Health Checks

```bash
# Platform health
curl http://localhost:8000/health

# Container status
docker compose ps

# View deployment logs
docker logs ovh-techlabs-deployment-and-removal-api-1
docker logs ovh-techlabs-deployment-and-removal-celery-worker-1
```

### Deployment Metrics

The platform tracks key deployment metrics:

- Resource provisioning time
- Deployment success/failure rates  
- Cleanup completion status
- Cost per workshop environment

## Security Considerations

- **API Authentication**: JWT-based authentication for all operations
- **Credential Management**: Secure storage of OVHcloud API keys
- **Network Security**: Isolated environments for each workshop
- **Audit Logging**: Complete audit trail of all deployment operations

## Development

### Backend Development

```bash
# Set up Python environment
cd api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run Celery worker
celery -A main.celery worker --loglevel=info
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
```

### Database Management

```bash
# Run migrations
python database/migrations/migrate.py migrate

# Check migration status
python database/migrations/migrate.py status
```

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for detailed guidelines on:

- Adding new Terraform templates
- Improving deployment reliability  
- Extending the monitoring dashboard
- Optimizing resource usage

## Maintainers

See [MAINTAINERS](MAINTAINERS) for the list of project maintainers.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**OVHcloud TechLabs** - This repository contains the production-ready automation tools used to deploy and manage OVHcloud TechLabs environments programmatically. The platform is designed for scalability, reliability, and efficient resource management.