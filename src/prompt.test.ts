import { describe, expect, test } from "vitest";
import { Prompt } from "./prompt.ts";

describe('Prompt', () => {
    test('should render prompt', () => {
        const prompt = new Prompt('Hello, {name}! You are {age} years old.');
        expect(prompt.isFullyRendered('Hello, John! You are 25 years old.')).toBe(true);
        expect(prompt.isFullyRendered('Hello, Jane! You are {age} years old.')).toBe(false);

        const rendered = prompt.render({ name: 'John', age: 25 });
        expect(prompt.isFullyRendered(rendered)).toBe(true);
        expect(rendered).toBe('Hello, John! You are 25 years old.');
    });

    test('should render complex objects', () => {
        const prompt = new Prompt('Hello, {user.name}! You are {user.age} years old.');
        const rendered = prompt.render({ user: { name: 'John', age: 25 } });
        expect(rendered).toBe('Hello, John! You are 25 years old.');
    });

    test('should keep missing values intact', () => {
        const prompt = new Prompt('Hello, {name}! Your code is {code}.');
        const rendered = prompt.render({ name: 'Alice' });
        expect(rendered).toBe('Hello, Alice! Your code is {code}.');
        expect(prompt.isFullyRendered(rendered)).toBe(false);
    });

    test('should replace multiple occurrences of the same placeholder', () => {
        const prompt = new Prompt('{greeting}, {name}! {greeting} again, {name}!');
        const rendered = prompt.render({ greeting: 'Hi', name: 'Bob' });
        expect(rendered).toBe('Hi, Bob! Hi again, Bob!');
    });

    test('should correctly render numeric values', () => {
        const prompt = new Prompt('The answer is {answer}.');
        const rendered = prompt.render({ answer: 42 });
        expect(rendered).toBe('The answer is 42.');
    });

    test('should not replace nested placeholder when nested key is missing', () => {
        const prompt = new Prompt('Hello, {user.name}! You are {user.age} years old.');
        const rendered = prompt.render({ user: { name: 'Alice' } });
        expect(rendered).toBe('Hello, Alice! You are {user.age} years old.');
        expect(prompt.isFullyRendered(rendered)).toBe(false);
    });

    test('should handle adjacent placeholders', () => {
        const prompt = new Prompt('{first}{second}');
        const rendered = prompt.render({ first: 'A', second: 'B' });
        expect(rendered).toBe('AB');
    });

    test('should trim whitespace in placeholder keys', () => {
        const prompt = new Prompt('Hello, { name }!');
        const rendered = prompt.render({ name: 'Charlie' });
        expect(rendered).toBe('Hello, Charlie!');
    });

    test('should handle empty template', () => {
        const prompt = new Prompt('');
        const rendered = prompt.render({ any: 'value' });
        expect(rendered).toBe('');
        expect(prompt.isFullyRendered(rendered)).toBe(true);
    });

    test('should handle when no matching parameters are provided', () => {
        const prompt = new Prompt('Hello, {name}!');
        const rendered = prompt.render({});
        expect(rendered).toBe('Hello, {name}!');
        expect(prompt.isFullyRendered(rendered)).toBe(false);
    });

    test('should leave non-placeholder braces intact', () => {
        // В данном случае пустые фигурные скобки не соответствуют регулярному выражению для заполнителей,
        // поэтому они не заменяются, а метод isFullyRendered считает шаблон не полностью отрендеренным.
        const prompt = new Prompt('This is a brace: {} and not a placeholder.');
        const rendered = prompt.render({});
        expect(rendered).toBe('This is a brace: {} and not a placeholder.');
        expect(prompt.isFullyRendered(rendered)).toBe(false);
    });
});
