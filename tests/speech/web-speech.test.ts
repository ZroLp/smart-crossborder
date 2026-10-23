import { SpeechService, SpeechEventCallback } from '@/lib/speech/web-speech';

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  start = jest.fn(() => {
    if (this.onstart) this.onstart();
  });

  stop = jest.fn(() => {
    if (this.onend) this.onend();
  });

  abort = jest.fn();

  simulateResult(results: Array<{ transcript: string; isFinal: boolean }>) {
    if (!this.onresult) return;
    const speechResults = results.map((r) => {
      const alternative = { transcript: r.transcript, confidence: 0.9 };
      const result = [alternative];
      (result as any).isFinal = r.isFinal;
      (result as any).length = 1;
      (result as any).item = (i: number) => result[i];
      return result;
    });
    const resultList: any = {
      length: speechResults.length,
      item: (i: number) => speechResults[i],
    };
    speechResults.forEach((r, i) => { resultList[i] = r; });
    this.onresult({
      resultIndex: 0,
      results: resultList,
    });
  }

  simulateError(error: string, message: string) {
    if (!this.onerror) return;
    this.onerror({ error, message });
  }
}

let mockRecognition: MockSpeechRecognition;

beforeEach(() => {
  mockRecognition = new MockSpeechRecognition();
  (global as any).window = {
    webkitSpeechRecognition: jest.fn(() => mockRecognition),
  };
});

afterEach(() => {
  delete (global as any).window;
});

describe('SpeechService', () => {
  let service: SpeechService;

  beforeEach(() => {
    service = new SpeechService();
  });

  describe('isSupported', () => {
    test('returns true when webkitSpeechRecognition is available', () => {
      expect(service.isSupported()).toBe(true);
    });

    test('returns true when SpeechRecognition is available', () => {
      (global as any).window = {
        SpeechRecognition: jest.fn(() => mockRecognition),
      };
      const svc = new SpeechService();
      expect(svc.isSupported()).toBe(true);
    });

    test('returns false when no SpeechRecognition is available', () => {
      (global as any).window = {};
      const svc = new SpeechService();
      expect(svc.isSupported()).toBe(false);
    });

    test('returns false in server environment (no window)', () => {
      delete (global as any).window;
      const svc = new SpeechService();
      expect(svc.isSupported()).toBe(false);
    });
  });

  describe('startRecognition', () => {
    test('starts recognition with default language zh-CN', () => {
      service.startRecognition();
      expect(mockRecognition.start).toHaveBeenCalled();
      expect(mockRecognition.lang).toBe('zh-CN');
      expect(mockRecognition.continuous).toBe(true);
      expect(mockRecognition.interimResults).toBe(true);
    });

    test('sets correct language parameter', () => {
      service.startRecognition('en-US');
      expect(mockRecognition.lang).toBe('en-US');
    });

    test('accepts all supported languages', () => {
      const languages = ['zh-CN', 'en-US', 'es', 'fr', 'de'] as const;
      for (const lang of languages) {
        const svc = new SpeechService();
        svc.startRecognition(lang);
        expect(mockRecognition.lang).toBe(lang);
        svc.stopRecognition();
      }
    });

    test('falls back to zh-CN for unsupported language', () => {
      service.startRecognition('ja' as any);
      expect(mockRecognition.lang).toBe('zh-CN');
    });

    test('emits start event when recognition begins', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();
      expect(callback).toHaveBeenCalledWith({ type: 'start' });
    });

    test('emits error when not supported', () => {
      (global as any).window = {};
      const svc = new SpeechService();
      const callback = jest.fn();
      svc.subscribe(callback);
      svc.startRecognition();
      expect(callback).toHaveBeenCalledWith({ type: 'error', error: 'not-supported' });
    });

    test('returns subscription object with unsubscribe method', () => {
      const subscription = service.startRecognition();
      expect(typeof subscription.unsubscribe).toBe('function');
      subscription.unsubscribe();
    });
  });

  describe('recognition results', () => {
    test('emits interim result during recognition', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();

      mockRecognition.simulateResult([
        { transcript: '你', isFinal: false },
      ]);

      expect(callback).toHaveBeenCalledWith({
        type: 'interim',
        interimTranscript: '你',
        transcript: undefined,
      });
    });

    test('emits final result when recognition is complete', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();

      mockRecognition.simulateResult([
        { transcript: '帮我选品', isFinal: true },
      ]);

      expect(callback).toHaveBeenCalledWith({
        type: 'final',
        transcript: '帮我选品',
      });
    });

    test('emits both interim and final in mixed results', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();

      mockRecognition.simulateResult([
        { transcript: '帮我', isFinal: true },
        { transcript: '选品', isFinal: false },
      ]);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'final', transcript: '帮我' })
      );
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'interim', interimTranscript: '选品' })
      );
    });
  });

  describe('error handling', () => {
    test('handles not-allowed error', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();

      mockRecognition.simulateError('not-allowed', '');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('麦克风权限'),
        })
      );
    });

    test('handles network error', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();

      mockRecognition.simulateError('network', '');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('网络'),
        })
      );
    });

    test('handles no-speech error', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();

      mockRecognition.simulateError('no-speech', '');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('未检测到语音'),
        })
      );
    });

    test('handles audio-capture error', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();

      mockRecognition.simulateError('audio-capture', '');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('麦克风设备'),
        })
      );
    });

    test('handles unknown error type', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();

      mockRecognition.simulateError('unknown-error', '');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: expect.stringContaining('语音识别错误'),
        })
      );
    });
  });

  describe('stopRecognition', () => {
    test('stops recognition and sets listening to false', () => {
      service.startRecognition();
      expect(service.isListening()).toBe(true);

      service.stopRecognition();
      expect(mockRecognition.stop).toHaveBeenCalled();
    });

    test('does nothing when not listening', () => {
      service.stopRecognition();
      expect(mockRecognition.stop).not.toHaveBeenCalled();
    });

    test('emits end event when recognition stops', () => {
      const callback = jest.fn();
      service.subscribe(callback);
      service.startRecognition();
      callback.mockClear();

      service.stopRecognition();

      expect(callback).toHaveBeenCalledWith({ type: 'end' });
    });
  });

  describe('isListening', () => {
    test('returns false initially', () => {
      expect(service.isListening()).toBe(false);
    });

    test('returns true after start', () => {
      service.startRecognition();
      expect(service.isListening()).toBe(true);
    });

    test('returns false after stop', () => {
      service.startRecognition();
      service.stopRecognition();
      expect(service.isListening()).toBe(false);
    });

    test('returns false after end event', () => {
      service.startRecognition();
      expect(service.isListening()).toBe(true);

      mockRecognition.onend?.();
      expect(service.isListening()).toBe(false);
    });
  });

  describe('subscribe', () => {
    test('registers multiple callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      service.subscribe(callback1);
      service.subscribe(callback2);
      service.startRecognition();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    test('unsubscribe removes callback', () => {
      const callback = jest.fn();
      const sub = service.subscribe(callback);
      service.startRecognition();
      callback.mockClear();

      sub.unsubscribe();
      mockRecognition.simulateResult([{ transcript: 'test', isFinal: true }]);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getSpeechService singleton', () => {
    test('returns the same instance on multiple calls', () => {
      const { getSpeechService } = require('@/lib/speech/web-speech');
      const s1 = getSpeechService();
      const s2 = getSpeechService();
      expect(s1).toBe(s2);
    });
  });
});
