const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

describe('Docker Compose Container Naming', () => {
  let dockerCompose;
  
  beforeAll(() => {
    const dockerComposePath = path.join(__dirname, '../docker-compose.yml');
    const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
    dockerCompose = yaml.load(dockerComposeContent);
  });

  it('should have all container names with ovh-techlabs prefix', () => {
    const services = dockerCompose.services;
    const expectedPrefix = 'ovh-techlabs-';
    
    const containerNames = Object.values(services)
      .map(service => service.container_name)
      .filter(name => name); // Filter out undefined values
    
    containerNames.forEach(containerName => {
      expect(containerName).toMatch(new RegExp(`^${expectedPrefix}`));
    });
  });

  it('should have specific container names following ovh-techlabs-xyz pattern', () => {
    const expectedContainerNames = [
      'ovh-techlabs-postgres',
      'ovh-techlabs-redis',
      'ovh-techlabs-api',
      'ovh-techlabs-celery-worker',
      'ovh-techlabs-celery-beat',
      'ovh-techlabs-frontend'
    ];

    const actualContainerNames = Object.values(dockerCompose.services)
      .map(service => service.container_name)
      .filter(name => name)
      .sort();

    expect(actualContainerNames).toEqual(expectedContainerNames.sort());
  });

  it('should have network name with ovh-techlabs prefix', () => {
    const networkName = dockerCompose.networks?.default?.name;
    expect(networkName).toBe('ovh-techlabs-network');
  });
});