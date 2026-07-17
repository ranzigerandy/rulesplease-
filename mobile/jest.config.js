module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  transformIgnorePatterns: ["node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-modules-core|expo-router|lucide-react-native|react-native-svg))"],
};
