# ai0-agent

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.2. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

# Ideas

## 1. Роутер
- Роутер должен анализировать историю выполнения запросов для улучшения логики обработки и оптимизации.

## 2. Память
- **Краткосрочная память** — хранение данных в контексте вызова нескольких функций.
- **Долгосрочная память** — хранение данных в контексте всех вызовов функций.
- **RAG поиск** (например, через Typesense).

## 3. [+] Retry
- Реализовать повторную попытку выполнения до 5 раз в случае ошибки.

## 4. Вызов функций
- Возможность вызова одной функции из другой.

## 5. Стандартная библиотека
- Дефолтные функции, которые можно использовать как инструменты (например, инструмент для последовательного вызова агентов, передавая результат одного в следующий).
- Например:
  - функция для генерации функций
  - функция для проверки безопасности
  - не ИИ функции, для работы с базой данных например

## 6. Группы агентов
- Возможность группировки агентов для выполнения задач совместно.

## 7. Функции как объекты
- ИИ функция должна иметь возможность вызывать другие функции, аналогично передаче функции по ссылке в JavaScript (например, как коллбэки).

## 8. Стандартизированная обработка ошибок
- Разработать единый механизм обработки ошибок для всех агентов.

## 9. Агент-композер (MultiAgentExecutor)
- Агент, который может делить задачу на подзадачи и назначать для каждой подзадачи отдельного агента.

## 10. Мидлвары
- Возможность интеграции мидлваров для модификации поведения агентов на различных этапах.

## 11. Кэширование
- Механизм кэширования, если входящие параметры не изменялись (это может быть реализовано на уровне кода, например, в JS).

## 12. Несколько LLM-провайдеров с fallback
- **Смысл**:
  - Указать список LLM провайдеров в порядке приоритета (например, OpenAI, Groq, Mistral).
  - Если основной провайдер не отвечает (таймаут или ошибка), автоматический запрос ко второму и так далее.
  - Использовать `Promise.any` или `race` для получения быстрого ответа от первого доступного провайдера.

## 13. Вызов обычных функций из ИИ-функций
- Возможность вызова обычных функций (например, tools) из ИИ-функций, если это необходимо.

## 14. Шаблонизатор запросов!!!!!!!!!!
- Инструмент для создания шаблонов запросов, которые могут быть использованы для стандартизированных запросов.

## 15. Плейграунд для функций

## 16. DI Container для всех функций, ну и вообще сделать типа DI систему