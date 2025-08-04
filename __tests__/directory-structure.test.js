const fs = require('fs');
const path = require('path');

describe('Directory Structure', () => {
  const projectRoot = path.join(__dirname, '..');
  
  it('should have platform directory instead of docker directory', () => {
    const platformDir = path.join(projectRoot, 'platform');
    const dockerDir = path.join(projectRoot, 'docker');
    
    expect(fs.existsSync(platformDir)).toBe(true);
    expect(fs.existsSync(dockerDir)).toBe(false);
  });

  it('should have docker-compose.yml in platform directory', () => {
    const dockerComposePath = path.join(projectRoot, 'platform', 'docker-compose.yml');
    expect(fs.existsSync(dockerComposePath)).toBe(true);
  });

  it('should have api directory in platform directory', () => {
    const apiPath = path.join(projectRoot, 'platform', 'api');
    expect(fs.existsSync(apiPath)).toBe(true);
  });

  it('should have frontend directory in platform directory', () => {
    const frontendPath = path.join(projectRoot, 'platform', 'frontend');
    expect(fs.existsSync(frontendPath)).toBe(true);
  });

  it('should have rebuild.sh script in project root that works with platform directory', () => {
    const rebuildScriptPath = path.join(projectRoot, 'rebuild.sh');
    const scriptContent = fs.readFileSync(rebuildScriptPath, 'utf8');
    
    expect(fs.existsSync(rebuildScriptPath)).toBe(true);
    expect(scriptContent).toContain('elif [ -d "platform" ]; then');
    expect(scriptContent).toContain('DOCKER_DIR="platform"');
  });
});