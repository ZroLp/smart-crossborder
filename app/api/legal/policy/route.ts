import { NextRequest, NextResponse } from 'next/server';

/**
 * P7-05 政策/协议页可下载：GET /api/legal/policy?type=privacy|terms|dpa
 * 返回 text/plain 附件（Content-Disposition: attachment）。非法 type → 400。
 */
const POLICY_TEMPLATES: Record<'privacy' | 'terms' | 'dpa', string> = {
  privacy: [
    '跨境智卖隐私政策（Privacy Policy）',
    '版本：v1.0　生效日期：2026-11-24',
    '',
    '一、我们收集的数据：账号信息（用户名、邮箱）、设备与 IP（登录审计）、',
    '订单与支付记录、产品使用分析（仅在您同意 analytics 收集后）。',
    '二、法律依据：GDPR 第 6/7 条、PIPL 第 13/14 条（含单独同意）、CCPA/CPRA。',
    '三、您的权利：访问、更正、删除、可携（DSAR 自助）、反对与撤回同意。',
    '四、跨境传输：按数据驻留区域采用 SCC / DPF 认证 / PIPL 标准合同（CAC 备案）。',
    '五、保留期：会话 90 天，分析与任务日志 365 天，验证码 30 天。',
    '六、数据安全：哈希存储验证码、传输 TLS、最小授权访问。',
    '七、投诉渠道：可向数据保护机构或我方 DPO 投诉。',
    '八、政策变更：重大变更将另行通知并给予 14 天异议期。',
  ].join('\n'),
  terms: [
    '跨境智卖服务条款（Terms of Service）',
    '版本：v1.0　生效日期：2026-11-24',
    '',
    '一、服务范围：跨境电商智能运营 SaaS（选品、建站、内容、投流、履约、客服）。',
    '二、账号与责任：您保证账号信息真实，并对账号下操作负责。',
    '三、订阅与计费：套餐以支付网关 Webhook 入账为准；退款遵循平台退款政策。',
    '四、可接受使用：禁止滥用、逆向工程、未经授权转售。',
    '五、知识产权：平台归属跨境智卖，内容归属创作者（按授权范围）。',
    '六、免责声明：AI 建议仅供参考，经营决策由您负责。',
    '七、限制责任：在法定范围内按实际支付金额设限。',
    '八、争议解决：协商优先，必要时提交有管辖权法院。',
  ].join('\n'),
  dpa: [
    '数据处理协议（Data Processing Agreement, DPA）',
    '版本：v1.0　生效日期：2026-11-24',
    '',
    '一、定义：控制方 = 客户（商家），处理方 = 跨境智卖。',
    '二、处理范围：仅为履行订单所需之订单、商品与物流数据。',
    '三、义务：处理方按控制方指示处理，采取技术与组织安全措施（TOMs）。',
    '四、子处理方：事先书面同意，并施加同等义务（穿透条款）。',
    '五、跨境传输：SCC（EU 2021/914 附录 1 模块 2）或 DPF / PIPL 标准合同。',
    '六、协助：支持控制方完成 DSAR、监管通知与泄露响应（72 小时时限）。',
    '七、审计权：控制方可按年度行使一次审计，替代为 SOC2/ISO27001 报告。',
    '八、泄露通知：处理方知悉后 24 小时内通知控制方，并配合 72 小时监管通知。',
    '九、合同终止：终止后 30 天内删除或返还全部个人数据。',
  ].join('\n'),
};

const POLICY_TYPES = Object.keys(POLICY_TEMPLATES) as Array<keyof typeof POLICY_TEMPLATES>;

export async function GET(request: NextRequest) {
  const type = new URL(request.url).searchParams.get('type');
  if (typeof type !== 'string' || !(POLICY_TYPES as string[]).includes(type)) {
    return NextResponse.json(
      { success: false, code: 'INVALID_TYPE', error: `type must be one of: ${POLICY_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const template = POLICY_TEMPLATES[type as keyof typeof POLICY_TEMPLATES];
  return new NextResponse(template, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${type}_policy.txt"`,
    },
  });
}
