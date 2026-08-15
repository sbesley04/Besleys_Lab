import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // These React Compiler diagnostics are substantially stricter than the
    // hooks rules this existing interactive/game code was written against.
    // Keep the stable hooks correctness rules from core-web-vitals while the
    // compiler-specific patterns are migrated incrementally.
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".next.nosync/**",
    "node_modules/**",
    "next-env.d.ts",
    "public/**",
    "hungergames/arena-ui/**",
  ]),
]);
