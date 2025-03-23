import { describe, expect, test } from 'vitest'
import { Prompt } from './prompt.ts'

describe('Prompt', () => {
  test('renders basic template with params', () => {
    const prompt = new Prompt('Hello, {name}! Age: {age}')
    const rendered = prompt.render({ name: 'John', age: 25 })
    expect(rendered).toBe('Hello, John! Age: 25')
    expect(prompt.isFullyRendered(rendered)).toBe(true)
  })

  test('renders nested object paths', () => {
    const prompt = new Prompt('{user.name} is {user.age}')
    const rendered = prompt.render({ user: { name: 'Alice', age: 30 } })
    expect(rendered).toBe('Alice is 30')
    expect(prompt.isFullyRendered(rendered)).toBe(true)
  })

  test('renders nested Prompt', () => {
    const inner = new Prompt('Hello, {name}!')
    const outer = new Prompt('Message: {inner}')
    const rendered = outer.render({ inner, name: 'Bob' })
    expect(rendered).toBe('Message: Hello, Bob!')
    expect(outer.isFullyRendered(rendered)).toBe(true)
  })

  test('handles multiple nested Prompts', () => {
    const inner1 = new Prompt('{greeting}, {name}!')
    const inner2 = new Prompt('Age: {age}')
    const outer = new Prompt('{inner1} {inner2}')
    const rendered = outer.render({
      inner1,
      inner2,
      greeting: 'Hi',
      name: 'Charlie',
      age: 40,
    })
    expect(rendered).toBe('Hi, Charlie! Age: 40')
    expect(outer.isFullyRendered(rendered)).toBe(true)
  })

  test('keeps missing placeholders', () => {
    const prompt = new Prompt('Hello, {name}! Code: {code}')
    const rendered = prompt.render({ name: 'Eve' })
    expect(rendered).toBe('Hello, Eve! Code: {code}')
    expect(prompt.isFullyRendered(rendered)).toBe(false)
  })

  test('handles missing nested paths', () => {
    const prompt = new Prompt('{user.name} - {user.age}')
    const rendered = prompt.render({ user: { name: 'Frank' } })
    expect(rendered).toBe('Frank - {user.age}')
    expect(prompt.isFullyRendered(rendered)).toBe(false)
  })

  test('trims placeholder keys', () => {
    const prompt = new Prompt('Hi, { name }!')
    const rendered = prompt.render({ name: 'Grace' })
    expect(rendered).toBe('Hi, Grace!')
    expect(prompt.isFullyRendered(rendered)).toBe(true)
  })

  test('handles empty template and params', () => {
    const prompt = new Prompt('')
    const rendered = prompt.render({ key: 'value' })
    expect(rendered).toBe('')
    expect(prompt.isFullyRendered(rendered)).toBe(true)
  })

  test('preserves non-placeholder braces', () => {
    const prompt = new Prompt('Braces: {} Text: {text}')
    const rendered = prompt.render({ text: 'test' })
    expect(rendered).toBe('Braces: {} Text: test')
    expect(prompt.isFullyRendered(rendered)).toBe(true)
  })

  test('handles JSON-like template with placeholders', () => {
    const prompt = new Prompt('{"name": "{name}", "age": {age}}')
    const rendered = prompt.render({ name: 'John', age: 25 })
    expect(rendered).toBe('{"name": "John", "age": 25}')
    expect(prompt.isFullyRendered(rendered)).toBe(true)
  })

  test('handles nested JSON-like template with missing keys', () => {
    const prompt = new Prompt(
      '{"user": {"name": "{user.name}", "role": "{user.role}"}}'
    )
    const rendered = prompt.render({ user: { name: 'Alice' } })
    expect(rendered).toBe('{"user": {"name": "Alice", "role": "{user.role}"}}')
    expect(prompt.isFullyRendered(rendered)).toBe(false)
  })

  test('handles JSON-like template with nested Prompt', () => {
    const inner = new Prompt('{"greeting": "{greeting}", "name": "{name}"}')
    const outer = new Prompt('{"message": {inner}}')
    const rendered = outer.render({ inner, greeting: 'Hi', name: 'Bob' })
    expect(rendered).toBe('{"message": {"greeting": "Hi", "name": "Bob"}}')
    expect(outer.isFullyRendered(rendered)).toBe(true)
  })

  // Новые тесты для метода merge
  test('merges with single prompt using default separator', () => {
    const prompt1 = new Prompt('Hello, {name}')
    const prompt2 = new Prompt('How are you')
    const merged = prompt1.merge(prompt2)
    expect(merged.getTemplate()).toBe('Hello, {name}\nHow are you')
    const rendered = merged.render({ name: 'Alice' })
    expect(rendered).toBe('Hello, Alice\nHow are you')
    expect(merged.isFullyRendered(rendered)).toBe(true)
  })

  test('merges with single prompt using custom separator', () => {
    const prompt1 = new Prompt('Hello, {name}')
    const prompt2 = new Prompt('Goodbye')
    const merged = prompt1.merge(prompt2, ', ')
    expect(merged.getTemplate()).toBe('Hello, {name}, Goodbye')
    const rendered = merged.render({ name: 'Bob' })
    expect(rendered).toBe('Hello, Bob, Goodbye')
    expect(merged.isFullyRendered(rendered)).toBe(true)
  })

  test('merges with array of prompts using default separator', () => {
    const prompt1 = new Prompt('Line 1: {text}')
    const prompt2 = new Prompt('Line 2')
    const prompt3 = new Prompt('Line 3: {number}')
    const merged = prompt1.merge([prompt2, prompt3])
    expect(merged.getTemplate()).toBe(
      'Line 1: {text}\nLine 2\nLine 3: {number}'
    )
    const rendered = merged.render({ text: 'test', number: 42 })
    expect(rendered).toBe('Line 1: test\nLine 2\nLine 3: 42')
    expect(merged.isFullyRendered(rendered)).toBe(true)
  })

  test('merges with array of prompts using custom separator', () => {
    const prompt1 = new Prompt('First')
    const prompt2 = new Prompt('Second')
    const prompt3 = new Prompt('Third')
    const merged = prompt1.merge([prompt2, prompt3], ' | ')
    expect(merged.getTemplate()).toBe('First | Second | Third')
    const rendered = merged.render({})
    expect(rendered).toBe('First | Second | Third')
    expect(merged.isFullyRendered(rendered)).toBe(true)
  })

  test('merges with empty array of prompts', () => {
    const prompt1 = new Prompt('Solo')
    const merged = prompt1.merge([])
    expect(merged.getTemplate()).toBe('Solo')
    const rendered = merged.render({})
    expect(rendered).toBe('Solo')
    expect(merged.isFullyRendered(rendered)).toBe(true)
  })

  test('merges with single prompt and missing placeholders', () => {
    const prompt1 = new Prompt('Hi, {name}')
    const prompt2 = new Prompt('Code: {code}')
    const merged = prompt1.merge(prompt2)
    const rendered = merged.render({ name: 'Charlie' })
    expect(rendered).toBe('Hi, Charlie\nCode: {code}')
    expect(merged.isFullyRendered(rendered)).toBe(false)
  })

  test('merges with array of prompts and missing placeholders', () => {
    const prompt1 = new Prompt('Start: {start}')
    const prompt2 = new Prompt('Middle')
    const prompt3 = new Prompt('End: {end}')
    const merged = prompt1.merge([prompt2, prompt3])
    const rendered = merged.render({ start: 'begin' })
    expect(rendered).toBe('Start: begin\nMiddle\nEnd: {end}')
    expect(merged.isFullyRendered(rendered)).toBe(false)
  })

  test('merges with nested prompts in array', () => {
    const inner = new Prompt('Nested: {value}')
    const prompt1 = new Prompt('Top')
    const prompt2 = new Prompt('{inner}')
    const merged = prompt1.merge([prompt2])
    expect(merged.getTemplate()).toBe('Top\n{inner}')
    const rendered = merged.render({ inner, value: 'data' })
    expect(rendered).toBe('Top\nNested: data')
    expect(merged.isFullyRendered(rendered)).toBe(true)
  })
})
