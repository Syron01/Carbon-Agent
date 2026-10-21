import { join } from "node:path";
import { getDocsPath } from "../config.js";

const UNKNOWN_PROVIDER = "unknown";

export function getProviderLoginHelp(): string {
	return [
		"OAuth veya API anahtari ile bir saglayiciya giris yapmak icin /login kullanin. Bakiniz:",
		`  ${join(getDocsPath(), "providers.md")}`,
		`  ${join(getDocsPath(), "models.md")}`,
	].join("\n");
}

export function formatNoModelsAvailableMessage(): string {
	return `No available models. ${getProviderLoginHelp()}`;
}

export function formatNoModelSelectedMessage(): string {
	return `Model secilmedi.\n\n${getProviderLoginHelp()}\n\nArdindan bir model secmek icin /model kullanin.`;
}

export function formatNoApiKeyFoundMessage(provider: string): string {
	const providerDisplay = provider === UNKNOWN_PROVIDER ? "secilen model" : provider;
	return `${providerDisplay} icin API anahtari bulunamadi.\n\n${getProviderLoginHelp()}`;
}
