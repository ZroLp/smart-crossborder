import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/init';
import { AgentProgressTracker, AgentStep } from '@/lib/framework/agent-progress';

const STEP_LABELS: Record<AgentStep, string> = {
  [AgentStep.DataCollection]: '数据采集',
  [AgentStep.ModelReasoning]: '模型推理',
  [AgentStep.StrategyGeneration]: '策略生成',
  [AgentStep.Execution]: '执行落地',
  [AgentStep.ResultCallback]: '结果回传',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const agentType = searchParams.get('agentType');

    if (!taskId || !agentType) {
      return NextResponse.json(
        { success: false, error: 'Missing taskId or agentType' },
        { status: 400 }
      );
    }

    const db = getDb();
    const tracker = new AgentProgressTracker(db);
    const record = tracker.getProgress(agentType, taskId);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Progress not found' },
        { status: 404 }
      );
    }

    const steps = record.steps.map((s) => ({
      step: s.step,
      label: STEP_LABELS[s.step as AgentStep] || s.step,
      status: s.status,
      duration: s.duration,
      input: s.input ? JSON.stringify(s.input) : undefined,
      output: s.output ? JSON.stringify(s.output) : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: {
        taskId: record.taskId,
        agentType: record.agentType,
        steps,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
