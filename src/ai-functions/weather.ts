import { AiFunction } from "./ai-function.ts";
import { z } from "zod";
import { AiExecutionEngineBase } from "../ai-execution-engine/ai-execution-engine-base.ts";

const weatherResponseSchema = z.object({
  result: z.string().nullable().describe("Человекочитаемое описание погоды"),
  degree: z.number().nullable().describe("Температура в градусах"),
  errors: z.array(z.string()).nullable().describe("Список ошибок, если есть"),
});

export type WeatherResponse = typeof weatherResponseSchema;

export class Weather extends AiFunction<WeatherResponse> {
  constructor(aiExecutionEngine?: AiExecutionEngineBase) {
    super({
      name: "Погода",
      description: "Возвращает обычную погоду по заданному городу и дате",
      prompt: "Определи какая погода обычно в городе {city} на дату {date}",
      responseSchema: weatherResponseSchema,
      aiExecutionEngine,
    });
  }
}
