export type SpeechLanguage = 'zh-CN' | 'en-US' | 'es' | 'fr' | 'de';

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export type SpeechEventType = 'interim' | 'final' | 'error' | 'end' | 'start';

export type SpeechEventCallback = (event: {
  type: SpeechEventType;
  transcript?: string;
  interimTranscript?: string;
  error?: string;
}) => void;

export interface SpeechSubscription {
  unsubscribe(): void;
}

const SUPPORTED_LANGUAGES: SpeechLanguage[] = ['zh-CN', 'en-US', 'es', 'fr', 'de'];

export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private listening = false;
  private callbacks: Set<SpeechEventCallback> = new Set();

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  startRecognition(language: SpeechLanguage = 'zh-CN'): SpeechSubscription {
    if (!this.isSupported()) {
      this.emit({
        type: 'error',
        error: 'not-supported',
      });
      return { unsubscribe: () => {} };
    }

    if (this.listening) {
      this.stopRecognition();
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      this.emit({ type: 'error', error: 'not-supported' });
      return { unsubscribe: () => {} };
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = SUPPORTED_LANGUAGES.includes(language) ? language : 'zh-CN';

    this.recognition.onstart = () => {
      this.listening = true;
      this.emit({ type: 'start' });
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        this.emit({ type: 'interim', transcript: finalTranscript || undefined, interimTranscript });
      }

      if (finalTranscript) {
        this.emit({ type: 'final', transcript: finalTranscript });
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMap: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问',
        network: '网络连接错误，请检查网络后重试',
        'no-speech': '未检测到语音，请重试',
        'audio-capture': '无法访问麦克风设备',
        'service-not-allowed': '语音服务不可用',
      };

      const message = errorMap[event.error] || `语音识别错误: ${event.error}`;
      this.emit({ type: 'error', error: message });

      if (event.error !== 'no-speech') {
        this.listening = false;
      }
    };

    this.recognition.onend = () => {
      this.listening = false;
      this.emit({ type: 'end' });
    };

    try {
      this.recognition.start();
    } catch {
      this.emit({ type: 'error', error: '启动语音识别失败' });
    }

    const subscription: SpeechSubscription = {
      unsubscribe: () => {
        this.callbacks.clear();
      },
    };

    return subscription;
  }

  stopRecognition(): void {
    if (this.recognition && this.listening) {
      this.recognition.stop();
      this.listening = false;
    }
  }

  isListening(): boolean {
    return this.listening;
  }

  subscribe(callback: SpeechEventCallback): SpeechSubscription {
    this.callbacks.add(callback);
    return {
      unsubscribe: () => {
        this.callbacks.delete(callback);
      },
    };
  }

  private emit(event: {
    type: SpeechEventType;
    transcript?: string;
    interimTranscript?: string;
    error?: string;
  }): void {
    this.callbacks.forEach((callback) => callback(event));
  }
}

let instance: SpeechService | null = null;

export function getSpeechService(): SpeechService {
  if (!instance) {
    instance = new SpeechService();
  }
  return instance;
}
