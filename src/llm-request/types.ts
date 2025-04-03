export enum Role {
	USER = "user",
	ASSISTANT = "assistant",
	SYSTEM = "system",
}

export interface Message {
	role: Role;
	content: string;
}
