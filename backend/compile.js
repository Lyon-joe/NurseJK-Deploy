import fs from 'fs';
import { execSync } from 'child_process';
import * as esbuild from 'esbuild';

const BUNDLE_FILE = 'dist-server.js';
const CONFIG_FILE = 'sea-config.json';
const BLOB_FILE = 'sea-prep.blob';
const EXE_OUTPUT = 'nursing-ai-assistant.exe';

console.log('📦 Starting 100% self-contained executable generation...');

try {
  // 1. Clean build using esbuild string replacements to swap bcrypt for bcryptjs
  console.log('⚡ Step 1: Inlining dependencies and swapping bcrypt configuration...');
  await esbuild.build({
    entryPoints: ['server.js'],
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    outfile: BUNDLE_FILE,
    alias: {
      'bcrypt': 'bcryptjs' // ✨ Built-in esbuild system configuration mapping
    }
  });

  // 2. Write the configuration pointing to the bundled code
  const seaConfig = { 
    main: BUNDLE_FILE, 
    output: BLOB_FILE, 
    disableSentinel: true 
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(seaConfig, null, 2));

  // 3. Generate the binary blob
  console.log('⚙️  Step 2: Generating preparation blob...');
  execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit' });

  // 4. Copy your local system's node runtime
  console.log('📄 Step 3: Cloning Node.js environment shell...');
  fs.copyFileSync(process.execPath, EXE_OUTPUT);

  // 5. Inject the code using the Node v24 sentinel fuse string
  console.log('🚀 Step 4: Injecting code blob into executable container...');
  execSync(`npx postject ${EXE_OUTPUT} NODE_SEA_BLOB ${BLOB_FILE} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit' });

  console.log('✨ Success! A completely independent nursing-ai-assistant.exe is ready.');
} catch (error) {
  console.error('❌ Build failed during compilation steps:', error.message);
} finally {
  // Clean up temporary files
  if (fs.existsSync(BUNDLE_FILE)) fs.unlinkSync(BUNDLE_FILE);
  if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
  if (fs.existsSync(BLOB_FILE)) fs.unlinkSync(BLOB_FILE);
}