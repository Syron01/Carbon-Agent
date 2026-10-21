import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";

export type BusEventType =
	| "message_start"
	| "message_update"
	| "message_end"
	| "engine_start"
	| "engine_end"
	| "tool_execution_start"
	| "tool_execution_step"
	| "tool_execution_end"
	| "state_update"
	| "clear_chat"
	| "terminal_log"
	| "mobile_status"
	| "subagent_start"
	| "subagent_update"
	| "subagent_end"
	| "memory_data"
	| "auto_retry_start"
	| "compaction_start"
	| "compaction_end"
	| "queue_update"
	| "connected"
	| "heartbeat";

export interface BusEvent {
	type: BusEventType;
	[key: string]: unknown;
}

interface BusClient {
	id: string;
	isMobile: boolean;
	send(event: BusEvent): void;
	close(): void;
}

class WsClient implements BusClient {
	id: string;
	isMobile: boolean;
	private ws: WebSocket;

	constructor(ws: WebSocket, id: string, isMobile: boolean) {
		this.ws = ws;
		this.id = id;
		this.isMobile = isMobile;
	}

	get rawWs(): WebSocket {
		return this.ws;
	}

	send(event: BusEvent): void {
		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(event));
		}
	}

	close(): void {
		this.ws.close();
	}
}

class SseClient implements BusClient {
	id: string;
	isMobile: boolean;
	private res: ServerResponse;

	constructor(res: ServerResponse, id: string, isMobile: boolean) {
		this.res = res;
		this.id = id;
		this.isMobile = isMobile;
	}

	send(event: BusEvent): void {
		try {
			this.res.write(`data: ${JSON.stringify(event)}\n\n`);
		} catch {
			// Client disconnected
		}
	}

	close(): void {
		try {
			this.res.end();
		} catch {
			// Already closed
		}
	}
}

class RealtimeBus {
	private wsServer: WebSocketServer | null = null;
	private sseClients: Map<string, SseClient> = new Map();
	private wsClients: Map<string, WsClient> = new Map();
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private port: number = 0;
	private httpServer!: ReturnType<typeof createServer>;

	get httpPort(): number {
		return this.port;
	}

	start(port: number = 0): void {
		this.httpServer = createServer((req, res) => {
			if (req.url === "/health") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: true, clients: this.getClientCount() }));
				return;
			}

			if (req.url === "/events" || req.url?.startsWith("/events?")) {
				const isMobile = req.url?.includes("mobile=1") ?? false;
				const clientId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
					"Access-Control-Allow-Origin": "*",
				});

				const client = new SseClient(res, clientId, isMobile);
				this.sseClients.set(clientId, client);

				// Initial heartbeat
				res.write(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);

				req.on("close", () => {
					this.sseClients.delete(clientId);
				});

				return;
			}

			res.writeHead(404);
			res.end("Not Found");
		});

		this.httpServer.listen(port, "127.0.0.1", () => {
			const addr = this.httpServer!.address() as AddressInfo;
			this.port = addr.port;

			// Start WebSocket server on same port
			this.wsServer = new WebSocketServer({ server: this.httpServer, path: "/ws" });

			this.wsServer.on("connection", (ws, req) => {
				const url = new URL(req.url || "/ws", `http://127.0.0.1:${this.port}`);
				const isMobile = url.searchParams.get("mobile") === "1";
				const clientId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

				const client = new WsClient(ws, clientId, isMobile);
				this.wsClients.set(clientId, client);

				ws.send(JSON.stringify({ type: "connected", clientId }));

				ws.on("close", () => {
					this.wsClients.delete(clientId);
				});

				ws.on("error", () => {
					this.wsClients.delete(clientId);
				});
			});
		});

		// Heartbeat every 30 seconds
		this.heartbeatInterval = setInterval(() => {
			this.broadcast({ type: "heartbeat", ts: Date.now() });
		}, 30000);
	}

	stop(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
		for (const client of this.sseClients.values()) client.close();
		for (const client of this.wsClients.values()) client.close();
		this.sseClients.clear();
		this.wsClients.clear();
		this.wsServer?.close();
		try {
			this.httpServer.close();
		} catch {
			/* already closed */
		}
	}

	broadcast(event: BusEvent): void {
		const _json = JSON.stringify(event);
		// SSE clients
		for (const client of this.sseClients.values()) {
			try {
				client.send(event);
			} catch {
				this.sseClients.delete(client.id);
			}
		}
		// WebSocket clients
		for (const client of this.wsClients.values()) {
			try {
				client.send(event);
			} catch {
				this.wsClients.delete(client.id);
			}
		}
	}

	getClientCount(): number {
		return this.sseClients.size + this.wsClients.size;
	}

	getMobileClientCount(): number {
		let count = 0;
		for (const client of this.sseClients.values()) {
			if (client.isMobile) count++;
		}
		for (const client of this.wsClients.values()) {
			if (client.isMobile) count++;
		}
		return count;
	}
}

export const realtimeBus = new RealtimeBus();
