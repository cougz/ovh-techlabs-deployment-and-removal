# Contributing to OVHcloud TechLabs

Thank you for your interest in contributing to OVHcloud TechLabs! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct. We expect all contributors to be respectful, inclusive, and professional.

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in the GitHub issue tracker
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce (if applicable)
   - Expected vs actual behavior
   - Environment details (OS, versions, etc.)

### Submitting Changes

1. **Fork the repository** and create your branch from `main`
2. **Make your changes**:
   - Follow the coding standards below
   - Add tests for new functionality
   - Update documentation as needed
3. **Test your changes**:
   - Run existing tests: `npm test` (frontend) and `pytest` (backend)
   - Ensure all tests pass
   - Test manually in a development environment
4. **Submit a Pull Request**:
   - Provide a clear description of the changes
   - Reference any related issues
   - Ensure CI/CD checks pass

### Development Setup

#### Platform (Automation)
```bash
cd platform
docker-compose -f docker-compose.dev.yml up
```

#### Workbooks (Documentation)
```bash
cd workbooks
pip install mkdocs-material
mkdocs serve
```

## Coding Standards

### Python (Backend)
- Follow PEP 8
- Use type hints where appropriate
- Write docstrings for all functions and classes
- Maximum line length: 100 characters

### TypeScript/React (Frontend)
- Use functional components with hooks
- Follow ESLint configuration
- Use TypeScript types/interfaces
- Prefer named exports

### General
- Write meaningful commit messages
- Keep changes focused and atomic
- Add appropriate logging
- Consider security implications

## Adding New Features

### Platform Features
1. Discuss major changes in an issue first
2. Update API documentation
3. Add frontend components as needed
4. Include database migrations if required

### Workshop Content
1. Follow the existing tutorial structure
2. Include all necessary code samples
3. Test tutorials end-to-end
4. Update navigation in `mkdocs.yml`

## Testing

### Platform Testing
- Unit tests: `pytest` (backend), `npm test` (frontend)
- Integration tests for API endpoints
- E2E tests for critical workflows

### Workbook Testing
- Verify all code samples work
- Test on clean OVHcloud environment
- Check documentation builds correctly

## Documentation

- Update README files as needed
- Document new API endpoints
- Add JSDoc/docstrings for new functions
- Keep workshop instructions clear and concise

## Review Process

1. All submissions require review before merging
2. Reviewers will check:
   - Code quality and standards
   - Test coverage
   - Documentation updates
   - Security considerations
3. Address review feedback promptly

## Release Process

- Releases follow semantic versioning
- Changelog is maintained for all releases
- Docker images are automatically built and tagged

## Getting Help

- Check existing documentation
- Search through issues and discussions
- Ask questions in pull requests
- Contact maintainers listed in MAINTAINERS file

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to OVHcloud TechLabs!