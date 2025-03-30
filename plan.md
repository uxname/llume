Мне нужно переписать проект для улучшения читаемости, структуры и особенно системы middleware.
Идея сделать middleware похожим на Express.js (простым, гибким, позволяющим модифицировать запрос/ответ) — отличный подход для таких систем.

Вот подробный план рефакторинга/переписывания с новой структурой файлов и описанием каждого ключевого компонента.

**Основная Идея Рефакторинга:**

1.  **Централизованный Pipeline:** Вместо того чтобы middleware были привязаны к конкретным `AiFunction` или `Tool`, создадим центральный "пайплайн" или "обработчик", через который проходит каждый запрос на выполнение шага (будь то вызов LLM или инструмента).
2.  **Контекст Выполнения (`Context`):** Создадим единый объект контекста, который передается через все middleware. Этот объект будет содержать всю необходимую информацию: входные данные, текущее состояние, историю, определения функций/инструментов, результат текущего шага и т.д. Middleware смогут читать и модифицировать этот контекст.
3.  **Middleware API:** Middleware будут функциями вида `(context, next) => Promise<void>`. Они выполняют свою логику, могут изменять `context` и вызывают `next()` для передачи управления следующему middleware или основному обработчику шага.
4.  **Разделение Ответственностей:** Четко разделим:
    *   **Определения (`Definitions`):** `AiFunctionDefinition`, `ToolDefinition` — содержат только метаданные (имя, описание, схемы, шаблон промпта/логику выполнения).
    *   **Исполнитель (`Agent` / `Runner`):** Управляет общим процессом (цикл `smartExecute`), хранит состояние, историю, вызывает пайплайн для каждого шага.
    *   **Пайплайн (`Pipeline`):** Обрабатывает *один* шаг (вызов LLM или инструмента), прогоняя контекст через цепочку middleware.
    *   **Контекст (`Context`):** Переносит данные между middleware и шагами.

**Предлагаемая Структура Файлов:**

```
ai0-agent/
├── src/
│   ├── core/                     # Ядро системы: пайплайн, контекст, базовые типы
│   │   ├── agent-context.ts      # Класс или интерфейс для контекста выполнения
│   │   ├── agent-pipeline.ts     # Класс для управления цепочкой middleware
│   │   └── errors.ts             # Пользовательские классы ошибок
│   │
│   ├── components/               # Основные строительные блоки
│   │   ├── agent.ts              # Главный класс для управления выполнением (замена Executor)
│   │   ├── ai-function.ts        # Определение AI-функции (без middleware)
│   │   ├── tool.ts               # Определение Инструмента (без middleware)
│   │   ├── history.ts            # Управление историей диалога
│   │   └── llm-provider.ts       # Абстрактный класс/интерфейс для LLM
│   │
│   ├── middleware/               # Стандартные и пользовательские middleware
│   │   ├── index.ts              # Экспорт стандартных middleware
│   │   ├── logging.ts            # Middleware для логирования
│   │   ├── validation.ts         # Middleware для валидации входа/выхода
│   │   ├── error-handler.ts      # Middleware для обработки ошибок
│   │   ├── history-manager.ts    # Middleware для добавления сообщений в историю
│   │   └── state-manager.ts      # Middleware для работы со state в контексте
│   │
│   ├── providers/                # Конкретные реализации LLM-провайдеров
│   │   └── ai0-llm.ts            # Реализация для AI0
│   │
│   ├── prompts/                  # Работа с промптами
│   │   ├── prompt-template.ts    # Класс для шаблонов промптов (можно оставить старый)
│   │   └── prompt-builder.ts     # Логика построения промптов (адаптированная под Context)
│   │
│   ├── schemas/                  # Zod схемы для валидации и описания структур
│   │   ├── index.ts              # Экспорт основных схем
│   │   ├── common.ts             # Общие схемы (Error, Success, ToolCall)
│   │   └── function-specific/    # (Опционально) Схемы для конкретных функций/инструментов
│   │
│   ├── types/                    # Общие TypeScript типы и интерфейсы
│   │   ├── index.ts
│   │   └── middleware.ts         # Типы для Middleware (MiddlewareFn, NextFn)
│   │
│   └── index.ts                  # Главный экспортный файл библиотеки
│
├── tests/                        # Тесты (переписать под новую структуру)
│   └── example.test.ts
│
└── index.ts                      # Главный экспортный файл библиотеки
```

**Детальное Описание Ключевых Файлов:**

1.  **`src/types/middleware.ts`**
    *   **Назначение:** Определить типы для системы middleware.
    *   **Содержимое:**
        *   `AgentContext`: Тип для объекта контекста (импортируется из `core/agent-context.ts`).
        *   `NextFunction`: Тип для функции `next` (`type NextFunction = () => Promise<void>;`).
        *   `MiddlewareFn`: Тип для самой функции middleware (`type MiddlewareFn = (context: AgentContext, next: NextFunction) => Promise<void>;`).

2.  **`src/core/agent-context.ts`**
    *   **Назначение:** Определить структуру данных, которая передается между middleware и содержит всю информацию о текущем шаге выполнения.
    *   **Содержимое:**
        *   Класс `AgentContext` или интерфейс.
        *   **Поля:**
            *   `request`: Данные запроса (имя функции/инструмента, входные данные).
            *   `response`: Результат шага (ответ LLM, результат инструмента, ошибка). Изначально `undefined`.
            *   `state`: Разделяемое состояние между шагами (замена `ExecutionContext.state`).
            *   `history`: Экземпляр `History` (замена `ExecutionContext.executionHistory`).
            *   `definitions`: Доступные определения `AiFunction` и `Tool`.
            *   `llmProvider`: Экземпляр используемого LLM провайдера.
            *   `config`: Конфигурация агента (maxIterations и т.д.).
            *   `currentStep`: Информация о текущем шаге (тип: 'llm' | 'tool', имя).
            *   `error`: Поле для хранения ошибки, если она произошла на шаге.
        *   **Методы (опционально):** Хелперы для удобного доступа/изменения полей.

3.  **`src/core/agent-pipeline.ts`**
    *   **Назначение:** Управлять выполнением цепочки middleware для одного шага.
    *   **Содержимое:**
        *   Класс `AgentPipeline`.
        *   `private middlewares: MiddlewareFn[] = []`: Массив функций middleware.
        *   `use(middleware: MiddlewareFn)`: Метод для добавления middleware в цепочку.
        *   `async run(context: AgentContext)`: Основной метод. Запускает выполнение цепочки.
            *   Реализует логику вызова `middleware[0](context, next)` где `next` рекурсивно вызывает `middleware[1]`, и так далее.
            *   После выполнения всех middleware, вызывает основную логику шага (вызов LLM или инструмента), результат записывается в `context.response`.
            *   Обрабатывает ошибки, записывая их в `context.error`.

4.  **`src/components/agent.ts`**
    *   **Назначение:** Оркестратор верхнего уровня. Заменяет `Executor`. Управляет полным циклом выполнения задачи, включая множественные шаги (как `smartExecute`).
    *   **Содержимое:**
        *   Класс `Agent`.
        *   **Поля:**
            *   `config`: Настройки (maxIterations, historyLimit).
            *   `llmProvider`: Экземпляр LLM провайдера по умолчанию.
            *   `functions: Map<string, AiFunctionDefinition>`: Зарегистрированные определения функций.
            *   `tools: Map<string, ToolDefinition>`: Зарегистрированные определения инструментов.
            *   `pipeline: AgentPipeline`: Экземпляр пайплайна для обработки шагов.
            *   `globalMiddlewares: MiddlewareFn[]`: Middleware, которые будут добавлены в `pipeline` для *каждого* шага.
        *   **Методы:**
            *   `constructor(config, llmProvider)`: Инициализация.
            *   `addFunction(definition: AiFunctionDefinition)`: Регистрация функции.
            *   `addTool(definition: ToolDefinition)`: Регистрация инструмента.
            *   `use(middleware: MiddlewareFn)`: Добавление глобального middleware.
            *   `async execute<TInput, TOutput>(functionName: string, input: TInput)`: Основной метод запуска (аналог `smartExecute`).
                *   Создает начальный `AgentContext` (с историей, состоянием, входными данными).
                *   В цикле (до `maxIterations`):
                    1.  Определяет следующий шаг (LLM или Tool на основе предыдущего ответа).
                    2.  Заполняет `context.request` для текущего шага.
                    3.  Вызывает `this.pipeline.run(context)`.
                    4.  Анализирует `context.response` или `context.error`.
                    5.  Обновляет историю и состояние (это может делаться и в middleware).
                    6.  Если результат финальный (`success`), возвращает его.
                    7.  Если ошибка или лимит итераций, выбрасывает исключение.

5.  **`src/components/ai-function.ts`**
    *   **Назначение:** Определить структуру AI-функции (только данные и метаданные).
    *   **Содержимое:**
        *   Класс `AiFunctionDefinition` или интерфейс.
        *   **Поля:** `name`, `description`, `inputSchema`, `outputSchema`, `promptTemplate`.
        *   *Больше не содержит:* `llm`, `tools`, `middlewares`, `runMiddleware`. Связь с инструментами и LLM управляется `Agent` и `Context`.

6.  **`src/components/tool.ts`**
    *   **Назначение:** Определить структуру инструмента (данные и логика выполнения).
    *   **Содержимое:**
        *   Абстрактный класс `ToolDefinition`.
        *   **Поля:** `name`, `description`, `inputSchema`, `outputSchema`.
        *   **Абстрактный метод:** `abstract execute(input: TInput, context?: AgentContext): Promise<TOutput>`. Контекст опционален, если инструменту нужен доступ к состоянию/истории.
        *   *Больше не содержит:* `middlewares`, `runMiddleware`.

7.  **`src/middleware/*.ts`**
    *   **Назначение:** Реализовать конкретные middleware.
    *   **Пример (`logging.ts`):**
        ```typescript
        import { MiddlewareFn } from '../types';
        import pc from 'picocolors'; // Или другой логгер

        export const loggingMiddleware: MiddlewareFn = async (context, next) => {
          console.log(pc.blue(`[${context.currentStep.type}:${context.currentStep.name}] Request:`), context.request);
          await next(); // Вызвать следующий middleware или основной обработчик
          if (context.error) {
            console.error(pc.red(`[${context.currentStep.type}:${context.currentStep.name}] Error:`), context.error);
          } else {
            console.log(pc.green(`[${context.currentStep.type}:${context.currentStep.name}] Response:`), context.response);
          }
        };
        ```
    *   **Пример (`history-manager.ts`):**
        ```typescript
        import { MiddlewareFn } from '../types';
        import { HistoryMessage } from '../components/history'; // Предполагаем, что тип экспортируется

        export const historyManagerMiddleware: MiddlewareFn = async (context, next) => {
          // Добавить сообщение пользователя/инструмента перед вызовом LLM/Tool?
          // Например, если это LLM шаг, добавить user query из context.request
          if (context.currentStep.type === 'llm' && context.request?.input) {
             // Логика добавления user message или tool response message в context.history
             // ... (нужно аккуратно определить, что добавлять на основе context.request)
          }

          await next(); // Выполнить шаг (LLM/Tool)

          // Добавить сообщение ассистента/результат инструмента после выполнения шага
          if (!context.error && context.response) {
            const message: HistoryMessage = {
              role: context.currentStep.type === 'llm' ? 'assistant' : 'user', // Ответ LLM -> assistant, ответ Tool -> user (tool response)
              // ... (логика формирования сообщения на основе context.response и context.currentStep)
            };
            context.history.addMessage(message);
          }
        };
        ```

8.  **`src/prompts/prompt-builder.ts`**
    *   **Назначение:** Строить промпты для LLM.
    *   **Изменения:** Методы будут принимать `AgentContext` вместо `ExecutionContext`, `AiFunction`, `variables` и т.д. по отдельности. Вся нужная информация (история, состояние, определения инструментов, схема вывода) будет извлекаться из контекста.

9.  **`eslint.config.mjs`**
    *   **Назначение:** Конфигурация ESLint.
    *   **Изменения:** Переименовать из `.ts` в `.mjs` для использования нативного ESM синтаксиса конфигурации, который является стандартом для ESLint v9+. Содержимое можно оставить прежним или обновить под новые правила/плагины, если нужно.

**План Переписывания (Шаги):**

1.  **Фаза 0: Подготовка**
    *   Создать новую структуру папок.
    *   Перенести существующие файлы конфигурации (`package.json`, `tsconfig.json`, `.prettierrc.json`, `.gitignore`, `.env_example`).
    *   Обновить `package.json` (скрипты, зависимости, если нужно).
    *   Переименовать `eslint.config.ts` в `eslint.config.mjs`.
    *   Настроить пути импорта в `tsconfig.json` (если используешь `paths`).

2.  **Фаза 1: Базовые Типы и Ядро**
    *   Определить типы в `src/types/middleware.ts`.
    *   Реализовать `src/core/agent-context.ts`.
    *   Реализовать `src/core/agent-pipeline.ts` (логику `use` и каркас `run`).
    *   Определить базовые классы/интерфейсы в `src/components/` (`AiFunctionDefinition`, `ToolDefinition`, `LLMProvider`, `History`). Перенести/адаптировать существующий код `History` и `PromptTemplate`.

3.  **Фаза 2: Компоненты и Провайдеры**
    *   Перенести и адаптировать реализацию `Ai0Llm` в `src/providers/ai0-llm.ts`.
    *   Перенести/адаптировать Zod схемы в `src/schemas/`.
    *   Адаптировать `src/prompts/prompt-builder.ts` для работы с `AgentContext`.

4.  **Фаза 3: Реализация Пайплайна и Агента**
    *   Дописать логику `AgentPipeline.run` для вызова основного действия (LLM/Tool) после middleware.
    *   Реализовать класс `Agent` в `src/components/agent.ts`, включая метод `execute` с циклом обработки шагов и вызовом `pipeline.run`.

5.  **Фаза 4: Middleware**
    *   Реализовать базовые middleware: `logging`, `validation` (для входа функции/инструмента и выхода LLM/инструмента), `errorHandler`, `historyManager`, `stateManager`.

6.  **Фаза 5: Тестирование и Интеграция**
    *   Переписать тесты из `example.test.ts` под новую архитектуру:
        *   Создать экземпляр `Agent`.
        *   Добавить определения функций/инструментов.
        *   Добавить нужные middleware (`agent.use(...)`).
        *   Вызвать `agent.execute(...)`.
        *   Проверить результат, состояние, историю.
    *   Отладить взаимодействие компонентов.

7.  **Фаза 6: Документация и Завершение**
    *   Обновить `README.md`, описав новую архитектуру, как использовать `Agent` и middleware.
    *   Добавить комментарии JSDoc к ключевым классам и методам.
    *   Проверить линтинг и форматирование (`bun run check`, `bun run lint:fix`).

**Преимущества Нового Подхода:**

*   **Гибкость Middleware:** Легко добавлять/удалять/переупорядочивать middleware глобально (`Agent.use`) или даже динамически для конкретного вызова (если расширить API).
*   **Централизованное Управление:** Логика выполнения шага (LLM/Tool) и применение middleware сосредоточены в `AgentPipeline`.
*   **Чистые Компоненты:** `AiFunctionDefinition` и `ToolDefinition` становятся простыми структурами данных/определениями, не обремененными логикой выполнения middleware.
*   **Тестируемость:** Легче тестировать отдельные middleware и сам пайплайн.
*   **Расширяемость:** Проще добавлять новые типы шагов или сложную логику в виде middleware (например, кэширование, retry, роутинг).
*   **Понятность:** Структура `(context, next)` интуитивно понятна разработчикам, знакомым с веб-фреймворками.

Вот текущая реализация проекта:
...

Твоя задача - написать код для папки core