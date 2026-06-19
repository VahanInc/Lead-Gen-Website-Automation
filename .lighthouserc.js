const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

module.exports = {
  ci: {
    collect: {
      url: [
        `${BASE_URL}/jobs/`,
        `${BASE_URL}/rider-adda/`,
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu --disable-dev-shm-usage',
      },
    },
    assert: {
      assertions: {
        'categories:performance':      ['warn',  { minScore: 0.7 }],
        'categories:accessibility':    ['error', { minScore: 0.9 }],
        'categories:best-practices':   ['warn',  { minScore: 0.8 }],
        'categories:seo':              ['warn',  { minScore: 0.8 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '/app/lighthouse-report',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
