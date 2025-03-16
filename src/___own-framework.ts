type Message = {
    content: string;
    role: "system" | "user" | "assistant" | "function";
    name?: string;
  };
  
  interface Task {
    id: string;
    description: string;
    goal: string;
    context?: any; // Типы сообщений
  
    completed: boolean;
  }
  
  // Интерфейс для взаимодействия с языковой моделью
  interface LLMProvider {
    generateResponse(messages: Message[]): Promise<string>;
  }
  
  // Простая реализация хранилища памяти
  class Memory {
    private state: Map<string, any> = new Map();
  
    set(key: string, value: any): void {
      this.state.set(key, value);
    }
  
    get(key: string): any {
      return this.state.get(key);
    }
  
    getState(): Map<string, any> {
      return new Map(this.state);
    }
  }
  
  // Базовый класс для агентов
  class Agent {
    private name: string;
    private role: string;
    private memory: Memory;
    private llmProvider: LLMProvider;
    private messageHistory: Message[] = [];
  
    constructor(name: string, role: string, llmProvider: LLMProvider) {
      this.name = name;
      this.role = role;
      this.memory = new Memory();
      this.llmProvider = llmProvider;
  
      // Инициализация агента с системным сообщением
      this.messageHistory.push({
        role: "system",
        content: `Ты агент по имени ${name}. Твоя роль: ${role}.`,
      });
    }
  
    public async processTask(task: Task): Promise<string> {
      // Добавляем задачу в историю сообщений
      this.messageHistory.push({
        role: "user",
        content: `Задача: ${task.description}\nЦель: ${task.goal}${
          task.context ? `\nКонтекст: ${JSON.stringify(task.context)}` : ""
        }`,
      });
  
      // Получаем ответ от языковой модели
      const response = await this.llmProvider.generateResponse(
        this.messageHistory
      );
  
      // Сохраняем ответ в истории
      this.messageHistory.push({
        role: "assistant",
        content: response,
      });
  
      return response;
    }
  
    public async sendMessage(message: string, from?: string): Promise<string> {
      this.messageHistory.push({
        role: "user",
        content: message,
        name: from,
      });
  
      const response = await this.llmProvider.generateResponse(
        this.messageHistory
      );
  
      this.messageHistory.push({
        role: "assistant",
        content: response,
      });
  
      return response;
    }
  
    public getName(): string {
      return this.name;
    }
  
    public getRole(): string {
      return this.role;
    }
  
    public getMemory(): Memory {
      return this.memory;
    }
  
    public getMessageHistory(): Message[] {
      return [...this.messageHistory];
    }
  }
  
  // Класс для выполнения задач
  class TaskExecutor {
    async executeTask(agent: Agent, task: Task): Promise<Task> {
      const result = await agent.processTask(task);
  
      // Простая логика определения завершения задачи
      if (
        result.toLowerCase().includes("выполнено") ||
        result.toLowerCase().includes("завершено") ||
        result.toLowerCase().includes("готово")
      ) {
        task.completed = true;
      }
  
      return task;
    }
  }
  
  // Координатор для нескольких агентов
  class Swarm {
    private agents: Map<string, Agent> = new Map();
    private taskExecutor: TaskExecutor;
  
    constructor() {
      this.taskExecutor = new TaskExecutor();
    }
  
    public addAgent(agent: Agent): void {
      this.agents.set(agent.getName(), agent);
    }
  
    public getAgent(name: string): Agent | undefined {
      return this.agents.get(name);
    }
  
    public async assignTask(agentName: string, task: Task): Promise<Task> {
      const agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Агент с именем ${agentName} не найден`);
      }
  
      return await this.taskExecutor.executeTask(agent, task);
    }
  
    public async communicateBetweenAgents(
      fromAgentName: string,
      toAgentName: string,
      message: string
    ): Promise<string> {
      const fromAgent = this.agents.get(fromAgentName);
      const toAgent = this.agents.get(toAgentName);
  
      if (!fromAgent || !toAgent) {
        throw new Error("Один или оба агента не найдены");
      }
  
      return await toAgent.sendMessage(message, fromAgent.getName());
    }
  
    public async collaborativeTask(
      task: Task,
      agentNames: string[]
    ): Promise<string> {
      let context = task.context || {};
      let results: string[] = [];
  
      for (const agentName of agentNames) {
        const agent = this.agents.get(agentName);
        if (!agent) continue;
  
        // Обновляем контекст задачи с результатами предыдущих агентов
        const updatedTask: Task = {
          ...task,
          context: {
            ...context,
            previousResults: results,
          },
        };
  
        // Выполняем задачу с текущим агентом
        await this.taskExecutor.executeTask(agent, updatedTask);
  
        // Добавляем результат
        const agentResult = agent.getMessageHistory().slice(-1)[0].content;
        results.push(`${agent.getName()}: ${agentResult}`);
  
        // Обновляем контекст для следующего агента
        context = {
          ...context,
          previousResults: results,
        };
      }
  
      return results.join("\n\n");
    }
  }
  
  // Пример простого провайдера LLM
  class SimpleLLMProvider implements LLMProvider {
    async generateResponse(messages: Message[]): Promise<string> {
      // В реальности здесь был бы запрос к API языковой модели
      console.log("Sending messages to LLM API:", messages);
      return "Это заглушка для ответа языковой модели. В реальном приложении здесь будет ответ от API.";
    }
  }
  
  // Пример использования
  async function example() {
    // Инициализация LLM-провайдера
    const llmProvider = new SimpleLLMProvider();
  
    // Создание агентов
    const researcher = new Agent(
      "Исследователь",
      "Анализ данных и поиск информации",
      llmProvider
    );
    const writer = new Agent(
      "Писатель",
      "Создание текстового контента на основе исследований",
      llmProvider
    );
  
    // Создание роя агентов
    const swarm = new Swarm();
    swarm.addAgent(researcher);
    swarm.addAgent(writer);
  
    // Определение задачи
    const researchTask: Task = {
      id: "1",
      description: "Найти информацию о последних достижениях в области ИИ",
      goal: "Собрать актуальные данные о прорывах в ИИ за последний год",
      completed: false,
    };
  
    // Выполнение задачи исследователем
    await swarm.assignTask("Исследователь", researchTask);
  
    // Передача информации между агентами
    await swarm.communicateBetweenAgents(
      "Исследователь",
      "Писатель",
      "Вот результаты моего исследования о последних достижениях в ИИ..."
    );
  }
  