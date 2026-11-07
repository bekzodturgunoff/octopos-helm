/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  printWidth: 200,
  singleQuote: false,
  tabWidth: 2,
  semi: true,
  bracketSpacing: false,
  plugins: ["prettier-plugin-tailwindcss"]
}

export default config;
