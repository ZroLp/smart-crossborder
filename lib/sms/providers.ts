import { createHmac, createHash } from 'crypto';

/**
 * P6-02: dual SMS provider abstraction (Tencent Cloud + Aliyun) with a
 * mock fallback so the flow stays testable without credentials.
 */
export interface SmsSendResult {
  provider: string;
  ok: boolean;
  error?: string;
}

export interface SmsProvider {
  name: string;
  send(to: string, code: string): Promise<SmsSendResult>;
}

/* ------------------------------ Tencent Cloud ------------------------------ */

/** TC3 (HMAC-SHA256) signature for the SMS `SmsSend` action. */
class TencentSmsProvider implements SmsProvider {
  name = 'tencent';

  private readonly secretId: string;
  private readonly secretKey: string;
  private readonly smsSdkAppId: string;
  private readonly signName: string;
  private readonly templateId: string;

  constructor() {
    this.secretId = process.env.SMS_TENCENT_SECRET_ID ?? '';
    this.secretKey = process.env.SMS_TENCENT_SECRET_KEY ?? '';
    this.smsSdkAppId = process.env.SMS_TENCENT_SDK_APP_ID ?? '';
    this.signName = process.env.SMS_TENCENT_SIGN_NAME ?? '跨境智卖';
    this.templateId = process.env.SMS_TENCENT_TEMPLATE_ID ?? '';
  }

  async send(to: string, code: string): Promise<SmsSendResult> {
    if (!this.secretId || !this.secretKey || !this.smsSdkAppId || !this.templateId) {
      return mockDeliver(to, code);
    }

    const service = 'sms';
    const host = 'sms.tencentcloudapi.com';
    const version = '2021-01-21';
    const payload = JSON.stringify({
      PhoneNumberParams: [
        { PhoneNumber: to, SmsSdkAppId: this.smsSdkAppId, SignName: this.signName, TemplateId: this.templateId },
      ],
      TemplateParamList: [String(code)],
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    const canonicalRequest = [
      'POST',
      '/',
      '',
      `content-type:application/json`,
      `host:${host}`,
      'x-tc-action:SmsSend',
      '',
      `content-type;host;x-tc-action`,
      createHash('sha256').update(payload).digest('hex'),
    ].join('\n');
    const credentialScope = `${date}/${service}/tc3Request`;
    const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

    const kDate = createHmac('sha256', `TC3${this.secretKey}`).update(date).digest();
    const kService = createHmac('sha256', kDate).update(service).digest();
    const kSigning = createHmac('sha256', kService).update('tc3Request').digest();
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorization =
      `TC3-HMAC-SHA256 Credential=${this.secretId}/${credentialScope}, ` +
      `SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;

    const response = await fetch(`https://${host}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': host,
        'X-TC-Action': 'SmsSend',
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Version': version,
        'X-TC-Region': 'ap-guangzhou',
        Authorization: authorization,
      },
      body: payload,
    });

    const body = (await response.json()) as { Response?: { Result?: { SendStatus?: string }; Error?: { Message?: string } } };
    const ok = response.ok && body.Response?.Result?.SendStatus === 'Ok';
    return {
      provider: this.name,
      ok,
      error: ok ? undefined : (body.Response?.Error?.Message ?? `HTTP ${response.status}`),
    };
  }
}

/* ---------------------------------- Aliyun --------------------------------- */

/** Aliyun RPC-style signature (HMAC-SHA1) for the `SendSms` action. */
class AliyunSmsProvider implements SmsProvider {
  name = 'aliyun';

  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;
  private readonly signName: string;
  private readonly templateCode: string;

  constructor() {
    this.accessKeyId = process.env.SMS_ALIYUN_ACCESS_KEY_ID ?? '';
    this.accessKeySecret = process.env.SMS_ALIYUN_ACCESS_KEY_SECRET ?? '';
    this.signName = process.env.SMS_ALIYUN_SIGN_NAME ?? '跨境智卖';
    this.templateCode = process.env.SMS_ALIYUN_TEMPLATE_CODE ?? '';
  }

  async send(to: string, code: string): Promise<SmsSendResult> {
    if (!this.accessKeyId || !this.accessKeySecret || !this.templateCode) {
      return mockDeliver(to, code);
    }

    const params: Record<string, string> = {
      AccessKeyId: this.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: to,
      RegionId: 'cn-hangzhou',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: crypto.randomUUID(),
      SignatureVersion: '1.0',
      TemplateCode: this.templateCode,
      TemplateParam: JSON.stringify({ code, signName: this.signName }),
      Timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
      Version: '2017-05-25',
    };

    const encode = (s: string) =>
      encodeURIComponent(s).replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/~/g, '%7E');
    const canonicalQuery = Object.keys(params)
      .sort()
      .map((k) => `${encode(k)}=${encode(params[k])}`)
      .join('&');
    const stringToSign = `GET&${encode('/')}&${encode(canonicalQuery)}`;
    const signature = createHmac('sha1', `${this.accessKeySecret}&`).update(stringToSign).digest('base64');
    params.Signature = signature;

    const body = new URLSearchParams(params);
    const response = await fetch('https://dysmsapi.aliyuncs.com/', { method: 'POST', body });
    const data = (await response.json()) as { Code?: string; Message?: string };
    const ok = response.ok && data.Code === 'OK';
    return { provider: this.name, ok, error: ok ? undefined : (data.Message ?? `HTTP ${response.status}`) };
  }
}

/* ------------------------------ mock fallback ----------------------------- */

function mockDeliver(to: string, code: string): SmsSendResult {
  console.info(`[sms] no provider credentials configured; code for ${to} logged only`);
  return { provider: 'mock', ok: true };
}


const MOCK: SmsProvider = {
  name: 'mock',
  async send(to, code) {
    return mockDeliver(to, code);
  },
};

/** Select the provider via `SMS_PROVIDER` (default `tencent`); missing credentials degrade to mock. */
export function getSmsProvider(): SmsProvider {
  const choice = (process.env.SMS_PROVIDER || 'tencent').toLowerCase();
  if (choice === 'aliyun') {
    return new AliyunSmsProvider();
  }
  return new TencentSmsProvider();
}

export { MOCK as MockSmsProvider };
