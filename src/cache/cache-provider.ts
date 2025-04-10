export interface CacheProvider {
	get<T>(key: string): Promise<T | undefined>;
	set<T>(key: string, value: T, ttl?: number): Promise<void>;
	delete(key: string): Promise<void>;
	clear(): Promise<void>;
}
