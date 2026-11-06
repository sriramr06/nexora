import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "docs/**"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Server and shared code run on Node.js
  {
    files: ["server/**/*.ts", "packages/**/*.ts", "*.js"],
    languageOptions: { globals: globals.node },
  },

  // Client code runs in the browser
  {
    files: ["client/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },

  // Disable rules that conflict with Prettier formatting (must be last)
  prettier,
);
