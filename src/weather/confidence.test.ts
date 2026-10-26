import { describe, expect, it } from 'vitest'
import { median, summarizeDay, type ModelValues } from './confidence'

const model = (values: Partial<ModelValues> = {}): ModelValues => ({ high: 15, low: 6, rain: 0, code: 3, ...values })

describe('forecast confidence', () => {
  it('gives High when temperatures and rain agree, including the 2 °C boundary', () => {
    expect(summarizeDay([model(), model({ high: 17 })])?.confidence).toBe('High')
  })

  it('uses the larger high/low spread, with Medium through 4 °C and Low above it', () => {
    expect(summarizeDay([model(), model({ high: 19 })])?.confidence).toBe('Medium')
    const day = summarizeDay([model(), model({ low: 1 })])
    expect(day?.confidence).toBe('Low')
    expect(day?.reason).toBe('Lows range 1–6 °C')
  })

  it('gives Low for an even rain split and Medium for a single outlier, counting 1 mm as wet', () => {
    const wet = model({ rain: 1 })
    expect(summarizeDay([model(), model(), wet, wet])?.confidence).toBe('Low')
    const day = summarizeDay([model(), wet, wet, wet])
    expect(day?.confidence).toBe('Medium')
    expect(day?.reason).toBe('Models disagree about rain (3 of 4 expect rain)')
  })

  it('excludes null models from medians, counts and agreement', () => {
    const day = summarizeDay([model(), model({ high: 17 }), model({ high: 16 }), null])
    expect(day).toMatchObject({ high: 16, count: 3, wet: 0, confidence: 'High' })
  })

  it('shows values without confidence for a single model, and handles no data', () => {
    expect(summarizeDay([null, model()])).toMatchObject({
      high: 15,
      confidence: null,
      reason: 'Only one model reaches this far',
    })
    expect(summarizeDay([null, null])).toBeNull()
  })

  it('averages the middle two of four sorted values for every headline', () => {
    expect(median([20, 12, 13, 16])).toBe(14.5)
    const day = summarizeDay([
      model({ high: 20, low: 10, rain: 10 }),
      model({ high: 12, low: 2, rain: 0 }),
      model({ high: 13, low: 3, rain: 1 }),
      model({ high: 16, low: 6, rain: 4 }),
    ])
    expect(day).toMatchObject({ high: 14.5, low: 4.5, rain: 2.5 })
  })
})
