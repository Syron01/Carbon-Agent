import type { EngineTool } from "astro-engine";
import { ChannelType, Client, GatewayIntentBits, type TextChannel } from "discord.js";
import type { ToolDefinition } from "../extensions/index.js";

let discordClient: Client | null = null;

async function getDiscordClient(token: string): Promise<Client> {
	if (discordClient) return discordClient;

	discordClient = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.MessageContent,
			GatewayIntentBits.GuildMembers,
		],
	});

	await discordClient.login(token);
	return discordClient;
}

export interface DiscordToolOptions {
	token?: string;
}

// List Guilds
export function createDiscordListGuildsTool(options?: DiscordToolOptions): EngineTool {
	return {
		name: "discord_list_guilds",
		label: "Discord: List Servers",
		description: "List all Discord servers (guilds) the bot is a member of.",
		parameters: {
			type: "object",
			properties: {},
		},
		execute: async (_toolCallId: string, _params: unknown) => {
			if (!options?.token)
				return {
					content: [{ type: "text", text: "Error: No Discord token provided. Use /discord command to set it." }],
					details: { ok: false },
				};
			const client = await getDiscordClient(options.token);
			const fetchedGuilds = await client.guilds.fetch();
			const guilds = fetchedGuilds.map((g) => ({ id: g.id, name: g.name || "(unknown)" }));
			return {
				content: [{ type: "text", text: JSON.stringify(guilds, null, 2) }],
				details: { ok: true, count: guilds.length },
			};
		},
	};
}

// Get Channels
export function createDiscordGetChannelsTool(options?: DiscordToolOptions): EngineTool {
	return {
		name: "discord_get_channels",
		label: "Discord: Get Channels",
		description: "Get all channels in a specific Discord server.",
		parameters: {
			type: "object",
			properties: {
				guildId: { type: "string", description: "The ID of the server." },
			},
			required: ["guildId"],
		},
		execute: async (_toolCallId: string, params: unknown) => {
			const { guildId } = (params as { guildId?: string }) ?? {};
			if (!options?.token)
				return { content: [{ type: "text", text: "Error: No Discord token provided." }], details: {} };
			if (!guildId) return { content: [{ type: "text", text: "guildId is required." }], details: {} };
			const client = await getDiscordClient(options.token);
			const guild = await client.guilds.fetch(guildId).catch(() => null);
			if (!guild) return { content: [{ type: "text", text: "Server not found." }], details: {} };
			const fetchedChannels = await guild.channels.fetch();
			const channels = fetchedChannels
				.filter((c) => !!c)
				.map((c) => ({ id: c!.id, name: c!.name, type: ChannelType[c!.type] }));
			return {
				content: [{ type: "text", text: JSON.stringify(channels, null, 2) }],
				details: { ok: true, count: channels.length },
			};
		},
	};
}

// Send Message
export function createDiscordSendMessageTool(options?: DiscordToolOptions): EngineTool {
	return {
		name: "discord_send_message",
		label: "Discord: Send Message",
		description: "Send a message to a Discord channel.",
		parameters: {
			type: "object",
			properties: {
				channelId: { type: "string", description: "The ID of the channel." },
				content: { type: "string", description: "The message content." },
			},
			required: ["channelId", "content"],
		},
		execute: async (_toolCallId: string, params: unknown) => {
			const { channelId, content } = (params as { channelId?: string; content?: string }) ?? {};
			if (!options?.token)
				return { content: [{ type: "text", text: "Error: No Discord token provided." }], details: {} };
			if (!channelId || !content)
				return { content: [{ type: "text", text: "channelId and content are required." }], details: {} };
			const client = await getDiscordClient(options.token);
			const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
			if (!channel) return { content: [{ type: "text", text: "Channel not found." }], details: {} };
			const message = await channel.send(content);
			return {
				content: [{ type: "text", text: `Message sent. ID: ${message.id}` }],
				details: { ok: true, messageId: message.id },
			};
		},
	};
}

// Manage Channel (Create/Delete)
export function createDiscordManageChannelTool(options?: DiscordToolOptions): EngineTool {
	return {
		name: "discord_manage_channel",
		label: "Discord: Manage Channels",
		description: "Create or delete a channel in a Discord server.",
		parameters: {
			type: "object",
			properties: {
				guildId: { type: "string", description: "The ID of the server." },
				action: { type: "string", enum: ["create", "delete"], description: "Action to perform." },
				name: { type: "string", description: "Name of the channel (required for create)." },
				type: {
					type: "string",
					enum: ["text", "voice", "category"],
					description: "Type of channel (default: text).",
				},
				channelId: { type: "string", description: "The ID of the channel to delete." },
			},
			required: ["guildId", "action"],
		},
		execute: async (_toolCallId: string, params: unknown) => {
			const { guildId, action, name, type, channelId } =
				(params as {
					guildId?: string;
					action?: "create" | "delete";
					name?: string;
					type?: "text" | "voice" | "category";
					channelId?: string;
				}) ?? {};
			if (!options?.token)
				return { content: [{ type: "text", text: "Error: No Discord token provided." }], details: {} };
			if (!guildId || !action)
				return { content: [{ type: "text", text: "guildId and action are required." }], details: {} };
			const client = await getDiscordClient(options.token);
			const guild = await client.guilds.fetch(guildId).catch(() => null);
			if (!guild) return { content: [{ type: "text", text: "Server not found." }], details: {} };

			if (action === "create") {
				if (!name) return { content: [{ type: "text", text: "Name is required for creation." }], details: {} };
				let discordType = ChannelType.GuildText;
				if (type === "voice") discordType = ChannelType.GuildVoice;
				if (type === "category") discordType = ChannelType.GuildCategory;

				const channel = await guild.channels.create({ name, type: discordType });
				return {
					content: [{ type: "text", text: `Channel created: ${channel.name} (${channel.id})` }],
					details: { ok: true },
				};
			} else if (action === "delete") {
				if (!channelId)
					return { content: [{ type: "text", text: "channelId is required for deletion." }], details: {} };
				const channel = await guild.channels.fetch(channelId).catch(() => null);
				if (!channel) return { content: [{ type: "text", text: "Channel not found." }], details: {} };
				await channel.delete();
				return { content: [{ type: "text", text: `Channel deleted.` }], details: { ok: true } };
			}
			return { content: [{ type: "text", text: "Invalid action." }], details: {} };
		},
	};
}

export function createDiscordToolDefinitions(options?: DiscordToolOptions): ToolDefinition[] {
	const listGuildsExecute = createDiscordListGuildsTool(options).execute;
	const getChannelsExecute = createDiscordGetChannelsTool(options).execute;
	const sendMessageExecute = createDiscordSendMessageTool(options).execute;
	const manageChannelExecute = createDiscordManageChannelTool(options).execute;
	return [
		{
			name: "discord_list_guilds",
			label: "Discord: List Servers",
			description: "List all Discord servers the bot is in.",
			parameters: { type: "object", properties: {}, required: [] },
			execute: listGuildsExecute,
		},
		{
			name: "discord_get_channels",
			label: "Discord: Get Channels",
			description: "Get all channels in a server.",
			parameters: {
				type: "object",
				properties: { guildId: { type: "string" } },
				required: ["guildId"],
			},
			execute: getChannelsExecute,
		},
		{
			name: "discord_send_message",
			label: "Discord: Send Message",
			description: "Send a message to a channel.",
			parameters: {
				type: "object",
				properties: { channelId: { type: "string" }, content: { type: "string" } },
				required: ["channelId", "content"],
			},
			execute: sendMessageExecute,
		},
		{
			name: "discord_manage_channel",
			label: "Discord: Manage Channels",
			description: "Manage channels (create/delete).",
			parameters: {
				type: "object",
				properties: {
					guildId: { type: "string" },
					action: { type: "string", enum: ["create", "delete"] },
					name: { type: "string" },
					type: { type: "string", enum: ["text", "voice", "category"] },
					channelId: { type: "string" },
				},
				required: ["guildId", "action"],
			},
			execute: manageChannelExecute,
		},
	];
}
