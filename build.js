const esbuild = require('esbuild');

// Build configuration
const buildConfig = {
  entryPoints: ['src/main.js'],
  bundle: true,
  outfile: 'content.js',
  format: 'iife', // Immediately Invoked Function Expression for browser compatibility
  target: 'es2020',
  minify: false, // Keep readable for debugging
  sourcemap: false,
  platform: 'browser',
  external: [], // No external dependencies
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  banner: {
    js: '// Content Script for Kokoro TTS Extension (Bundled from src/main.js)'
  }
};

// Build function
async function build() {
  try {
    console.log('Building content script from src/main.js...');
    await esbuild.build(buildConfig);
    console.log('✅ Build completed successfully!');
    console.log('📁 Output: content.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Watch function
async function watch() {
  try {
    console.log('Watching for changes in src/...');
    const context = await esbuild.context(buildConfig);
    await context.watch();
    console.log('👀 Watching for changes...');
  } catch (error) {
    console.error('❌ Watch failed:', error);
    process.exit(1);
  }
}

// Run based on command line argument
const command = process.argv[2];
if (command === 'watch') {
  watch();
} else {
  build();
} 