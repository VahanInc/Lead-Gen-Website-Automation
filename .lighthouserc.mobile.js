const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

module.exports = {
  ci: {
    collect: {
      url: [
        `${BASE_URL}/jobs/`,
        `${BASE_URL}/rider-adda/`,
        `${BASE_URL}/blog/`,
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu --disable-dev-shm-usage',
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          disabled: false,
        },
      },
    },
    assert: {
      assertions: {
        'categories:performance':      ['error', { minScore: 0.5 }],
        'categories:accessibility':    ['error', { minScore: 0.9 }],
        'categories:best-practices':   ['warn',  { minScore: 0.8 }],
        'categories:seo':              ['error', { minScore: 1   }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '/app/lighthouse-report-mobile',
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
};
