import { EventEmitter } from "node:events";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";

export interface SubAgentTask {
	taskName: string;
	task: string;
	cwd: string;
	systemPrompt: string;
	model: unknown;
}

interface WorkerEntry {
	worker: Worker;
	agentId: string | null;
}

interface QueuedTask {
	task: SubAgentTask;
	resolve: (value: unknown) => void;
	reject: (err: Error) => void;
	signal?: AbortSignal;
}

export class WorkerPool extends EventEmitter {
	private workers: WorkerEntry[] = [];
	private maxWorkers: number;
	private queue: QueuedTask[] = [];
	private workerPath: string;

	constructor(workerPath: string, maxWorkers?: number) {
		super();
		this.maxWorkers = maxWorkers ?? Math.max(2, cpus().length - 1);
		this.workerPath = workerPath;
	}

	get activeAgentIds(): string[] {
		return this.workers.filter((w) => w.agentId !== null).map((w) => w.agentId!);
	}

	hasAgent(agentId: string): boolean {
		return this.workers.some((w) => w.agentId === agentId);
	}

	runTask(task: SubAgentTask, signal?: AbortSignal): Promise<unknown> {
		const entry = this.getIdleWorker();
		if (entry) return this.executeOnWorker(entry, task, signal);
		if (this.workers.length < this.maxWorkers) return this.createAndExecute(task, signal);

		return new Promise((resolve, reject) => {
			this.queue.push({ task, resolve, reject, signal });
		});
	}

	sendMessage(targetAgentId: string, message: string): void {
		const entry = this.workers.find((w) => w.agentId === targetAgentId);
		if (entry) {
			entry.worker.postMessage({ type: "ipc_message", message });
		}
	}

	async shutdown(): Promise<void> {
		for (const entry of this.workers) {
			entry.worker.postMessage({ type: "shutdown" });
			await entry.worker.terminate();
		}
		this.workers = [];
		this.queue = [];
	}

	private getIdleWorker(): WorkerEntry | null {
		return this.workers.find((w) => w.agentId === null) ?? null;
	}

	private createAndExecute(task: SubAgentTask, signal?: AbortSignal): Promise<unknown> {
		const worker = new Worker(this.workerPath);
		const entry: WorkerEntry = { worker, agentId: null };
		this.workers.push(entry);

		worker.on("exit", () => {
			const idx = this.workers.indexOf(entry);
			if (idx !== -1) this.workers.splice(idx, 1);
		});

		return this.executeOnWorker(entry, task, signal);
	}

	private executeOnWorker(entry: WorkerEntry, task: SubAgentTask, signal?: AbortSignal): Promise<unknown> {
		const { worker } = entry;
		entry.agentId = task.taskName;

		return new Promise((resolve, reject) => {
			const abortHandler = () => {
				worker.postMessage({ type: "abort" });
			};
			if (signal) {
				if (signal.aborted) abortHandler();
				else signal.addEventListener("abort", abortHandler, { once: true });
			}

			const onMessage = (msg: Record<string, unknown>) => {
				switch (msg.type) {
					case "result":
						cleanup();
						resolve(msg.data);
						break;
					case "error":
						cleanup();
						reject(new Error(msg.message as string));
						break;
					case "event":
						this.emit(msg.name as string, msg.payload);
						break;
				}
			};

			const onError = (err: Error) => {
				cleanup();
				reject(err);
			};

			const cleanup = () => {
				if (signal) signal.removeEventListener("abort", abortHandler);
				worker.removeListener("message", onMessage);
				worker.removeListener("error", onError);
				entry.agentId = null;
				this.scheduleNext();
			};

			worker.on("message", onMessage);
			worker.on("error", onError);
			worker.postMessage({ type: "run", task });
		});
	}

	private scheduleNext(): void {
		if (this.queue.length === 0) return;
		const entry = this.getIdleWorker();
		if (!entry) return;

		const next = this.queue.shift()!;
		this.executeOnWorker(entry, next.task, next.signal).then(next.resolve).catch(next.reject);
	}
}
