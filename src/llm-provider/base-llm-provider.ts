export interface LLMRequestParams {
    prompt: string;
    log?: boolean;
}

export abstract class BaseLLMProvider {
    abstract name: string;

    public async query<T = any>(params: LLMRequestParams): Promise<T> {
        const log = params.log === undefined ? true : params.log;
        if (log) {
            this.logRequest(params.prompt);
        }
        const response = await this.generateResponse(params);
        if (log) {
            this.logResponse(response);
        }
        return response;
    }

    // Abstract method that must be implemented by all child classes
    protected abstract generateResponse<T = any>(params: LLMRequestParams): Promise<T>;

    protected log(color: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' = 'white', ...messages: any): void {
        let colorCode : string;
        switch (color) {
            case 'red':
                colorCode = '\x1b[31m';
                break;
            case 'green':
                colorCode = '\x1b[32m';
                break;
            case 'yellow':
                colorCode = '\x1b[33m';
                break;
            case 'blue':
                colorCode = '\x1b[34m';
                break;
            case 'magenta':
                colorCode = '\x1b[35m';
                break;
            case 'cyan':
                colorCode = '\x1b[36m';
                break;
            case 'white':
                colorCode = '\x1b[37m';
                break;
            default:
                colorCode = '\x1b[0m';
                break;
        }

        console.log(colorCode, messages[0], '\x1b[0m', ...messages.slice(1));
    }

    protected logRequest(prompt: string): void {
        this.log('blue', `<<${this.name} REQUEST>>\n${prompt}\n`);
    }

    protected logResponse(response: string): void {
        this.log('green', `<<${this.name} RESPONSE>>`, response);
    }

    protected logError(error: any): void {
        this.log('red', `<<${this.name} ERROR>>`, error);
    }
}