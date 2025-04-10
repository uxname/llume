import type { CacheProvider } from "./cache-provider";

interface CacheEntry<T> {
	value: T;
	expiry?: number;
	addedTime: number;
}

export interface InMemoryCacheProviderOptions {
	maxSize?: number;
	defaultTtl?: number;
	cleanupIntervalMs?: number;
}

export class InMemoryCacheProvider implements CacheProvider {
	private cache = new Map<string, CacheEntry<unknown>>();
	private readonly maxSize: number;
	private readonly defaultTtl?: number;
	private cleanupInterval: NodeJS.Timer | null = null;
	private readonly cleanupIntervalMs: number;

	constructor(options: InMemoryCacheProviderOptions = {}) {
		this.maxSize = options.maxSize ?? 1000;
		this.defaultTtl = options.defaultTtl;
		this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60000; // Default: 1 minute

		if (this.cleanupIntervalMs > 0) {
			this.startCleanupInterval();
		}
	}

	async get<T>(key: string): Promise<T | undefined> {
		const entry = this.cache.get(key);
		if (!entry) {
			return undefined;
		}

		if (entry.expiry && Date.now() > entry.expiry) {
			this.cache.delete(key);
			return undefined;
		}

		return entry.value as T;
	}

	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
			this.evictOldest();
		}

		const effectiveTtl = ttl ?? this.defaultTtl;
		const expiry = effectiveTtl ? Date.now() + effectiveTtl : undefined;

		const entry: CacheEntry<T> = {
			value,
			expiry,
			addedTime: Date.now(),
		};
		this.cache.set(key, entry);
	}

	async delete(key: string): Promise<void> {
		this.cache.delete(key);
	}

	async clear(): Promise<void> {
		this.cache.clear();
	}

	private evictOldest(): void {
		let oldestKey: string | null = null;
		let oldestTime = Number.MAX_SAFE_INTEGER;

		for (const [key, entry] of this.cache.entries()) {
			if (entry.addedTime < oldestTime) {
				oldestTime = entry.addedTime;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
		}
	}

	private cleanupExpired(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (entry.expiry && now > entry.expiry) {
				this.cache.delete(key);
			}
		}
	}

	private startCleanupInterval(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpired();
		}, this.cleanupIntervalMs);
		this.cleanupInterval.unref(); // Allow Node.js process to exit if this is the only timer
	}

	stopCleanupInterval(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}
}
