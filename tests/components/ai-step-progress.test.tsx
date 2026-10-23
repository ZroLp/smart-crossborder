/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AIStepProgress, { StepInfo } from '@/components/AIStepProgress';

const defaultSteps: StepInfo[] = [
  { step: 'data-collection', label: '数据采集', status: 'pending' },
  { step: 'model-reasoning', label: '模型推理', status: 'pending' },
  { step: 'strategy-generation', label: '策略生成', status: 'pending' },
  { step: 'execution', label: '执行落地', status: 'pending' },
  { step: 'result-callback', label: '结果回传', status: 'pending' },
];

describe('AIStepProgress', () => {
  test('renders all 5 steps with correct labels', () => {
    render(<AIStepProgress taskId="test-task" steps={defaultSteps} />);

    expect(screen.getByTestId('step-label-0')).toHaveTextContent('数据采集');
    expect(screen.getByTestId('step-label-1')).toHaveTextContent('模型推理');
    expect(screen.getByTestId('step-label-2')).toHaveTextContent('策略生成');
    expect(screen.getByTestId('step-label-3')).toHaveTextContent('执行落地');
    expect(screen.getByTestId('step-label-4')).toHaveTextContent('结果回传');
  });

  test('shows correct status icons for each state', () => {
    const mixedSteps: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'completed' },
      { step: 'model-reasoning', label: '模型推理', status: 'running' },
      { step: 'strategy-generation', label: '策略生成', status: 'failed' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={mixedSteps} />);

    expect(screen.getByTestId('step-icon-0')).toHaveTextContent('✅');
    expect(screen.getByTestId('step-icon-1')).toHaveTextContent('🔄');
    expect(screen.getByTestId('step-icon-2')).toHaveTextContent('❌');
    expect(screen.getByTestId('step-icon-3')).toHaveTextContent('⏳');
    expect(screen.getByTestId('step-icon-4')).toHaveTextContent('⏳');
  });

  test('expands step details on click for completed step', () => {
    const stepsWithDetails: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'completed', input: '市场数据', output: '分析结果' },
      { step: 'model-reasoning', label: '模型推理', status: 'pending' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={stepsWithDetails} />);

    expect(screen.queryByTestId('step-detail-0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('step-dot-0'));

    expect(screen.getByTestId('step-detail-0')).toBeInTheDocument();
    expect(screen.getByTestId('step-detail-0')).toHaveTextContent('市场数据');
    expect(screen.getByTestId('step-detail-0')).toHaveTextContent('分析结果');
  });

  test('expands step details on click for failed step', () => {
    const stepsWithFailure: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'completed' },
      { step: 'model-reasoning', label: '模型推理', status: 'failed', output: '超时错误' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={stepsWithFailure} />);

    fireEvent.click(screen.getByTestId('step-dot-1'));

    expect(screen.getByTestId('step-detail-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-detail-1')).toHaveTextContent('超时错误');
  });

  test('collapses step details on second click', () => {
    const stepsWithDetails: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'completed', input: 'test input' },
      { step: 'model-reasoning', label: '模型推理', status: 'pending' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={stepsWithDetails} />);

    fireEvent.click(screen.getByTestId('step-dot-0'));
    expect(screen.getByTestId('step-detail-0')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('step-dot-0'));
    expect(screen.queryByTestId('step-detail-0')).not.toBeInTheDocument();
  });

  test('control buttons are rendered', () => {
    render(<AIStepProgress taskId="test-task" steps={defaultSteps} />);

    expect(screen.getByTestId('btn-pause')).toBeInTheDocument();
    expect(screen.getByTestId('btn-terminate')).toBeInTheDocument();
    expect(screen.getByTestId('btn-retry')).toBeInTheDocument();
  });

  test('pause button is disabled when no step is running', () => {
    render(<AIStepProgress taskId="test-task" steps={defaultSteps} />);

    expect(screen.getByTestId('btn-pause')).toBeDisabled();
  });

  test('pause button is enabled when a step is running', () => {
    const runningSteps: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'completed' },
      { step: 'model-reasoning', label: '模型推理', status: 'running' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={runningSteps} />);

    expect(screen.getByTestId('btn-pause')).not.toBeDisabled();
  });

  test('retry button is enabled when a step has failed', () => {
    const failedSteps: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'completed' },
      { step: 'model-reasoning', label: '模型推理', status: 'failed' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={failedSteps} />);

    expect(screen.getByTestId('btn-retry')).not.toBeDisabled();
  });

  test('calls onPause when pause button is clicked', () => {
    const onPause = jest.fn();
    const runningSteps: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'running' },
      { step: 'model-reasoning', label: '模型推理', status: 'pending' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={runningSteps} onPause={onPause} />);

    fireEvent.click(screen.getByTestId('btn-pause'));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  test('calls onTerminate when terminate button is clicked', () => {
    const onTerminate = jest.fn();
    const runningSteps: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'running' },
      { step: 'model-reasoning', label: '模型推理', status: 'pending' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={runningSteps} onTerminate={onTerminate} />);

    fireEvent.click(screen.getByTestId('btn-terminate'));
    expect(onTerminate).toHaveBeenCalledTimes(1);
  });

  test('calls onRetry when retry button is clicked', () => {
    const onRetry = jest.fn();
    const failedSteps: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'failed' },
      { step: 'model-reasoning', label: '模型推理', status: 'pending' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={failedSteps} onRetry={onRetry} />);

    fireEvent.click(screen.getByTestId('btn-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('displays duration when provided', () => {
    const stepsWithDuration: StepInfo[] = [
      { step: 'data-collection', label: '数据采集', status: 'completed', duration: 1500 },
      { step: 'model-reasoning', label: '模型推理', status: 'pending' },
      { step: 'strategy-generation', label: '策略生成', status: 'pending' },
      { step: 'execution', label: '执行落地', status: 'pending' },
      { step: 'result-callback', label: '结果回传', status: 'pending' },
    ];

    render(<AIStepProgress taskId="test-task" steps={stepsWithDuration} />);

    expect(screen.getByTestId('step-duration-0')).toHaveTextContent('1.5s');
  });

  test('displays taskId in header', () => {
    render(<AIStepProgress taskId="task-abc-123" steps={defaultSteps} />);

    expect(screen.getByText('任务ID: task-abc-123')).toBeInTheDocument();
  });
});
