import { isOpenAIAvailable, callOpenAIJSON } from '@/lib/ai/openai-client'

const originalEnv = process.env.OPENAI_API_KEY

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.OPENAI_API_KEY
  } else {
    process.env.OPENAI_API_KEY = originalEnv
  }
})

describe('isOpenAIAvailable', () => {
  test('returns false when OPENAI_API_KEY is not set', () => {
    delete process.env.OPENAI_API_KEY
    expect(isOpenAIAvailable()).toBe(false)
  })

  test('returns false when OPENAI_API_KEY is placeholder', () => {
    process.env.OPENAI_API_KEY = 'sk-your-openai-api-key-here'
    expect(isOpenAIAvailable()).toBe(false)
  })

  test('returns true when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-12345'
    expect(isOpenAIAvailable()).toBe(true)
  })
})

describe('callOpenAIJSON', () => {
  test('returns null when API is not available', async () => {
    delete process.env.OPENAI_API_KEY
    const result = await callOpenAIJSON({
      systemPrompt: 'test system',
      userPrompt: 'test user',
    })
    expect(result).toBeNull()
  })
})
