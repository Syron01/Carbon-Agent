import { EventEmitter } from "node:events";

export interface EventBus {
	emit(channel: string, data: unknown): void;
	on(channel: string, handler: (data: unknown) => void): () => void;
	once(channel: string, handler: (data: unknown) => void): () => void;
}

export interface EventBusController extends EventBus {
	clear(): void;
}

export function createEventBus(): EventBusController {
	const emitter = new EventEmitter();

	// Prevent Node.js MaxListenersExceededWarning in large sessions
	emitter.setMaxListeners(100);

	const wrapHandler = (channel: string, handler: (data: unknown) => void) => {
		const safe = async (data: unknown) => {
			try {
				await handler(data);
			} catch (err) {
				console.error(`Event handler error (${channel}):`, err);
			}
		};
		return safe;
	};

	return {
		emit: (channel, data) => {
			emitter.emit(channel, data);
		},
		on: (channel, handler) => {
			const safe = wrapHandler(channel, handler);
			emitter.on(channel, safe);
			return () => emitter.off(channel, safe);
		},
		once: (channel, handler) => {
			const safe = wrapHandler(channel, handler);
			emitter.once(channel, safe);
			return () => emitter.off(channel, safe);
		},
		clear: () => {
			emitter.removeAllListeners();
		},
	};
}
