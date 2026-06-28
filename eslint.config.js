const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    ignores: ['**/*.stories.tsx', 'src/theme/**'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      // rules-of-hooks pega bug real (hook condicional); exhaustive-deps fica em warn
      // para os `eslint-disable-next-line` existentes resolverem sem quebrar o lint.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
