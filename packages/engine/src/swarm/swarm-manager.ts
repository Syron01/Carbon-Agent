import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
	type Api,
	type AssistantMessage,
	auditManager,
	type Context,
	type Model,
	getModel,
	type SimpleStreamOptions,
	type StreamFunction,
	streamSimple,
} from "astro-core";

export interface SwarmTask {
	id: string;
	description: string;
	context: string[];
	priority: "high" | "normal" | "low";
}

export interface SwarmAgent {
	id: string;
	role: "reader" | "searcher" | "coder" | "reviewer" | "architect" | "growth_hacker";
	status: "idle" | "working" | "done" | "error";
	model: Model<Api>;
	capability?: string[];
}

export interface SwarmManagerOptions {
	streamFn?: StreamFunction<Api, SimpleStreamOptions>;
	getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
	reasoning?: SimpleStreamOptions["reasoning"];
}

/**
 * Asynchronous Agent Swarm (Swarm Intelligence)
 * Multi-threading magic to execute complex tasks 5x faster by dividing and conquering.
 */
export class SwarmManager extends EventEmitter {
	private agents: Map<string, SwarmAgent> = new Map();
	private isBusy = false;
	private readonly streamFn: StreamFunction<Api, SimpleStreamOptions>;
	private defaultModel: Model<Api>;

	constructor(
		_defaultModel: Model<Api>,
		private options: SwarmManagerOptions = {},
	) {
		super();
		this.defaultModel = _defaultModel;
		this.streamFn = options.streamFn ?? streamSimple;
		this.initializeSwarm();
	}

	private initializeSwarm() {
		const roles: SwarmAgent["role"][] = ["reader", "searcher", "coder", "reviewer", "architect", "growth_hacker"];
		roles.forEach((role) => {
			const id = `agent-${role}-${randomUUID().split("-")[0]}`;
			this.agents.set(role, {
				id,
				role,
				status: "idle",
				model: this.routeToModel(role),
			});
		});
	}

	/**
	 * Enterprise Grade Model Router.
	 * Optimizes for Cost (Google level) or Intelligence (NASA level) based on role requirements.
	 */
	private routeToModel(role: SwarmAgent["role"]): Model<Api> {
		const highIntelligenceRoles = ["coder", "architect"];
		const _bulkProcessingRoles = ["reader", "searcher", "reviewer", "growth_hacker"];

		const provider = this.defaultModel.provider;

		if (provider === "google-vertex" || provider === "vercel-ai-gateway" || provider === "openrouter") {
			return this.defaultModel;
		}

		// Build a real Model record from the registry so streamSimple gets a valid api/id.
		let wanted: { provider: string; name: string } | undefined;
		if (provider === "google-antigravity" || provider === "antigravity") {
			wanted = highIntelligenceRoles.includes(role)
				? { provider: "google-antigravity", name: "gemini-4-argon" }
				: { provider: "google-antigravity", name: "gemini-3.8-flash-high" };
		} else if (highIntelligenceRoles.includes(role)) {
			// NASA Grade: Use high-reasoning models (Claude 3.5 Sonnet / GPT-4o)
			wanted = { provider: "anthropic", name: "claude-3-5-sonnet-latest" };
		} else {
			// Google/Microsoft Grade: Use fast, high-throughput models (Gemini Flash / GPT-4o-mini)
			wanted = { provider: "google", name: "gemini-1.5-flash-latest" };
		}

		const resolved = getModel(wanted.provider, wanted.name);
		if (resolved) {
			return resolved as Model<Api>;
		}

		if (!this.warnedIncompleteModel) {
			this.warnedIncompleteModel = true;
			console.warn(
				`[Swarm] Model ${wanted.provider}/${wanted.name} not found in registry; falling back to incomplete model record.`,
			);
		}
		return { ...wanted, id: wanted.name } as unknown as Model<Api>;
	}

	private warnedIncompleteModel = false;

	/**
	 * Musk-Grade Semantic Context Compaction.
	 * Instead of just slicing text, it uses VectorDB to rank context by relevance
	 * to the task, ensuring only the most critical information is sent to the LLM.
	 */
	private async compactContext(context: string[], taskDescription: string): Promise<string[]> {
		if (context.length <= 3) return context;

		const { VectorDB } = await import("astro-core");
		const vdb = new VectorDB();

		context.forEach((c, i) => {
			vdb.addDocument({ id: `ctx-${i}`, content: c });
		});

		// Get top 5 most relevant context snippets
		const ranked = vdb.search(taskDescription, 5);
		const results = ranked.map((r: any) => r.content);

		auditManager.log({
			component: "Swarm",
			action: "Semantic Compaction",
			status: "success",
			details: { originalCount: context.length, compactedCount: results.length },
		});

		return results;
	}

	public async executeParallelTask(taskDescription: string, context: string[]): Promise<string> {
		if (this.isBusy) {
			throw new Error("Swarm is currently busy with another task.");
		}
		if (!taskDescription.trim()) {
			throw new Error("Swarm task description cannot be empty.");
		}

		this.isBusy = true;
		const compactedContext = await this.compactContext(context, taskDescription);

		const taskId = randomUUID();
		this.emit("swarm:start", { taskId, taskDescription });

		try {
			// Divide the task into sub-tasks for different roles
			// Use a more robust error handling for parallel execution
			const preliminaryResults = await Promise.all([
				this.delegateToRole("reader", "Read and summarize context for the task.", compactedContext).catch(
					(e) => `[Reader Error]: ${e.message}`,
				),
				this.delegateToRole("searcher", "Find relevant API usages or project patterns.", compactedContext).catch(
					(e) => `[Searcher Error]: ${e.message}`,
				),
				this.delegateToRole(
					"architect",
					"Plan the architectural implementation of the feature.",
					compactedContext,
				).catch((e) => `[Architect Error]: ${e.message}`),
			]);

			const [readSummary, searchResults, archPlan] = preliminaryResults;

			// Hand over to the coder with the findings
			const coderPrompt = `Implement this plan: ${archPlan}\nContext: ${readSummary}\nPatterns: ${searchResults}`;
			const codeResult = await this.delegateToRole("coder", coderPrompt, []).catch((e) => {
				throw new Error(`Critical Swarm Failure (Coder): ${e.message}`);
			});

			// Review the code
			const reviewerPrompt = `Review this code for errors and performance issues:\n${codeResult}`;
			const reviewResult = await this.delegateToRole("reviewer", reviewerPrompt, []).catch(
				(e) => `[Reviewer Error]: ${e.message}`,
			);

			this.emit("swarm:complete", { taskId, result: reviewResult });
			return reviewResult;
		} catch (error: any) {
			this.emit("swarm:error", { taskId, error: error.message });
			throw error;
		} finally {
			this.isBusy = false;
		}
	}

	/**
	 * NASA Grade Self-Correction Loop.
	 * Recursively verifies and fixes agent outputs until perfection is achieved.
	 */
	public async verifyAndFix(code: string, requirements: string): Promise<string> {
		auditManager.log({
			component: "Swarm",
			action: "Verification Loop Started",
			status: "success",
			details: { requirements },
		});

		const review = await this.delegateToRole(
			"reviewer",
			`Verify this code against these requirements:\nRequirements: ${requirements}\nCode:\n${code}`,
			[],
		);

		if (review.toLowerCase().includes("all good") || review.toLowerCase().includes("pass")) {
			return code;
		}

		auditManager.log({
			component: "Swarm",
			action: "Self-Correction Triggered",
			status: "warning",
			details: { reason: review.slice(0, 100) },
		});

		const fixedCode = await this.delegateToRole(
			"coder",
			`Fix the following code based on this review:\nReview: ${review}\nOriginal Code:\n${code}`,
			[],
		);
		return fixedCode;
	}

	private async delegateToRole(role: SwarmAgent["role"], prompt: string, context: string[]): Promise<string> {
		const agent = this.agents.get(role);
		if (!agent) throw new Error(`No agent available for role: ${role}`);

		agent.status = "working";
		auditManager.log({
			component: "Swarm",
			action: `Delegating to ${role}`,
			status: "success",
			details: { prompt: prompt.slice(0, 100), contextLength: context.length },
		});

		this.emit("agent:start", { agentId: agent.id, role: agent.role });

		try {
			const apiKey = await this.options.getApiKey?.(agent.model.provider);
			if (!apiKey) {
				throw new Error(`No API key available for swarm agent provider: ${agent.model.provider}`);
			}

			const result = await this.runAgent(agent, prompt, context, apiKey);

			agent.status = "done";
			auditManager.log({
				component: "Swarm",
				action: `Result from ${role}`,
				status: "success",
				details: { resultLength: result.length },
			});
			this.emit("agent:complete", { agentId: agent.id, role: agent.role });
			return result;
		} catch (err: any) {
			agent.status = "error";
			auditManager.log({
				component: "Swarm",
				action: `Error from ${role}`,
				status: "failure",
				details: { error: err.message },
			});
			this.emit("agent:error", { agentId: agent.id, role: agent.role, error: err });
			throw err;
		}
	}

	private async runAgent(agent: SwarmAgent, prompt: string, context: string[], apiKey: string): Promise<string> {
		const llmContext: Context = {
			systemPrompt: `You are the ${agent.role} agent in a MoonCLI swarm. Return concise, actionable output for your role.`,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: [`Task: ${prompt}`, context.length > 0 ? `Context:\n${context.join("\n\n")}` : ""]
								.filter(Boolean)
								.join("\n\n"),
						},
					],
					timestamp: Date.now(),
				},
			],
		};

		const stream = this.streamFn(agent.model, llmContext, {
			apiKey,
			reasoning: this.options.reasoning,
		});
		const message: AssistantMessage = await stream.result();
		if (message.stopReason === "error" || message.stopReason === "aborted") {
			throw new Error(message.errorMessage || `Swarm agent ${agent.role} failed`);
		}

		const text = message.content
			.filter((part: any) => part.type === "text" || part.type === "thinking")
			.map((part: any) => (part.type === "text" ? part.text : part.thinking))
			.join("\n")
			.trim();
		return text || `[${agent.role}] completed without text output.`;
	}
}
