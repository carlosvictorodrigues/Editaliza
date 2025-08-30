/**
 * Sanitize text files to UTF-8 (no BOM) and remove mojibake/control chars.
 * Enhanced to cover more directories and better detection
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();

// Directories to skip
const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'backups',
  '.next',
  '.nuxt',
  'vendor',
  'tmp',
  'temp',
  '.idea',
  '.vscode'
];

// File extensions to process
const PROCESS_EXTENSIONS = [
  '.html', '.htm',
  '.js', '.jsx', '.ts', '.tsx', '.mjs',
  '.css', '.scss', '.sass', '.less',
  '.json', '.jsonc',
  '.md', '.markdown',
  '.txt', '.text',
  '.sql',
  '.yml', '.yaml',
  '.xml',
  '.env', '.env.example',
  '.sh', '.bat', '.cmd', '.ps1'
];

function shouldSkipDir(dirName) {
  return SKIP_DIRS.includes(dirName) || dirName.startsWith('.');
}

function listFiles(dir, exts) {
  const out = [];
  
  function walk(d) {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && shouldSkipDir(e.name)) continue;
        
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          walk(p);
        } else if (exts.includes(path.extname(e.name).toLowerCase())) {
          out.push(p);
        }
      }
    } catch (err) {
      console.warn(`[sanitize] Skipping inaccessible directory: ${d}`);
    }
  }
  
  walk(dir);
  return out;
}

function detectAndFixEncoding(buf, filePath) {
  let text = buf.toString('utf8');
  const original = text;
  
  // Common mojibake patterns (UTF-8 misinterpreted as Windows-1252/Latin1)
  const mojibakePatterns = [
    { pattern: /á/g, replacement: 'á' },
    { pattern: /é/g, replacement: 'é' },
    { pattern: /í/g, replacement: 'í' },
    { pattern: /ó/g, replacement: 'ó' },
    { pattern: /ú/g, replacement: 'ú' },
    { pattern: /à/g, replacement: 'à' },
    { pattern: /â/g, replacement: 'â' },
    { pattern: /ã/g, replacement: 'ã' },
    { pattern: /ç/g, replacement: 'ç' },
    { pattern: /Ã\u0081/g, replacement: 'Á' },
    { pattern: /Ã\u0089/g, replacement: 'É' },
    { pattern: /Ã\u008D/g, replacement: 'Í' },
    { pattern: /Ã\u0093/g, replacement: 'Ó' },
    { pattern: /Ú/g, replacement: 'Ú' },
    { pattern: /°/g, replacement: '°' },
    { pattern: /'/g, replacement: "'" },
    { pattern: /"/g, replacement: '"' },
    { pattern: /â€\u009D/g, replacement: '"' },
    { pattern: /—/g, replacement: '—' },
    { pattern: /•/g, replacement: '•' },
    { pattern: //g, replacement: '' }, // BOM visible as text
    { pattern: /🎯/g, replacement: '🎯' } // Corrupted emoji example
  ];
  
  // Apply known mojibake fixes
  let fixedText = text;
  for (const { pattern, replacement } of mojibakePatterns) {
    fixedText = fixedText.replace(pattern, replacement);
  }
  
  // Try double decoding fix (UTF-8 -> Latin1 -> UTF-8)
  const hasSuspiciousChars = /[ÃÂ][\u0080-\u00FF]/.test(fixedText);
  if (hasSuspiciousChars && fixedText === text) {
    try {
      const attemptFix = Buffer.from(fixedText, 'latin1').toString('utf8');
      // Check if the fix reduces mojibake patterns
      const beforeCount = (fixedText.match(/[ÃÂ]/g) || []).length;
      const afterCount = (attemptFix.match(/[ÃÂ]/g) || []).length;
      if (afterCount < beforeCount && !attemptFix.includes('\uFFFD')) {
        fixedText = attemptFix;
      }
    } catch (e) {
      // Keep original if conversion fails
    }
  }
  
  return fixedText;
}

function sanitizeContent(buf, filePath) {
  // Start with encoding detection and fixing
  let text = detectAndFixEncoding(buf, filePath);
  const original = buf.toString('utf8');
  
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  
  // Remove Unicode replacement character ( = U+FFFD)
  text = text.replace(/\uFFFD/g, '');
  
  // Remove NULL bytes and other control characters (except tab, newline, carriage return)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Remove non-breaking spaces that might cause issues
  text = text.replace(/\u00A0/g, ' ');
  
  // Fix zero-width characters
  text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  
  // Normalize line endings to LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Special handling for specific file types
  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    // JavaScript/TypeScript specific fixes
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(ext)) {
      // Fix template literal issues
      text = text.replace(/console\.log\(`\s*([^`]*?)\s*`\);/g, (m, g1) => {
        return m.includes('${') ? m : `console.log("${g1}");`;
      });
      
      // Remove debug console.log in production files
      if (filePath.includes('public')) {
        text = text.replace(/console\.log\(/g, 'void(');
      }
    }
    
    // HTML specific fixes
    if (['.html', '.htm'].includes(ext)) {
      // Remove debug script blocks
      text = text.replace(/<!--\s*DEBUG\s*START\s*-->[\s\S]*?<!--\s*DEBUG\s*END\s*-->/gi, '');
      text = text.replace(/<!--\s*SCRIPT DE TESTE.*?-->[\s\S]*?<\/script>\s*/gi, '');
    }
    
    // SQL specific fixes
    if (ext === '.sql') {
      // Fix common SQL encoding issues
      text = text.replace(/'/g, "'");
      text = text.replace(/—/g, "--");
    }
  }
  
  return {
    changed: text !== original,
    text: text
  };
}

function processFile(file) {
  try {
    const buf = fs.readFileSync(file);
    const { changed, text } = sanitizeContent(buf, file);
    
    if (changed) {
      // Create backup
      const backupPath = file + '.bak.beforeSanitize';
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, buf);
      }
      
      // Write sanitized content
      fs.writeFileSync(file, text, { encoding: 'utf8' });
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[sanitize] Failed to process:', file, e.message);
    return false;
  }
}

function main() {
  console.log('[sanitize] Starting comprehensive file sanitization...');
  console.log('[sanitize] Processing extensions:', PROCESS_EXTENSIONS.join(', '));
  console.log('[sanitize] Skipping directories:', SKIP_DIRS.join(', '));
  console.log('');
  
  const targets = [];
  
  // Directories to process
  const dirsToProcess = [
    '.',           // Root level files
    'public',
    'src',
    'js',
    'css',
    'tests',
    'docs',
    'migrations',
    'config',
    'utils',
    'scripts',
    'tools'
  ];
  
  // Collect all target files
  for (const dir of dirsToProcess) {
    const fullPath = path.join(root, dir);
    if (fs.existsSync(fullPath)) {
      if (dir === '.') {
        // For root, only process files, not subdirectories
        for (const file of fs.readdirSync(root)) {
          const filePath = path.join(root, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile() && PROCESS_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
            targets.push(filePath);
          }
        }
      } else {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          targets.push(...listFiles(fullPath, PROCESS_EXTENSIONS));
        }
      }
    }
  }
  
  console.log(`[sanitize] Found ${targets.length} files to process`);
  console.log('');
  
  let changed = 0;
  const changes = [];
  
  for (const f of targets) {
    if (processFile(f)) {
      changed++;
      const relPath = path.relative(root, f);
      changes.push(relPath);
      console.log(`[sanitize] ✅ Fixed: ${relPath}`);
    }
  }
  
  console.log('');
  console.log(`[sanitize] ✨ Completed! Files sanitized: ${changed}/${targets.length}`);
  
  if (changes.length > 0) {
    console.log('');
    console.log('[sanitize] Summary of changed files:');
    changes.forEach(f => console.log(`  - ${f}`));
    console.log('');
    console.log('[sanitize] Backup files created with .bak.beforeSanitize extension');
    console.log('[sanitize] To revert changes, restore from backup files');
  } else {
    console.log('[sanitize] No files needed sanitization - all files are clean! 🎉');
  }
}

// Run if called directly
if (require.main === module) {
  main();
} else {
  // Export for use as module
  module.exports = {
    sanitizeContent,
    processFile,
    listFiles,
    detectAndFixEncoding
  };
}