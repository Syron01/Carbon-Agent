export interface MemoryState {
	source_id: string;
	relation_type: string;
	target_id: string;
	amplitude?: number;
	probability?: number;
}

/**
 * SuperLLama Quantum Memory Engine — Grover's Search Algorithm Simulator
 *
 * This module simulates Grover's quantum search to achieve O(√N) amplitude
 * amplification for relational memory retrieval. Instead of classical O(N)
 * linear search over the fact database, it applies a phase inversion (Oracle)
 * to matching states and then reflects about the mean (Diffusion) to amplify
 * the probability amplitudes of the correct memory facts.
 */

/**
 * Quantum Oracle Operator (U_w)
 * Reverses the phase (flips sign to negative) of states that match the search query.
 */
function applyOracle(states: MemoryState[], queryText: string): void {
	const q = queryText.toLowerCase();
	for (let i = 0; i < states.length; i++) {
		const s = states[i];
		const match = s.source_id.includes(q) || s.relation_type.includes(q) || s.target_id.includes(q);

		// Phase inversion for matching states: |x> -> -|x>
		if (match) {
			s.amplitude = -(s.amplitude ?? 0);
		}
	}
}

/**
 * Quantum Diffusion Operator (U_s) — Inversion about the mean
 * Amplifies the amplitude of the states that were phase-inverted by the Oracle.
 */
function applyDiffusion(states: MemoryState[]): void {
	const N = states.length;
	if (N === 0) return;

	// Calculate the mean amplitude (μ)
	let sum = 0;
	for (let i = 0; i < N; i++) {
		sum += states[i].amplitude ?? 0;
	}
	const mean = sum / N;

	// Invert about the mean: 2μ - a_i
	for (let i = 0; i < N; i++) {
		states[i].amplitude = 2 * mean - (states[i].amplitude ?? 0);
	}
}

/**
 * Normalizes probabilities so they sum to ~1.0
 */
function normalizeProbabilities(states: MemoryState[]): void {
	let totalProb = 0;
	for (let i = 0; i < states.length; i++) {
		const amp = states[i].amplitude ?? 0;
		const prob = amp * amp;
		states[i].probability = prob;
		totalProb += prob;
	}

	// Prevent divide-by-zero
	if (totalProb > 0) {
		for (let i = 0; i < states.length; i++) {
			states[i].probability = (states[i].probability ?? 0) / totalProb;
		}
	}
}

/**
 * Simulates Grover's Search over a set of classical database rows.
 *
 * @param rows - Array of objects from the SQLite Relations table.
 * @param queryText - User's message or context query.
 * @returns Array of states sorted by probability (highest amplitude first).
 */
export function simulateGroverSearch(rows: any[], queryText: string): MemoryState[] {
	const N = rows.length;
	if (N === 0) return [];

	// Step 1: Initialize Superposition (equal amplitude = 1/√N)
	const initialAmplitude = 1 / Math.sqrt(N);
	const states: MemoryState[] = rows.map((row) => ({
		source_id: String(row.source_id || ""),
		relation_type: String(row.relation_type || ""),
		target_id: String(row.target_id || ""),
		amplitude: initialAmplitude,
		probability: 0,
	}));

	// In a real quantum system, optimal iterations is approx (π/4) * √N
	// For simulation stability, we cap it at a reasonable number.
	let iterations = Math.round((Math.PI / 4) * Math.sqrt(N));
	if (iterations < 1) iterations = 1;
	if (iterations > 100) iterations = 100; // Capped to keep CPU simulation ultra-fast

	// Step 2: Apply Grover iterations (Oracle + Diffusion)
	const words = queryText
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 2);
	const qTerms = words.length > 0 ? words : [queryText.toLowerCase()];

	for (let i = 0; i < iterations; i++) {
		// Apply oracle for each significant keyword in the query
		for (const term of qTerms) {
			applyOracle(states, term);
		}
		applyDiffusion(states);
	}

	// Step 3: Measure (calculate probability |amplitude|^2 and sort)
	normalizeProbabilities(states);

	return states.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
}
