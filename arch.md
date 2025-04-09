1.  **`ExecutionPipeline`**
  *   **Purpose**: Определяет структуру конкретного рабочего процесса (агента). Это "чертеж" того, как должны выполняться шаги.
  *   **Composition**:
    *   `steps: Record<string, PipelineStep>`: Словарь всех доступных шагов в этом пайплайне, где ключ — `id` шага.
    *   `flowRules: FlowRule[]`: Список статических правил, определяющих переходы между шагами.
    *   `entryStepId: string`: ID шага, с которого начинается выполнение пайплайна.

2.  **`PipelineStep`** (Интерфейс)
  *   **Purpose**: Общий контракт для любого шага, который может быть выполнен в рамках `ExecutionPipeline`. Гарантирует, что `PipelineExecutor` может работать с любым типом шага единообразно.
  *   **Composition**:
    *   `id: string`: Уникальный идентификатор шага внутри пайплайна.
    *   `inputSchema?: object`: (Опционально) Схема (например, Zod) для валидации входных данных, которые шаг ожидает найти в `PipelineState`.
    *   `outputSchema?: object`: (Опционально) Схема (например, Zod) для валидации данных, которые шаг обещает вернуть/поместить в `PipelineState`.
    *   `execute(state: PipelineState, context: ExecutionContext): Promise<Partial<PipelineState> & { _nextStepId?: string }>`: Асинхронный метод, выполняющий основную логику шага. Принимает текущее состояние (`state`) и контекст (`context`), возвращает объект с изменениями для состояния и опционально `_nextStepId` для динамического указания следующего шага.

3.  **`AiFunction`**
  *   **Purpose**: Утилитарный класс/функция для инкапсуляции вызова LLM с определенным промптом и ожидаемым форматом вывода. Делает вызов LLM переиспользуемым и тестируемым компонентом. Не зависит напрямую от пайплайна.
  *   **Composition**:
    *   `promptTemplate: PromptTemplate`: Шаблон промпта, используемый для генерации запроса к LLM.
    *   `outputSchema?: object`: (Опционально) Схема (например, Zod) для парсинга и валидации ответа от LLM.
    *   `llmProvider: LLMProvider`: Экземпляр провайдера LLM для выполнения запроса.
    *   `call(variables: Record<string, any>): Promise<any>`: Метод, который принимает переменные для шаблона, компилирует промпт, вызывает `llmProvider`, парсит ответ согласно `outputSchema` (если есть) и возвращает результат.

4.  **`AiFunctionStep`** (Реализация `PipelineStep`)
  *   **Purpose**: Конкретный тип шага (`PipelineStep`), который использует `AiFunction` для выполнения своей логики через LLM. Адаптирует `AiFunction` для использования в пайплайне.
  *   **Composition**:
    *   `id: string`: Реализует `PipelineStep.id`.
    *   `aiFunction: AiFunction`: Экземпляр `AiFunction`, который будет вызван.
    *   `inputMapper?: (state: PipelineState) => Record<string, any>`: (Опционально) Функция, преобразующая `PipelineState` в словарь переменных (`variables`) для метода `aiFunction.call()`. По умолчанию может передавать весь `state` или его часть.
    *   `outputMapper?: (result: any, state: PipelineState) => Partial<PipelineState>`: (Опционально) Функция, преобразующая результат вызова `aiFunction.call()` в объект с изменениями для `PipelineState`. По умолчанию может просто добавлять результат в `state`.
    *   `execute(...)`: Реализует `PipelineStep.execute`. Внутри использует `inputMapper`, вызывает `aiFunction.call()`, использует `outputMapper` для подготовки результата и возвращает его.

5.  **`CodeStep`** (Реализация `PipelineStep`)
  *   **Purpose**: Конкретный тип шага (`PipelineStep`), который выполняет произвольный TypeScript/JavaScript код. Используется для интеграции инструментов, условной логики, обработки данных и т.д.
  *   **Composition**:
    *   `id: string`: Реализует `PipelineStep.id`.
    *   `handler: (state: PipelineState, context: ExecutionContext) => Promise<Partial<PipelineState> & { _nextStepId?: string }>`: Асинхронная функция, содержащая пользовательскую логику шага.
    *   `execute(...)`: Реализует `PipelineStep.execute`. Просто вызывает `this.handler`, передавая ему `state` и `context`.

6.  **`PipelineExecutor`**
  *   **Purpose**: Движок фреймворка. Отвечает за запуск `ExecutionPipeline`, последовательный вызов шагов (`PipelineStep`), управление `PipelineState` и обработку переходов (динамических через `_nextStepId` или статических через `FlowRule`).
  *   **Composition**:
    *   `run(pipeline: ExecutionPipeline, initialState: PipelineState, initialContext?: Partial<ExecutionContext>): Promise<PipelineState>`: Основной метод для запуска выполнения пайплайна. Возвращает финальное состояние `PipelineState` после завершения.
    *   (Внутренняя логика): Цикл выполнения шагов, обновление состояния, определение следующего шага, обработка событий через `EventHandler`.

7.  **`PipelineState`**
  *   **Purpose**: Объект, хранящий данные, которые передаются и могут изменяться между шагами (`PipelineStep`) во время *одного* конкретного запуска `ExecutionPipeline`.
  *   **Composition**: Произвольный объект (`Record<string, any>`), структура которого определяется потребностями конкретного пайплайна.

8.  **`FlowRule`**
  *   **Purpose**: Определяет статическое правило перехода между двумя шагами (`PipelineStep`) в `ExecutionPipeline`.
  *   **Composition**:
    *   `from: string`: ID шага, *после* которого это правило может быть применено.
    *   `to: string`: ID шага, *к которому* нужно перейти, если правило сработает.
    *   `condition?: (state: PipelineState) => boolean`: (Опционально) Функция, которая проверяет `PipelineState`. Правило сработает, только если `condition` вернет `true` (или если `condition` отсутствует).

9.  **`ExecutionContext`**
  *   **Purpose**: Контейнер для общих, "глобальных" ресурсов и сервисов, которые должны быть доступны любому шагу (`PipelineStep`) во время выполнения, но не являются частью изменяемого состояния (`PipelineState`). Предотвращает прокидывание зависимостей через `PipelineState`.
  *   **Composition**:
    *   `llmProvider?: LLMProvider`: Доступный провайдер LLM.
    *   `toolRegistry?: ToolRegistry`: Доступный реестр инструментов.
    *   `eventHandler?: EventHandler`: Обработчик событий для трассировки.
    *   (Могут быть добавлены другие общие сервисы: конфигурация, логгер и т.д.)

10. **`LLMProvider`** (Интерфейс)
  *   **Purpose**: Абстракция для взаимодействия с различными API языковых моделей. Позволяет фреймворку не зависеть от конкретной реализации LLM.
  *   **Composition**:
    *   `generate(prompt: string, options?: any): Promise<any>`: Основной метод для отправки промпта и получения ответа от LLM. (Могут быть и другие методы, например, для потоковой передачи).

11. **`PromptTemplate`**
  *   **Purpose**: Утилита для создания и форматирования текстовых промптов для LLM с использованием переменных.
  *   **Composition**:
    *   `constructor(template: string)`: Принимает строку шаблона.
    *   `compile(variables: Record<string, any>): string`: Подставляет переменные в шаблон и возвращает готовый промпт.

12. **`Tool`** (Интерфейс)
  *   **Purpose**: Абстракция для внешних инструментов (API, калькулятор, поиск), которые могут быть вызваны из `CodeStep`.
  *   **Composition**:
    *   `name: string`: Уникальное имя инструмента.
    *   `description: string`: Описание для LLM (если используется для автоматического выбора инструментов).
    *   `inputSchema?: object`: Схема для входных данных инструмента.
    *   `outputSchema?: object`: Схема для выходных данных инструмента.
    *   `execute(input: any): Promise<any>`: Метод, выполняющий логику инструмента.

13. **`ToolRegistry`**
  *   **Purpose**: Централизованное хранилище и менеджер для доступных инструментов (`Tool`).
  *   **Composition**:
    *   `register(tool: Tool): void`: Добавляет инструмент в реестр.
    *   `get(name: string): Tool | undefined`: Возвращает инструмент по имени.
    *   `list(): Tool[]`: Возвращает список всех зарегистрированных инструментов.

14. **`EventHandler`** (Интерфейс)
  *   **Purpose**: Абстракция для системы трассировки и мониторинга. Позволяет подключать различные обработчики (логгер в консоль, отправка в систему мониторинга) для отслеживания хода выполнения пайплайна.
  *   **Composition**:
    *   `publish(event: ExecutionEvent): Promise<void> | void`: Метод, который вызывается `PipelineExecutor` при возникновении различных событий.

15. **`ExecutionEvent`**
  *   **Purpose**: Структура данных, описывающая одно событие, произошедшее во время выполнения пайплайна. Используется для передачи информации в `EventHandler`.
  *   **Composition**:
    *   `type: string`: Тип события (e.g., 'STEP_START', 'STEP_END', 'LLM_CALL', 'TOOL_CALL', 'PIPELINE_START', 'PIPELINE_END').
    *   `timestamp: number`: Время события.
    *   `pipelineId?: string`: ID пайплайна (если применимо).
    *   `stepId?: string`: ID шага (если применимо).
    *   `data: any`: Дополнительные данные, специфичные для события (входные/выходные данные шага, промпт/ответ LLM, имя/вход/выход инструмента, ошибка).