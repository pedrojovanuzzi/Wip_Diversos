import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Look for test files in __tests__ folders or files ending with .test.ts
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  // Ignore node_modules and build output
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};

export default config;
