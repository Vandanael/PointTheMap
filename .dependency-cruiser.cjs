/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      comment:
        'This dependency is part of a circular relationship. Consider breaking the cycle.',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'no-orphans',
      comment:
        'This is an orphan module - it is likely not used. Either use it or remove it.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$',
          '[.]d[.]ts$',
          '(^|/)tsconfig[.]json$',
          '(^|/)(?:babel|webpack)[.]config[.](?:js|cjs|mjs|ts|cts|mts|json)$'
        ]
      },
      to: {}
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      comment:
        'Production code should not depend on dev-only packages. Test and type-entry files are excluded.',
      from: {
        pathNot: [
          '^src/.*[.]test[.]js$',
          '^src/test/.*',
          '^src/vite-env[.]d[.]ts$',
          '^src/main[.]js$'
        ]
      },
      to: {
        dependencyTypes: ['dev']
      }
    }
  ],
  options: {
    doNotFollow: {
      path: ['node_modules']
    }
  }
};
