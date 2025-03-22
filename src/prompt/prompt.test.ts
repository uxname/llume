import { describe, expect, test } from "vitest";
import { Prompt } from "./prompt.ts";

describe('Prompt', () => {
    test('renders basic template with params', () => {
        const prompt = new Prompt('Hello, {name}! Age: {age}');
        const rendered = prompt.render({ name: 'John', age: 25 });
        expect(rendered).toBe('Hello, John! Age: 25');
        expect(prompt.isFullyRendered(rendered)).toBe(true);
    });

    test('renders nested object paths', () => {
        const prompt = new Prompt('{user.name} is {user.age}');
        const rendered = prompt.render({ user: { name: 'Alice', age: 30 } });
        expect(rendered).toBe('Alice is 30');
        expect(prompt.isFullyRendered(rendered)).toBe(true);
    });

    test('renders nested Prompt', () => {
        const inner = new Prompt('Hello, {name}!');
        const outer = new Prompt('Message: {inner}');
        const rendered = outer.render({ inner, name: 'Bob' });
        expect(rendered).toBe('Message: Hello, Bob!');
        expect(outer.isFullyRendered(rendered)).toBe(true);
    });

    test('handles multiple nested Prompts', () => {
        const inner1 = new Prompt('{greeting}, {name}!');
        const inner2 = new Prompt('Age: {age}');
        const outer = new Prompt('{inner1} {inner2}');
        const rendered = outer.render({ inner1, inner2, greeting: 'Hi', name: 'Charlie', age: 40 });
        expect(rendered).toBe('Hi, Charlie! Age: 40');
        expect(outer.isFullyRendered(rendered)).toBe(true);
    });

    test('keeps missing placeholders', () => {
        const prompt = new Prompt('Hello, {name}! Code: {code}');
        const rendered = prompt.render({ name: 'Eve' });
        expect(rendered).toBe('Hello, Eve! Code: {code}');
        expect(prompt.isFullyRendered(rendered)).toBe(false);
    });

    test('handles missing nested paths', () => {
        const prompt = new Prompt('{user.name} - {user.age}');
        const rendered = prompt.render({ user: { name: 'Frank' } });
        expect(rendered).toBe('Frank - {user.age}');
        expect(prompt.isFullyRendered(rendered)).toBe(false); // Ожидаем false, так как {user.age} не заменен
    });

    test('trims placeholder keys', () => {
        const prompt = new Prompt('Hi, { name }!');
        const rendered = prompt.render({ name: 'Grace' });
        expect(rendered).toBe('Hi, Grace!');
        expect(prompt.isFullyRendered(rendered)).toBe(true);
    });

    test('handles empty template and params', () => {
        const prompt = new Prompt('');
        const rendered = prompt.render({ key: 'value' });
        expect(rendered).toBe('');
        expect(prompt.isFullyRendered(rendered)).toBe(true);
    });

    test('preserves non-placeholder braces', () => {
        const prompt = new Prompt('Braces: {} Text: {text}');
        const rendered = prompt.render({ text: 'test' });
        expect(rendered).toBe('Braces: {} Text: test');
        expect(prompt.isFullyRendered(rendered)).toBe(true);
    });

    test('handles JSON-like template with placeholders', () => {
        const prompt = new Prompt('{"name": "{name}", "age": {age}}');
        const rendered = prompt.render({ name: 'John', age: 25 });
        expect(rendered).toBe('{"name": "John", "age": 25}');
        expect(prompt.isFullyRendered(rendered)).toBe(true);
    });

    test('handles nested JSON-like template with missing keys', () => {
        const prompt = new Prompt('{"user": {"name": "{user.name}", "role": "{user.role}"}}');
        const rendered = prompt.render({ user: { name: 'Alice' } });
        expect(rendered).toBe('{"user": {"name": "Alice", "role": "{user.role}"}}');
        expect(prompt.isFullyRendered(rendered)).toBe(false); // Ожидаем false, так как {user.role} не заменен
    });

    test('handles JSON-like template with nested Prompt', () => {
        const inner = new Prompt('{"greeting": "{greeting}", "name": "{name}"}');
        const outer = new Prompt('{"message": {inner}}');
        const rendered = outer.render({ inner, greeting: 'Hi', name: 'Bob' });
        expect(rendered).toBe('{"message": {"greeting": "Hi", "name": "Bob"}}');
        expect(outer.isFullyRendered(rendered)).toBe(true);
    });
});