/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

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

  simulateError(error: string) {
    if (!this.onerror) return;
    this.onerror({ error, message: '' });
  }
}

let mockRecognition: MockSpeechRecognition;

function setupSpeechApi() {
  mockRecognition = new MockSpeechRecognition();
  (window as any).webkitSpeechRecognition = jest.fn(() => mockRecognition);
}

function removeSpeechApi() {
  delete (window as any).webkitSpeechRecognition;
  delete (window as any).SpeechRecognition;
}

beforeEach(() => {
  setupSpeechApi();
});

afterEach(() => {
  removeSpeechApi();
});

jest.mock('@/lib/speech/web-speech', () => {
  let instance: any = null;
  return {
    getSpeechService: () => {
      if (!instance) {
        const { SpeechService } = jest.requireActual('@/lib/speech/web-speech');
        instance = new SpeechService();
      }
      return instance;
    },
    __resetInstance: () => {
      instance = null;
    },
  };
});

import VoiceInputButton from '@/components/VoiceInputButton';

beforeEach(() => {
  const { __resetInstance } = require('@/lib/speech/web-speech');
  __resetInstance();
});

describe('VoiceInputButton', () => {
  test('renders microphone button when supported', () => {
    render(<VoiceInputButton onResult={jest.fn()} />);
    expect(screen.getByRole('button', { name: /开始语音输入/i })).toBeInTheDocument();
  });

  test('returns null when speech recognition is not supported', () => {
    removeSpeechApi();
    const { container } = render(<VoiceInputButton onResult={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  test('calls onResult with transcribed text after final result', () => {
    const onResult = jest.fn();
    render(<VoiceInputButton onResult={onResult} />);

    const button = screen.getByRole('button', { name: /开始语音输入/i });
    fireEvent.click(button);

    act(() => {
      mockRecognition.simulateResult([
        { transcript: '帮我选品', isFinal: true },
      ]);
    });

    expect(onResult).toHaveBeenCalledWith('帮我选品');
  });

  test('toggles listening state on click', () => {
    render(<VoiceInputButton onResult={jest.fn()} />);

    const button = screen.getByRole('button', { name: /开始语音输入/i });
    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-label', '停止录音');

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-label', '开始语音输入');
  });

  test('shows interim text while listening', () => {
    render(<VoiceInputButton onResult={jest.fn()} />);

    const button = screen.getByRole('button', { name: /开始语音输入/i });
    fireEvent.click(button);

    act(() => {
      mockRecognition.simulateResult([
        { transcript: '帮我', isFinal: false },
      ]);
    });

    expect(screen.getByText('帮我')).toBeInTheDocument();
  });

  test('does not render when disabled', () => {
    render(<VoiceInputButton onResult={jest.fn()} disabled={true} />);

    const button = screen.getByRole('button', { name: /开始语音输入/i });
    expect(button).toBeDisabled();
  });

  test('passes language parameter to speech service', () => {
    render(<VoiceInputButton onResult={jest.fn()} language="en-US" />);

    const button = screen.getByRole('button', { name: /开始语音输入/i });
    fireEvent.click(button);

    expect(mockRecognition.lang).toBe('en-US');
  });

  test('defaults to zh-CN language', () => {
    render(<VoiceInputButton onResult={jest.fn()} />);

    const button = screen.getByRole('button', { name: /开始语音输入/i });
    fireEvent.click(button);

    expect(mockRecognition.lang).toBe('zh-CN');
  });

  test('does not start recognition when disabled', () => {
    render(<VoiceInputButton onResult={jest.fn()} disabled={true} />);

    const button = screen.getByRole('button', { name: /开始语音输入/i });
    fireEvent.click(button);

    expect(mockRecognition.start).not.toHaveBeenCalled();
  });
});
