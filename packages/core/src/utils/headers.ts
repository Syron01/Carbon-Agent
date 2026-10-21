export function headersToRecord(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of (headers as any).entries()) {
		result[key] = value;
	}
	return result;
}
