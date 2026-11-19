/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.pglite-setup.cjs'],
  // PGlite（内嵌 Postgres WASM）每个测试文件初始化成本较高，放宽超时。
  testTimeout: 30000,
  // 限制并发 worker（本机 16 核，默认会并行 ~15 个测试文件）。每个 node 测试
  // 文件都会拉起一个 PGlite WASM 引擎，jsdom 组件测试则做 React 渲染；高并发
  // 下 pglite 初始化与 RTL waitFor 都会间歇性失败（"pool after end"、渲染超时、
  // "import after torn down" 等）。收敛到 2 个并发以稳定全量回归。只降低并行度，
  // 不改变任何测试逻辑。
  maxWorkers: 2,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2017',
        module: 'commonjs',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        rootDir: '.',
        jsx: 'react-jsx',
      },
    }],
  },
};
