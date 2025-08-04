const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Rebuild Script Functionality', () => {
  const projectRoot = path.join(__dirname, '..');
  const rebuildScript = path.join(projectRoot, 'rebuild.sh');
  
  it('should detect platform directory correctly', () => {
    const scriptContent = fs.readFileSync(rebuildScript, 'utf8');
    
    // Should contain logic to detect platform directory
    expect(scriptContent).toContain('if [ -d "docker" ]; then');
    expect(scriptContent).toContain('elif [ -d "platform" ]; then');
    expect(scriptContent).toContain('DOCKER_DIR="platform"');
  });

  it('should have executable permissions', () => {
    const stats = fs.statSync(rebuildScript);
    const isExecutable = !!(stats.mode & parseInt('111', 8));
    expect(isExecutable).toBe(true);
  });

  it('should find platform directory when testing directory detection logic', () => {
    // Create a minimal test of the directory detection logic
    const platformExists = fs.existsSync(path.join(projectRoot, 'platform'));
    const dockerExists = fs.existsSync(path.join(projectRoot, 'docker'));
    
    expect(platformExists).toBe(true);
    expect(dockerExists).toBe(false);
    
    // Simulate the bash logic
    let detectedDir = '';
    if (fs.existsSync(path.join(projectRoot, 'docker'))) {
      detectedDir = 'docker';
    } else if (fs.existsSync(path.join(projectRoot, 'platform'))) {
      detectedDir = 'platform';
    }
    
    expect(detectedDir).toBe('platform');
  });

  it('should have required files in platform directory for rebuild', () => {
    const platformDir = path.join(projectRoot, 'platform');
    const requiredFiles = [
      'docker-compose.yml',
      'docker-compose.dev.yml',
      path.join('api', 'Dockerfile'),
      path.join('frontend', 'Dockerfile')
    ];
    
    requiredFiles.forEach(file => {
      const filePath = path.join(platformDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});