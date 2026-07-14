import type { PhotoAnalysis, JournalPhoto } from '@/stores/journal'
import { MOCK_RESPONSES } from './mockAnalysis'

// ═══════════════ CLAUDE VISION API ═══════════════
// Requires: VITE_CLAUDE_API_KEY env variable

const CLAUDE_API = 'https://api.anthropic.com/v1/messages'

export async function analyzePhotos(photos: JournalPhoto[]): Promise<PhotoAnalysis> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY

  if (!apiKey) {
    console.warn('VITE_CLAUDE_API_KEY not set — using mock analysis')
    return mockAnalyze(photos)
  }

  try {
    // Build image blocks for the first 3 photos (API limit)
    const imageBlocks = photos.slice(0, 3).map(p => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: p.dataUrl.split(',')[1],
      },
    }))

    const response = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            ...imageBlocks,
            {
              type: 'text',
              text: `分析这些照片，返回纯JSON（不要markdown代码块）:
{
  "content": "照片内容描述，1-2句中文",
  "mood": "情绪氛围，用中文短语",
  "style": "推荐的手帐风格，中文",
  "caption": "手帐配文，2-3行短诗风格中文",
  "tags": ["标签1","标签2","标签3"],
  "dateContext": "时间季节感"
}`
            }
          ],
        }],
      }),
    })

    if (!response.ok) {
      console.error('Claude API error:', response.status)
      return mockAnalyze(photos)
    }

    const data = await response.json()
    const text: string = data.content?.[0]?.text || ''

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return mockAnalyze(photos)
  } catch (err) {
    console.error('Claude API call failed:', err)
    return mockAnalyze(photos)
  }
}

// Mock fallback — random from curated set
async function mockAnalyze(_photos: JournalPhoto[]): Promise<PhotoAnalysis> {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))
  return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
}
