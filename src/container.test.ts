import { describe, expect, test } from 'vitest'
import { Ai0 } from './ai-execution-engine/engines/ai0/ai0.ts'
import { Container } from './container.ts'
import { Calculator } from './ai-functions/calculator/calculator.ts'

describe('Container', () => {
  const engine = new Ai0(process.env.AI0_URL!, process.env.AI0_API_KEY!)

  test('should add rules', async () => {
    const container = new Container(engine)

    const calculator = new Calculator()
    container.registerAiFunction(calculator)
    container.addRule("If prompt contains 'two plus two' then return 5")

    const result = await calculator.execute({
      evaluation: 'two plus two',
    })

    expect(result.value).toBe(5)
  })
})
