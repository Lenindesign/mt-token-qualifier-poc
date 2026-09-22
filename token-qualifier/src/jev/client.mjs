/**
 * Jev client — TypeSafe AI System One.
 *
 * Jev is the qualification and decision layer for every Class J rule: the
 * checks that need semantic understanding rather than arithmetic. It takes one
 * shared `state` plus a map of independent questions and returns typed answers
 * with calibrated probabilities.
 *
 * Deliberately implemented over plain `fetch` rather than `@typesafe-ai/sdk`,
 * so the whole qualifier stays dependency-free and `npm run tokens:qualify`
 * works before `npm install` has ever run. The SDK equivalent is noted at the
 * bottom of this file.
 *
 * Three modes:
 *   live     — a key is present; questions go to the API
 *   dry-run  — no request is sent; the exact payloads are captured for review,
 *              so the data that WOULD leave can be inspected before approving it
 *   disabled — no key and no dry-run; every Class J rule reports SKIPPED
 *
 * `tokens:check` must stay useful with no network: Class D alone produces a
 * valid blocking report, and Class J degrades to SKIPPED rather than failing
 * the build. A governance gate that fails closed on a third-party outage gets
 * switched off within a week.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_MODEL = 'jev-latest';

/**
 * Answers cache, keyed by a hash of (question id, type, instructions, criteria,
 * state). Token names and values change rarely, so a warm cache makes local
 * runs free and keeps per-PR cost proportional to what actually changed.
 *
 * Editing a question's wording changes its hash, which is deliberate: a report
 * must never mix answers to two different versions of the same question.
 */
export class AnswerCache {
	constructor(path) {
		this.path = path;
		this.data = {};
		this.hits = 0;
		this.misses = 0;
		if (path && existsSync(path)) {
			try {
				this.data = JSON.parse(readFileSync(path, 'utf8'));
			} catch {
				this.data = {};
			}
		}
	}

	static key(question) {
		const payload = JSON.stringify({
			id: question.id,
			type: question.type,
			instructions: question.instructions,
			criteria: question.criteria ?? null,
			state: question.state ?? null,
		});
		return createHash('sha256').update(payload).digest('hex').slice(0, 16);
	}

	get(question) {
		const hit = this.data[AnswerCache.key(question)];
		if (hit) this.hits++;
		else this.misses++;
		return hit ?? null;
	}

	set(question, answer) {
		this.data[AnswerCache.key(question)] = answer;
	}

	flush() {
		if (!this.path) return;
		try {
			writeFileSync(this.path, JSON.stringify(this.data, null, 2));
		} catch {
			/* the cache is an optimisation, never a hard failure */
		}
	}
}

export class JevClient {
	/**
	 * @param {object}  options
	 * @param {boolean|'auto'} options.enabled  'auto' enables when an API key is present
	 * @param {boolean} options.dryRun   capture payloads instead of sending them
	 * @param {string}  options.model
	 * @param {string}  options.cachePath
	 * @param {object}  options.fixtures recorded answers keyed by question id — used by tests
	 */
	constructor({
		enabled = 'auto',
		dryRun = false,
		model = DEFAULT_MODEL,
		cachePath = null,
		fixtures = null,
		apiKey = process.env.TYPESAFE_API_KEY,
		timeoutMs = 20000,
	} = {}) {
		this.fixtures = fixtures;
		this.cache = new AnswerCache(cachePath);
		this.apiKey = apiKey;
		this.model = model;
		this.dryRun = dryRun;
		this.timeoutMs = timeoutMs;

		const wanted = enabled === 'auto' ? Boolean(apiKey) || dryRun : Boolean(enabled);
		this.enabled = wanted && (Boolean(apiKey) || dryRun || Boolean(fixtures));

		this.skipReason = this.enabled
			? null
			: !wanted
				? 'jev.enabled is false in config/qualifier.json'
				: 'TYPESAFE_API_KEY is not set — export a key, or pass --jev-dry-run to inspect the payloads without sending them';

		this.calls = 0;
		this.questionsAsked = 0;
		this.usage = { input_tokens: 0, output_tokens: 0 };
		this.errors = [];
		/**
		 * Circuit breaker. An auth or quota failure is not transient: every
		 * remaining batch will fail identically. Without this, one bad key
		 * produced 61 identical 401s — slow, noisy, and it hammers the API for
		 * no reason. Trip once, then skip the rest of the run cleanly.
		 */
		this.tripped = null;
		/** Captured request payloads, populated in dry-run mode. */
		this.payloads = [];
	}

	/**
	 * Ask a batch of independent questions over one shared state.
	 *
	 * `state` is ONE payload for the whole request, not one per question — that
	 * is the point of batching. The questions run in parallel and cannot see one
	 * another's answers, so nothing here may depend on another answer.
	 *
	 * @param {Array<{id,type,instructions,criteria,state}>} questions
	 * @returns {Promise<Record<string, object|null>>} question id → answer
	 */
	async ask(questions) {
		const answers = {};
		const pending = [];

		for (const q of questions) {
			if (this.fixtures?.[q.id] !== undefined) {
				answers[q.id] = this.fixtures[q.id];
				continue;
			}
			const cached = this.cache.get(q);
			if (cached) {
				answers[q.id] = cached;
				continue;
			}
			answers[q.id] = null;
			pending.push(q);
		}

		if (!this.enabled || !pending.length || this.tripped) return answers;

		const body = this.buildRequest(pending);

		if (this.dryRun) {
			this.payloads.push(body);
			this.questionsAsked += pending.length;
			return answers; // answers stay null → rules report SKIPPED
		}

		let fresh;
		try {
			fresh = await this.callJev(body);
		} catch (error) {
			// A Jev outage must degrade to SKIPPED, never crash the run or block a PR.
			this.errors.push(error.message);
			if (error.fatal) this.tripped = error.message;
			return answers;
		}

		for (const [id, answer] of Object.entries(fresh)) {
			answers[id] = answer;
			const q = pending.find((p) => p.id === id);
			if (q) this.cache.set(q, answer);
		}
		this.cache.flush();
		return answers;
	}

	/**
	 * Build the request body. Every question in a batch shares one state, and
	 * each carries only the fields the API defines for its type:
	 *
	 *   choice — criteria is an object of option → description (max 255 options)
	 *   noul   — criteria is an object with `true` and `false` descriptions
	 *   score  — criteria is an ordered array of 2–10 level descriptions
	 */
	buildRequest(questions) {
		const request = {
			model: this.model,
			state: questions[0].state ?? {},
			questions: Object.fromEntries(
				questions.map((q) => {
					const spec = { type: q.type, instructions: q.instructions };
					if (q.criteria !== undefined && q.criteria !== null) spec.criteria = q.criteria;
					return [q.id, spec];
				}),
			),
		};
		return request;
	}

	/** POST one batch. Retries once on 429 and 5xx; everything else throws. */
	async callJev(body, attempt = 0) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);

		let response;
		try {
			response = await fetch(ENDPOINT, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});
		} catch (error) {
			clearTimeout(timer);
			if (attempt === 0) return this.callJev(body, attempt + 1);
			throw new Error(`Jev request failed: ${error.message}`);
		}
		clearTimeout(timer);

		if ((response.status === 429 || response.status >= 500) && attempt === 0) {
			await new Promise((r) => setTimeout(r, 1200));
			return this.callJev(body, attempt + 1);
		}

		if (!response.ok) {
			const raw = await response.text().catch(() => '');
			let message = raw.slice(0, 300);
			try {
				message = JSON.parse(raw)?.detail?.message ?? message;
			} catch {
				/* keep the raw body */
			}
			const hint =
				response.status === 401
					? ' — set a valid TYPESAFE_API_KEY (get one at https://console.typesafe.ai/keys)'
					: response.status === 403
						? ' — the key is valid but not permitted for this model or endpoint'
						: response.status === 429
							? ' — rate limited or out of quota'
							: '';
			const error = new Error(`Jev ${response.status} ${response.statusText}: ${message}${hint}`);
			// Auth, permission and quota failures will repeat on every batch.
			error.fatal = [401, 402, 403, 429].includes(response.status);
			throw error;
		}

		const payload = await response.json();
		this.calls++;
		this.questionsAsked += Object.keys(body.questions).length;
		if (payload.usage) {
			this.usage.input_tokens += payload.usage.input_tokens ?? 0;
			this.usage.output_tokens += payload.usage.output_tokens ?? 0;
		}
		if (payload.model) this.resolvedModel = payload.model;

		return payload.answers ?? {};
	}

	stats() {
		// A run that answered nothing must say why, whatever the cause. Reporting
		// "enabled" with no answers and no reason is how a broken integration
		// looks exactly like a disabled one.
		const failed = this.tripped ?? (this.errors.length && !this.calls ? this.errors[0] : null);
		return {
			enabled: this.enabled,
			dryRun: this.dryRun,
			model: this.resolvedModel ?? this.model,
			skipReason: this.skipReason ?? failed,
			failed: Boolean(failed),
			calls: this.calls,
			questionsAsked: this.questionsAsked,
			usage: this.usage,
			cacheHits: this.cache.hits,
			cacheMisses: this.cache.misses,
			// Deduplicated: 61 copies of one auth error is noise, not information.
			errors: [...new Set(this.errors)],
			errorCount: this.errors.length,
		};
	}
}

/**
 * Equivalent using the official SDK, if a dependency is ever acceptable:
 *
 *   import { TypeSafeClient, choice, noul, score } from '@typesafe-ai/sdk';
 *   const client = new TypeSafeClient();            // reads TYPESAFE_API_KEY
 *   const build = (q) =>
 *     q.type === 'choice' ? choice(q.instructions, q.criteria)
 *   : q.type === 'noul'   ? noul(q.instructions, q.criteria)
 *   :                       score(q.instructions, q.criteria);
 *   const res = await client.systemOne({
 *     model: 'jev-latest',
 *     state: questions[0].state,
 *     questions: Object.fromEntries(questions.map((q) => [q.id, build(q)])),
 *   });
 *   return res.answers;
 */
