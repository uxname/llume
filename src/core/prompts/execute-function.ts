import { PromptTemplate } from "../base-classes/prompt-template.ts";

export const EXECUTE_FUNCTION_PROMPT_TEMPLATE =
  new PromptTemplate(`Ты - умный ассистент.
Твоя задача - ответить на вопрос пользователя если тебе хватает данных.
Если тебе не хватает данных - можешь попросить вызвать одну из предоставленных tool.

Вот история взаимодействия с пользователем:
{{history}}

Твой ответ должен быть строго определённого формата:
{{jsonSchemas}}

Твой ответ не должен содержать никаких данных кроме JSON нужного формата.

Вот вопрос пользователя:
{{query}}
`);
