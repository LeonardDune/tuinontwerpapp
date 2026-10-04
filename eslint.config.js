export default [
  {
    files: ['js/**/*.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
        localStorage: 'readonly', indexedDB: 'readonly', requestAnimationFrame: 'readonly',
        performance: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        Image: 'readonly', Path2D: 'readonly', DOMMatrix: 'readonly', Blob: 'readonly', File: 'readonly',
        FileReader: 'readonly', URL: 'readonly', TextEncoder: 'readonly', ResizeObserver: 'readonly',
        fetch: 'readonly', atob: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', URLSearchParams: 'readonly', confirm: 'readonly', self: 'readonly', caches: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-undef': 'error',
    },
  },
];
