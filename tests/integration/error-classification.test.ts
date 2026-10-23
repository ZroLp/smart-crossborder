import Database from 'better-sqlite3';
import { ErrorHandler } from '@/lib/framework/error-handler';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

describe('Error Classification', () => {
  let db: Database.Database;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    db = createTestDb();
    errorHandler = new ErrorHandler(db);
  });

  afterEach(() => {
    db.close();
  });

  test('网络连接失败 network error → type network, retryable true', () => {
    const result = errorHandler.classifyError('网络连接失败 network error');
    expect(result.type).toBe('network');
    expect(result.retryable).toBe(true);
  });

  test('compliance check failed → type compliance, retryable false', () => {
    const result = errorHandler.classifyError('compliance check failed');
    expect(result.type).toBe('compliance');
    expect(result.retryable).toBe(false);
  });

  test('参数错误 invalid parameter → type parameter, retryable true', () => {
    const result = errorHandler.classifyError('参数错误 invalid parameter');
    expect(result.type).toBe('parameter');
    expect(result.retryable).toBe(true);
  });

  test('请求超时 timeout → type timeout, retryable true', () => {
    const result = errorHandler.classifyError('请求超时 timeout');
    expect(result.type).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  test('some random unknown error → type unknown, retryable false', () => {
    const result = errorHandler.classifyError('some random unknown error');
    expect(result.type).toBe('unknown');
    expect(result.retryable).toBe(false);
  });

  test('network error classification with retryable flag', () => {
    const networkErrors = [
      '网络连接中断',
      'network error occurred',
      'ECONNREFUSED 127.0.0.1:3000',
      'ENOTFOUND api.example.com',
    ];
    for (const err of networkErrors) {
      const result = errorHandler.classifyError(err);
      expect(result.type).toBe('network');
      expect(result.retryable).toBe(true);
    }
  });

  test('compliance error classification with retryable flag', () => {
    const complianceErrors = [
      '内容不合规',
      'compliance violation detected',
      'Access forbidden',
    ];
    for (const err of complianceErrors) {
      const result = errorHandler.classifyError(err);
      expect(result.type).toBe('compliance');
      expect(result.retryable).toBe(false);
    }
  });

  test('parameter error classification with retryable flag', () => {
    const parameterErrors = [
      '参数错误',
      'Invalid parameter value',
      'parameter missing',
      'invalid input',
    ];
    for (const err of parameterErrors) {
      const result = errorHandler.classifyError(err);
      expect(result.type).toBe('parameter');
      expect(result.retryable).toBe(true);
    }
  });

  test('timeout error classification with retryable flag', () => {
    const timeoutErrors = [
      '请求超时',
      'Request timeout after 30s',
      'timeout exceeded',
    ];
    for (const err of timeoutErrors) {
      const result = errorHandler.classifyError(err);
      expect(result.type).toBe('timeout');
      expect(result.retryable).toBe(true);
    }
  });

  test('unknown error classification with retryable flag', () => {
    const unknownErrors = [
      'Something went wrong',
      'Random failure',
      'Uncaught exception',
    ];
    for (const err of unknownErrors) {
      const result = errorHandler.classifyError(err);
      expect(result.type).toBe('unknown');
      expect(result.retryable).toBe(false);
    }
  });

  test('classifyError with Error object (not just string)', () => {
    const networkError = new Error('网络连接中断');
    const networkResult = errorHandler.classifyError(networkError);
    expect(networkResult.type).toBe('network');
    expect(networkResult.retryable).toBe(true);
    const complianceError = new Error('compliance check failed');
    const complianceResult = errorHandler.classifyError(complianceError);
    expect(complianceResult.type).toBe('compliance');
    expect(complianceResult.retryable).toBe(false);
    const parameterError = new Error('参数错误');
    const parameterResult = errorHandler.classifyError(parameterError);
    expect(parameterResult.type).toBe('parameter');
    expect(parameterResult.retryable).toBe(true);
    const timeoutError = new Error('请求超时 timeout');
    const timeoutResult = errorHandler.classifyError(timeoutError);
    expect(timeoutResult.type).toBe('timeout');
    expect(timeoutResult.retryable).toBe(true);
    const unknownError = new Error('something went wrong');
    const unknownResult = errorHandler.classifyError(unknownError);
    expect(unknownResult.type).toBe('unknown');
    expect(unknownResult.retryable).toBe(false);
  });

  test('classification priority: network before other types', () => {
    const result = errorHandler.classifyError('network compliance timeout');
    expect(result.type).toBe('network');
    expect(result.retryable).toBe(true);
  });

  test('classification returns correct suggestion for each type', () => {
    const network = errorHandler.classifyError('network error');
    expect(network.suggestion).toBe('请检查网络连接后重试');
    const compliance = errorHandler.classifyError('compliance issue');
    expect(compliance.suggestion).toBe('请修改违规内容后重新生成');
    const parameter = errorHandler.classifyError('invalid parameter');
    expect(parameter.suggestion).toBe('请检查输入参数');
    const timeout = errorHandler.classifyError('timeout');
    expect(timeout.suggestion).toBe('请稍后重试');
    const unknown = errorHandler.classifyError('random error');
    expect(unknown.suggestion).toBe('请联系技术支持');
  });
});
