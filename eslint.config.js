const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['**/*.stories.tsx', 'src/theme/**'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
          message: 'Cor hex inline proibida. Use um token de src/theme (ROADMAP §3.1).',
        },
      ],
    },
  }
);
