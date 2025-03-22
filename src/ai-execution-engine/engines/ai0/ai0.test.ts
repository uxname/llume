import {expect, test} from 'vitest'
import {Ai0} from "./ai0.ts";

const sum = (a: number, b: number) => a + b;

test('should work', async () => {
    const ai0Provider = new Ai0(
        'https://ai0.uxna.me/',
        process.env.AI0_API_KEY!
    );
    expect(ai0Provider.name).toBe('AI0');

    const prompt = 'What is 2 + 2? Answer format should be the JSON {"result": 4}';
    const response = await ai0Provider.execute({prompt});
    expect(response.result).toBe(4);
})