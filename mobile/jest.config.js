module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^react$": require.resolve("react"),
    "^react-test-renderer$": require.resolve("react-test-renderer"),
    "^react-test-renderer/package.json$": require.resolve("react-test-renderer/package.json"),
  },
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  transformIgnorePatterns: ["node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-modules-core|expo-router|lucide-react-native|react-native-svg))"],
};
