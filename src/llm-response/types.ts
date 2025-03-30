export enum LLMResponseTypes {
  SUCCESS = "success",
  ERROR = "error",
  CALL_TOOL = "call_tool",
}

export interface BaseResponse {
  type: LLMResponseTypes;
}

export interface SuccessResponse<TData> extends BaseResponse {
  data: TData;
}

export interface ErrorResponse extends BaseResponse {
  message: string;
}

export interface CallToolResponse<TToolInput> extends BaseResponse {
  tool_name: string;
  tool_input: TToolInput;
}

export type LlmResponse<T = unknown> =
  | SuccessResponse<T>
  | ErrorResponse
  | CallToolResponse<T>;
