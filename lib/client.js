window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-acp-cursor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/client-contract.ts
		const ACP_SETTINGS_RPC_CHANNEL = "/dsh-acp-cursor";
		const SNAPSHOT_ENDPOINT = "snapshot";
		const SAVE_ENDPOINT = "save";
		const PICK_ENDPOINT = "pick";
		const QUOTA_ENDPOINT = "quota";
		function isRecord$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/** Decode freshly refreshed catalog rows from the host RPC. */
		function decodeCatalogModels(value) {
			if (!Array.isArray(value)) return void 0;
			const models = [];
			for (const item of value) {
				const decoded = decodeCatalogModel(item);
				if (decoded === void 0) return void 0;
				models.push(decoded);
			}
			return models;
		}
		function decodeCatalogModel(value) {
			if (!isRecord$1(value) || typeof value.id !== "string" || typeof value.name !== "string") return void 0;
			const vision = typeof value.vision === "boolean" ? value.vision : void 0;
			const thinking = typeof value.thinking === "boolean" ? value.thinking : void 0;
			const contextWindow = typeof value.contextWindow === "number" && Number.isSafeInteger(value.contextWindow) && value.contextWindow > 0 ? value.contextWindow : void 0;
			const maxOutputTokens = typeof value.maxOutputTokens === "number" && Number.isSafeInteger(value.maxOutputTokens) && value.maxOutputTokens > 0 ? value.maxOutputTokens : void 0;
			return {
				id: value.id,
				name: value.name,
				...Array.isArray(value.nativeIds) && value.nativeIds.every((item) => typeof item === "string") ? { nativeIds: value.nativeIds } : {},
				...vision === void 0 ? {} : { vision },
				...thinking === void 0 ? {} : { thinking },
				...contextWindow === void 0 ? {} : { contextWindow },
				...maxOutputTokens === void 0 ? {} : { maxOutputTokens },
				...isRecord$1(value.reasoning) && Array.isArray(value.reasoning.efforts) ? { reasoning: {
					efforts: value.reasoning.efforts.flatMap((item) => isRecord$1(item) && typeof item.id === "string" && typeof item.name === "string" ? [{
						id: item.id,
						name: item.name
					}] : []),
					...typeof value.reasoning.defaultEffort === "string" ? { defaultEffort: value.reasoning.defaultEffort } : {}
				} } : {},
				...isRecord$1(value.sources) ? { sources: Object.fromEntries(Object.entries(value.sources).filter((entry) => typeof entry[1] === "string")) } : {},
				...isRecord$1(value.overrides) ? { overrides: Object.fromEntries(Object.entries(value.overrides).filter((entry) => entry[1] === true)) } : {}
			};
		}
		function decodeCatalogPersistence(value) {
			if (Array.isArray(value.catalogOrder)) {
				const order = value.catalogOrder.filter((id) => typeof id === "string");
				const overrides = {};
				if (isRecord$1(value.catalogOverrides)) for (const [id, item] of Object.entries(value.catalogOverrides)) {
					const decoded = decodeCatalogModel(item);
					if (decoded !== void 0) overrides[id] = decoded;
				}
				return {
					catalogOrder: order,
					...Object.keys(overrides).length === 0 ? {} : { catalogOverrides: overrides }
				};
			}
			return {};
		}
		/** Decode a Settings snapshot from the host RPC. */
		function decodeSnapshot(value) {
			if (!isRecord$1(value) || value.title !== "External Agents" || !Array.isArray(value.rows)) return void 0;
			const rows = [];
			for (const row of value.rows) {
				if (!isRecord$1(row)) return void 0;
				const modelDiscoveryTimeoutMs = decodeConfig(row)?.modelDiscoveryTimeoutMs;
				if (row.modelDiscoveryTimeoutMs !== void 0 && modelDiscoveryTimeoutMs === void 0) return void 0;
				if (typeof row.provider !== "string" || typeof row.instanceId !== "string" || typeof row.title !== "string") return void 0;
				if (typeof row.enabled !== "boolean" || typeof row.executablePath !== "string" || typeof row.harnessPath !== "string") return void 0;
				if (typeof row.stateDirectory !== "string" || typeof row.installed !== "boolean" || typeof row.authenticated !== "boolean") return void 0;
				if (typeof row.live !== "boolean" || typeof row.ready !== "boolean" || !Array.isArray(row.models)) return void 0;
				const models = [];
				for (const model of row.models) {
					const decoded = decodeCatalogModel(model);
					if (decoded === void 0) return void 0;
					models.push(decoded);
				}
				rows.push({
					provider: row.provider,
					instanceId: row.instanceId,
					title: row.title,
					enabled: row.enabled,
					executablePath: row.executablePath,
					harnessPath: row.harnessPath,
					stateDirectory: row.stateDirectory,
					...typeof row.model === "string" ? { model: row.model } : {},
					...modelDiscoveryTimeoutMs === void 0 ? {} : { modelDiscoveryTimeoutMs },
					models,
					installed: row.installed,
					authenticated: row.authenticated,
					live: row.live,
					ready: row.ready,
					...typeof row.message === "string" ? { message: row.message } : {},
					...typeof row.version === "string" ? { version: row.version } : {},
					...typeof row.profileDirectory === "string" ? { profileDirectory: row.profileDirectory } : {},
					...typeof row.authorizationUrl === "string" ? { authorizationUrl: row.authorizationUrl } : {},
					...typeof row.accountEmail === "string" ? { accountEmail: row.accountEmail } : {},
					...row.probeFailed === true ? { probeFailed: true } : {}
				});
			}
			const install = isRecord$1(value.install) && typeof value.install.phase === "string" && typeof value.install.message === "string" && typeof value.install.downloadedBytes === "number" && typeof value.install.totalBytes === "number" ? {
				phase: value.install.phase,
				downloadedBytes: value.install.downloadedBytes,
				totalBytes: value.install.totalBytes,
				message: value.install.message
			} : void 0;
			return {
				title: "External Agents",
				rows,
				...install === void 0 ? {} : { install },
				...value.signingIn === true ? { signingIn: true } : {}
			};
		}
		/** Decode a persisted Settings document. */
		function decodeConfig(value) {
			if (!isRecord$1(value) || typeof value.executablePath !== "string" || typeof value.harnessPath !== "string") return void 0;
			if (typeof value.stateDirectory !== "string" || typeof value.instanceId !== "string" || value.instanceId.trim() === "") return void 0;
			if (typeof value.enabled !== "boolean") return void 0;
			if (value.modelDiscoveryTimeoutMs !== void 0 && (typeof value.modelDiscoveryTimeoutMs !== "number" || !Number.isInteger(value.modelDiscoveryTimeoutMs) || value.modelDiscoveryTimeoutMs < 1 || value.modelDiscoveryTimeoutMs > 4294967295)) return void 0;
			if (value.model !== void 0 && (typeof value.model !== "string" || value.model.trim() === "")) return void 0;
			const catalog = decodeCatalogPersistence(value);
			return {
				executablePath: value.executablePath,
				harnessPath: value.harnessPath,
				stateDirectory: value.stateDirectory,
				instanceId: value.instanceId.trim(),
				...value.model === void 0 ? {} : { model: value.model.trim() },
				...value.modelDiscoveryTimeoutMs === void 0 ? {} : { modelDiscoveryTimeoutMs: value.modelDiscoveryTimeoutMs },
				enabled: value.enabled,
				...catalog
			};
		}
		function optionalString(record, key) {
			const value = record[key];
			return typeof value === "string" ? value : void 0;
		}
		function decodeQuotaBucket(value) {
			if (!isRecord$1(value)) return void 0;
			const remainingFraction = typeof value.remainingFraction === "number" && Number.isFinite(value.remainingFraction) ? value.remainingFraction : void 0;
			const remainingAmount = typeof value.remainingAmount === "string" || typeof value.remainingAmount === "number" ? String(value.remainingAmount) : void 0;
			const disabled = typeof value.disabled === "boolean" ? value.disabled : void 0;
			const bucketId = optionalString(value, "bucketId");
			const displayName = optionalString(value, "displayName");
			const description = optionalString(value, "description");
			const window = optionalString(value, "window");
			const resetTime = optionalString(value, "resetTime");
			return {
				...bucketId === void 0 ? {} : { bucketId },
				...displayName === void 0 ? {} : { displayName },
				...description === void 0 ? {} : { description },
				...window === void 0 ? {} : { window },
				...remainingFraction === void 0 ? {} : { remainingFraction },
				...remainingAmount === void 0 ? {} : { remainingAmount },
				...disabled === void 0 ? {} : { disabled },
				...resetTime === void 0 ? {} : { resetTime }
			};
		}
		/** Decode a quota snapshot from the host RPC. */
		function decodeQuotaSnapshot(value) {
			if (!isRecord$1(value)) return void 0;
			const status = value.status;
			if (status !== "ready" && status !== "authentication-required" && status !== "not-entitled" && status !== "account-changed" && status !== "error") return void 0;
			if (typeof value.observedAt !== "string" || !Array.isArray(value.groups)) return void 0;
			const groups = [];
			for (const group of value.groups) {
				if (!isRecord$1(group) || !Array.isArray(group.buckets)) return void 0;
				const buckets = [];
				for (const bucket of group.buckets) {
					const decoded = decodeQuotaBucket(bucket);
					if (decoded === void 0) return void 0;
					buckets.push(decoded);
				}
				const displayName = optionalString(group, "displayName");
				const description = optionalString(group, "description");
				groups.push({
					...displayName === void 0 ? {} : { displayName },
					...description === void 0 ? {} : { description },
					buckets
				});
			}
			const tier = isRecord$1(value.tier) ? value.tier : void 0;
			const current = tier === void 0 ? void 0 : optionalString(tier, "current");
			const paid = tier === void 0 ? void 0 : optionalString(tier, "paid");
			const message = optionalString(value, "message");
			return {
				status,
				groups,
				observedAt: value.observedAt,
				...current === void 0 && paid === void 0 ? {} : { tier: {
					...current === void 0 ? {} : { current },
					...paid === void 0 ? {} : { paid }
				} },
				...message === void 0 ? {} : { message }
			};
		}
		//#endregion
		//#region src/decode.ts
		/** Return whether a wire value is a plain JSON object. */
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/** Return a non-empty wire string. */
		function stringValue(value) {
			return typeof value === "string" && value.length > 0 ? value : void 0;
		}
		/** Validate one decoded _meta ownership bag.
		* @param value - The agy.trajectory bag, if present.
		* @returns True for a usable linkage: non-empty ids and a non-negative depth.
		*/
		function isToolOwnership(value) {
			if (!isRecord(value)) return false;
			if (stringValue(value.trajectoryId) === void 0) return false;
			const parent = value.parentTrajectoryId;
			if (parent !== void 0 && stringValue(parent) === void 0) return false;
			const depth = value.depth;
			return depth === void 0 || typeof depth === "number" && Number.isSafeInteger(depth) && depth >= 0;
		}
		/**
		* Fold one tool event in ascending session-log order.
		* @param state - Current row state, if its start is already loaded.
		* @param event - Next event for this row; agent-observed descriptors fold independently.
		* @returns The new row state.
		*/
		function foldCursorAgentToolEvent(state, event) {
			if (event.type !== "cursor-agent/tool-start" && event.type !== "cursor-agent/tool-update") throw new Error("CursorAgent activity is not a tool row event");
			if (event.type === "cursor-agent/tool-start") {
				if (state !== void 0) throw new Error("CursorAgent tool start repeats toolId " + state.toolId);
				return event.data;
			}
			if (state === void 0) return {
				toolId: event.data.toolId,
				name: event.data.name ?? "native tool",
				status: event.data.status,
				...event.data.ownership === void 0 ? {} : { ownership: event.data.ownership },
				...event.data.location === void 0 ? {} : { location: event.data.location },
				...event.data.input === void 0 ? {} : { input: event.data.input },
				...event.data.output === void 0 ? {} : { output: event.data.output },
				...event.data.error === void 0 ? {} : { error: event.data.error }
			};
			if (event.data.toolId !== state.toolId) throw new Error("CursorAgent tool update carries foreign toolId " + event.data.toolId);
			return {
				...state,
				...event.data.name === void 0 ? {} : { name: event.data.name },
				status: event.data.status,
				...event.data.ownership === void 0 ? {} : { ownership: event.data.ownership },
				...event.data.location === void 0 ? {} : { location: event.data.location },
				...event.data.input === void 0 ? {} : { input: event.data.input },
				...event.data.output === void 0 ? {} : { output: event.data.output },
				...event.data.error === void 0 ? {} : { error: event.data.error }
			};
		}
		//#endregion
		//#region src/activity-contract.ts
		/** Settings-channel endpoint returning one session history. */
		const ACTIVITY_ENDPOINT = "activity/read";
		/** Settings-channel endpoint returning the native binding for one session. */
		const ACTIVITY_BINDING_ENDPOINT = "activity/binding";
		/** Decode a history snapshot, throwing on any invalid version or record.
		* @param value - Wire snapshot claiming { version, records }.
		* @returns The validated history.
		*/
		function decodeActivityHistory(value) {
			if (!isRecord(value)) throw corrupt("history is not an object");
			if (value.version !== 1) throw corrupt("history has an unknown version");
			if (!Array.isArray(value.records)) throw corrupt("history has invalid records");
			return {
				version: 1,
				records: value.records.map((record, index) => decodeRecordValue(withVersion(record, index + 1), index + 1))
			};
		}
		function withVersion(record, seq) {
			if (!isRecord(record)) throw corrupt("line " + String(seq) + " is not an object");
			return {
				...record,
				v: 1
			};
		}
		function corrupt(reason) {
			return /* @__PURE__ */ new Error("CursorAgent activity history is corrupt: " + reason);
		}
		function decodeRecordValue(value, seq) {
			if (!isRecord(value)) throw corrupt("line " + String(seq) + " is not an object");
			if (value.v !== 1) throw corrupt("line " + String(seq) + " has an unknown version");
			if (value.seq !== seq) throw corrupt("line " + String(seq) + " breaks the sequence");
			const time = value.time;
			if (typeof time !== "string" || Number.isNaN(Date.parse(time))) throw corrupt("line " + String(seq) + " has an invalid time");
			const type = value.type;
			if (type === "cursor-agent/usage-snapshots") value.data;
			if (type === "cursor-agent/request-telemetry") value.data;
			if (type === "cursor-agent/full-access-authorized" && isRecord(value.data) && stringValue(value.data.provider) !== void 0 && stringValue(value.data.session) !== void 0 && value.data.mode === "full-access" && (value.data.auditId === void 0 || stringValue(value.data.auditId) !== void 0)) return {
				seq,
				time,
				type,
				data: value.data
			};
			if (type === "cursor-agent/session-ready" && isSessionReadyData(value.data)) return {
				seq,
				time,
				type,
				data: value.data
			};
			if (type === "cursor-agent/tool-start" && isToolStartData(value.data)) return {
				seq,
				time,
				type,
				data: value.data
			};
			if (type === "cursor-agent/tool-update" && isToolUpdateData(value.data)) return {
				seq,
				time,
				type,
				data: value.data
			};
			if (type === "cursor-agent/agent-observed" && isToolOwnership(value.data)) return {
				seq,
				time,
				type,
				data: value.data
			};
			if (type === "cursor-agent/agent-text" && isAgentTextData(value.data)) return {
				seq,
				time,
				type,
				data: value.data
			};
			if (type === "cursor-agent/user-question-answer" && isUserQuestionAnswerData(value.data)) return {
				seq,
				time,
				type,
				data: value.data
			};
			throw corrupt("line " + String(seq) + " has an unknown type or data");
		}
		function isUserQuestionAnswerData(value) {
			if (!isRecord(value) || stringValue(value.requestId) === void 0 || typeof value.question !== "string") return false;
			if (!Array.isArray(value.selected) || value.selected.some((item) => typeof item !== "string")) return false;
			return value.custom === void 0 || typeof value.custom === "string";
		}
		function isAgentTextData(value) {
			if (!isRecord(value) || stringValue(value.trajectoryId) === void 0) return false;
			if (value.parentTrajectoryId !== void 0 && stringValue(value.parentTrajectoryId) === void 0) return false;
			if (value.kind !== "text" && value.kind !== "thought") return false;
			return typeof value.text === "string" && value.text.length > 0;
		}
		function isSessionReadyData(value) {
			if (!isRecord(value) || value.provider !== "cursor-agent") return false;
			if (value.ref === void 0) return true;
			const ref = value.ref;
			if (!isRecord(ref) || ref.provider !== value.provider || stringValue(ref.provider) === void 0 || stringValue(ref.session) === void 0 || ref.nativeSession !== void 0 && stringValue(ref.nativeSession) === void 0) return false;
			const cursor = ref.resumeCursor;
			return cursor === void 0 || isRecord(cursor) && cursor.provider === ref.provider && stringValue(cursor.value) !== void 0;
		}
		function isToolStatus(value) {
			return value === "pending" || value === "running" || value === "completed" || value === "failed";
		}
		function isToolLocation(value) {
			return isRecord(value) && stringValue(value.target) !== void 0 && (value.kind === "file" || value.kind === "url");
		}
		function isToolStartData(value) {
			if (!isRecord(value)) return false;
			if (stringValue(value.toolId) === void 0 || stringValue(value.name) === void 0) return false;
			if (!isToolStatus(value.status)) return false;
			if (value.input !== void 0 && typeof value.input !== "string") return false;
			if (value.location !== void 0 && !isToolLocation(value.location)) return false;
			return value.ownership === void 0 || isToolOwnership(value.ownership);
		}
		function isToolUpdateData(value) {
			if (!isRecord(value)) return false;
			if (stringValue(value.toolId) === void 0 || !isToolStatus(value.status)) return false;
			if (value.name !== void 0 && stringValue(value.name) === void 0) return false;
			if (value.input !== void 0 && typeof value.input !== "string") return false;
			if (value.location !== void 0 && !isToolLocation(value.location)) return false;
			if (value.output !== void 0 && typeof value.output !== "string") return false;
			if (value.error !== void 0 && typeof value.error !== "string") return false;
			return value.ownership === void 0 || isToolOwnership(value.ownership);
		}
		//#endregion
		//#region src/web/native-activity.ts
		/** Fold plugin-owned native tool history into transcript rows.
		*
		* Pure browser-safe fold over the activity/read sidecar: one row per native
		* tool launch, oldest first. A launch completion (or failure) is the launch
		* tool's own outcome; it never claims a child outcome, and no row is ever
		* inferred from thought text. Reuses the canonical fold, so display state
		* cannot drift from durable state.
		*/
		/** Fold first observations independently of tool launches, including zero-tool children.
		* @param records - Decoded sidecar history in sequence order.
		* @returns Agent observations scoped to native runtime epochs.
		*/
		function foldAgentRecords(records) {
			const agents = /* @__PURE__ */ new Map();
			let epoch = 0;
			for (const record of records) {
				if (record.type === "cursor-agent/session-ready") {
					epoch += 1;
					continue;
				}
				if (record.type !== "cursor-agent/agent-observed") continue;
				const key = `${epoch}\n${record.data.trajectoryId}`;
				if (!agents.has(key)) agents.set(key, {
					key: String(record.seq),
					epoch,
					firstSeenAt: record.time,
					ownership: record.data
				});
			}
			return [...agents.values()];
		}
		/** Fold sidecar thought/text records in sequence order, coalescing adjacent
		* same-kind deltas on one trajectory.
		* @param records - Decoded sidecar history.
		* @returns Text rows scoped to native runtime epochs.
		*/
		function foldAgentTextRecords(records) {
			const rows = [];
			let epoch = 0;
			for (const record of records) {
				if (record.type === "cursor-agent/session-ready") {
					epoch += 1;
					continue;
				}
				if (record.type !== "cursor-agent/agent-text") continue;
				const last = rows.at(-1);
				if (last !== void 0 && last.epoch === epoch && last.kind === record.data.kind && last.trajectoryId === record.data.trajectoryId && last.parentTrajectoryId === record.data.parentTrajectoryId) {
					last.text += record.data.text;
					continue;
				}
				rows.push({
					key: String(record.seq),
					epoch,
					firstSeenAt: record.time,
					trajectoryId: record.data.trajectoryId,
					...record.data.parentTrajectoryId === void 0 ? {} : { parentTrajectoryId: record.data.parentTrajectoryId },
					kind: record.data.kind,
					text: record.data.text
				});
			}
			return rows;
		}
		/** Fold history records into display rows, oldest first.
		* Native tool ids can repeat across startups: the (epoch, tool id) pair only
		* routes updates, while every new row keys on its record seq, so ids
		* containing newlines can never collide.
		* @param records - Decoded history records in seq order.
		* @returns Display rows, oldest first, keyed by record seq.
		*/
		function foldActivityRecords(records) {
			const rows = [];
			const indexById = /* @__PURE__ */ new Map();
			let epoch = 0;
			for (const record of records) {
				if (record.type === "cursor-agent/session-ready") {
					epoch += 1;
					continue;
				}
				if (record.type === "cursor-agent/agent-observed" || record.type === "cursor-agent/agent-text" || record.type === "cursor-agent/user-question-answer" || record.type === "cursor-agent/full-access-authorized" || record.type === "cursor-agent/request-telemetry" || record.type === "cursor-agent/usage-snapshots") continue;
				const id = String(epoch) + "\n" + record.data.toolId;
				if (record.type === "cursor-agent/tool-start") {
					indexById.set(id, rows.length);
					rows.push({
						key: String(record.seq),
						epoch,
						state: record.data,
						time: record.time,
						firstSeenAt: record.time
					});
					continue;
				}
				const index = indexById.get(id);
				if (index === void 0) {
					indexById.set(id, rows.length);
					rows.push({
						key: String(record.seq),
						epoch,
						state: foldCursorAgentToolEvent(void 0, {
							type: record.type,
							data: record.data
						}),
						time: record.time,
						firstSeenAt: record.time
					});
					continue;
				}
				const current = rows[index];
				if (current === void 0) continue;
				current.state = foldCursorAgentToolEvent(current.state, {
					type: record.type,
					data: record.data
				});
				current.time = record.time;
			}
			return rows.filter((row) => row.state.status !== "pending" || row.state.ownership !== void 0);
		}
		/** Read one session history over RPC and fold it into rows.
		* Throws fail-closed on transport failure or corrupt history; aborts
		* propagate so the caller can drop stale generations.
		* @param rpc - Logical-channel RPC face.
		* @param sessionId - DSH session scoping the sidecar read.
		* @param signal - Caller cancellation for a superseded session or unmount.
		* @returns Folded tools and observed agents for this session only.
		*/
		async function loadActivityHistory(rpc, sessionId, signal) {
			const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, ACTIVITY_ENDPOINT, { sessionId }, signal);
			if (!result.ok) throw new Error(result.error?.message ?? "CursorAgent activity history is unavailable");
			const { records } = decodeActivityHistory(result.value);
			return {
				rows: foldActivityRecords(records),
				agents: foldAgentRecords(records),
				texts: foldAgentTextRecords(records)
			};
		}
		/** Poll interval for the session-scoped native history subscription. */
		const NATIVE_HISTORY_POLL_MS = 1e3;
		/** One entry per live connection and session: keying by the RPC face keeps
		* concurrent connections from sharing or resurrecting each other's history.
		* Entries are lightweight once unsubscribed (empty snapshot, no timer), so
		* React StrictMode remounts reuse them without holding full histories.
		*/
		const nativeHistoryStores = /* @__PURE__ */ new WeakMap();
		function entryFor(rpc, sessionId) {
			let bySession = nativeHistoryStores.get(rpc);
			if (bySession === void 0) {
				bySession = /* @__PURE__ */ new Map();
				nativeHistoryStores.set(rpc, bySession);
			}
			let entry = bySession.get(sessionId);
			if (entry === void 0) {
				entry = {
					snapshot: {
						rows: [],
						agents: [],
						texts: []
					},
					listeners: /* @__PURE__ */ new Set(),
					timer: void 0,
					controller: void 0
				};
				bySession.set(sessionId, entry);
			}
			return entry;
		}
		function notifyEntry(entry) {
			for (const listener of [...entry.listeners]) listener();
		}
		async function pollNativeHistory(sessionId, entry, rpc) {
			if (entry.controller !== void 0 || entry.listeners.size === 0) return;
			const controller = new AbortController();
			entry.controller = controller;
			try {
				const snapshot = await loadActivityHistory(rpc, sessionId, controller.signal);
				if (entry.controller !== controller) return;
				entry.snapshot = snapshot;
			} catch (caught) {
				if (entry.controller !== controller) return;
				const message = caught instanceof Error ? caught.message : "CursorAgent activity history is unavailable";
				entry.snapshot = {
					...entry.snapshot,
					error: message
				};
			} finally {
				if (entry.controller !== controller) return;
				entry.controller = void 0;
			}
			notifyEntry(entry);
			scheduleNativeHistory(sessionId, entry, rpc);
		}
		function scheduleNativeHistory(sessionId, entry, rpc) {
			if (entry.listeners.size === 0) return;
			if (entry.timer !== void 0) return;
			entry.timer = setTimeout(() => {
				entry.timer = void 0;
				pollNativeHistory(sessionId, entry, rpc);
			}, NATIVE_HISTORY_POLL_MS);
		}
		/** Session-scoped abortable subscription over native history: one poll loop
		* per connection and session no matter how many turn containers mount, so
		* trailing records after a turn ends still arrive while any native view stays
		* mounted. Late tool updates never move rows (partition keys on firstSeenAt).
		* Refresh and resubscribe cancel the active read and start a new one, so a
		* superseded promise can never stall the loop. No new framework dependency:
		* plain subscribe/getSnapshot for useSyncExternalStore.
		* @param rpc - Logical-channel RPC face scoping the store lifetime.
		* @param sessionId - DSH session scoping the sidecar read.
		* @returns Shared subscribe/getSnapshot/refresh triple.
		*/
		function getNativeHistoryStore(rpc, sessionId) {
			const entry = entryFor(rpc, sessionId);
			return {
				subscribe: (listener) => {
					entry.listeners.add(listener);
					if (entry.listeners.size === 1) pollNativeHistory(sessionId, entry, rpc);
					else scheduleNativeHistory(sessionId, entry, rpc);
					return () => {
						entry.listeners.delete(listener);
						if (entry.listeners.size === 0) {
							if (entry.timer !== void 0) {
								clearTimeout(entry.timer);
								entry.timer = void 0;
							}
							entry.controller?.abort();
							entry.controller = void 0;
							entry.snapshot = {
								rows: [],
								agents: [],
								texts: []
							};
						}
					};
				},
				getSnapshot: () => entry.snapshot,
				refresh: () => {
					entry.controller?.abort();
					entry.controller = void 0;
					if (entry.timer !== void 0) {
						clearTimeout(entry.timer);
						entry.timer = void 0;
					}
					if (entry.listeners.size > 0) pollNativeHistory(sessionId, entry, rpc);
				}
			};
		}
		//#endregion
		//#region src/web/native-turn.ts
		/** Folded row definition registered on the Chat conversation target. */
		let openNativeTurn;
		function turnOf(event) {
			if (event.type === "user/message") return event.data?.source?.kind === "plugin" ? openNativeTurn : void 0;
			const turn = event.data?.turn;
			if (typeof turn === "number" && Number.isSafeInteger(turn) && turn >= 1) return turn;
		}
		const nativeTurnDefinition = {
			kind: "cursor-agent-native",
			target: "chat",
			match: (event) => {
				const turn = turnOf(event);
				if (turn === void 0) return null;
				const id = String(turn);
				if (event.type === "turn/start") return {
					id,
					role: "start"
				};
				if (event.type === "turn/end" || event.type === "step/start" || event.type === "step/end" || event.type === "system/message" || event.type === "user/message" || event.type === "assistant/live-chunk" || event.type === "assistant/chunk" || event.type === "assistant/message") return {
					id,
					role: "update"
				};
				return null;
			},
			start: (context, match) => {
				if (match.event.type !== "turn/start") throw new Error("CursorAgent native turn starts on turn/start");
				const turn = turnOf(match.event);
				if (turn === void 0) throw new Error("CursorAgent native turn starts on turn/start");
				openNativeTurn = turn;
				return {
					turn,
					startMs: match.event.time,
					endMs: null
				};
			},
			update: (context, match) => {
				if (match.event.type !== "turn/end") return context.state;
				if (openNativeTurn === context.state.turn) openNativeTurn = void 0;
				return {
					...context.state,
					endMs: match.event.time
				};
			},
			publication: () => "immediate",
			buildViewNode: (context) => {
				if (context.state === void 0) return null;
				return {
					key: context.key,
					kind: "cursor-agent-native",
					id: context.id,
					target: "chat",
					anchorSeq: anchorOf(context),
					location: context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" },
					visibility: "visible",
					data: context.state
				};
			}
		};
		/** Next loaded turn start after the current turn, or null when current is last/unknown.
		* @param orderedStarts - Loaded turn starts in timeline order.
		* @param currentTurn - Turn number owning the querying container.
		* @returns Next start wall clock, or null.
		*/
		function nextStartMs(orderedStarts, currentTurn) {
			const index = orderedStarts.findIndex((item) => item.turn === currentTurn);
			if (index < 0) return null;
			return orderedStarts[index + 1]?.startMs ?? null;
		}
		/** Whether a row is owned by its turn's actual Core window (vs recorded between turns).
		* @param firstSeenMs - Row firstSeenAt wall clock.
		* @param startMs - Owning turn/start wall clock.
		* @param endMs - Owning turn/end wall clock, or null for the open turn.
		* @returns True when the row falls inside Core [start, end).
		*/
		function isOwnedByTurn(firstSeenMs, startMs, endMs) {
			if (!Number.isFinite(firstSeenMs) || !Number.isFinite(startMs)) return false;
			if (firstSeenMs < startMs) return false;
			return endMs === null || firstSeenMs < endMs;
		}
		/** Rows partitioned to one turn by loaded starts, oldest first.
		* Later tool updates do not move a row into another turn (callers pass
		* firstSeenAt-derived rows). The earliest loaded turn may include earlier
		* records (explicitly unassigned); each following turn takes
		* [start, nextStart); the last turn is unbounded to now. Gaps and trailing
		* records therefore never vanish, and loading the next turn re-partitions
		* without duplicates.
		* @param rows - Folded session rows in seq order.
		* @param startMs - Owning turn/start wall clock.
		* @param nextStartMsValue - Next loaded turn/start wall clock, or null for last/unknown.
		* @param nowMs - Now for the open-ended window; defaults to the wall clock.
		* @param includeEarlier - True for the earliest loaded turn: include records before startMs.
		* @returns The owning turn's rows.
		*/
		function rowsForTurnWindow(rows, startMs, nextStartMsValue, nowMs = Date.now(), includeEarlier = false) {
			return rows.filter((row) => {
				const ms = Date.parse(row.firstSeenAt);
				if (!Number.isFinite(ms)) return false;
				if (!includeEarlier && ms < startMs) return false;
				if (nextStartMsValue !== null) return ms < nextStartMsValue;
				return ms <= nowMs;
			});
		}
		function anchorOf(context) {
			let seq = context.start?.event.seq;
			let chunk;
			let step;
			let after = Number.NEGATIVE_INFINITY;
			for (const match of context.matches) {
				const next = match.event.seq;
				if (typeof next !== "number" || !Number.isFinite(next)) continue;
				if ((match.event.type === "assistant/live-chunk" || match.event.type === "assistant/chunk") && chunk === void 0) chunk = next;
				else if (match.event.type === "step/start" && step === void 0) step = next;
				if (match.event.type === "system/message" || match.event.type === "user/message") after = Math.max(after, next);
			}
			const chosen = chunk ?? step ?? seq;
			const base = typeof chosen === "number" && Number.isFinite(chosen) ? chosen : 0;
			return after > base ? after + .001 : base;
		}
		//#endregion
		//#region src/web/native-tree.ts
		/** Whether a grouped branch still has pending/running native work. */
		function activityBranchRunning(branch) {
			if (branch.kind === "tool") return branch.row.state.status === "pending" || branch.row.state.status === "running";
			if (branch.kind === "text") return false;
			return branch.running;
		}
		/** Group child tools exactly once by native trajectory within a runtime epoch.
		* Missing or conflicting ancestry stays at the root; cycles are cut without losing rows.
		* @param rows - Folded native activity in first-seen order.
		* @param observations - First child sightings, including agents that emit no tools.
		* @returns Ordered root tools and recursively nested, independent child trajectories.
		*/
		function groupNativeActivity(rows, _observations = [], texts = []) {
			const branches = rows.map((row, index) => ({
				kind: "tool",
				key: row.key,
				row,
				order: Number(row.key) || index
			}));
			for (const text of texts) {
				if (text.parentTrajectoryId !== void 0) continue;
				branches.push({
					kind: "text",
					key: text.key,
					text: text.text,
					thought: text.kind === "thought",
					order: Number(text.key) || 0,
					firstSeenAt: text.firstSeenAt
				});
			}
			branches.sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
			return branches;
		}
		//#endregion
		//#region src/web/CursorAgentReadonlyCard.tsx
		const TITLE_KEYS = {
			read: "tool.title.read",
			bash: "tool.title.bash",
			grep: "tool.title.search",
			glob: "tool.title.search",
			web_search: "tool.title.search",
			web_fetch: "tool.title.search",
			write: "tool.title.write",
			edit: "tool.title.edit"
		};
		const sep = " · ";
		function CursorAgentReadonlyCard({ callId, toolName, nativeName, summary, block, t, conversationT }) {
			const [open, setOpen] = (0, react.useState)(false);
			let rowState = "running";
			let args = "";
			let result;
			if ("kind" in block) {
				rowState = block.isError ? "error" : "ok";
				args = block.call?.argsRaw ?? "";
				result = block.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("");
			} else args = block.argsRaw;
			const title = titleOf(toolName, conversationT);
			const expandable = args !== "" || result !== void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				"data-native-tool-card": callId,
				"data-state": rowState,
				title: nativeName !== "" && nativeName !== toolName && nativeName !== title ? nativeName : title,
				"aria-label": title + (summary === "" ? "" : sep + summary),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					icon: iconOf(toolName),
					title,
					open,
					expandable,
					expandOnRowClick: true,
					keepContentWhenOpen: true,
					onToggle: () => {
						setOpen((value) => !value);
					},
					collapsedContent: summary === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"data-card-summary": summary,
						style: {
							minWidth: 0,
							overflow: "hidden",
							color: "var(--dsw-alias-label-tertiary)",
							fontSize: 14,
							lineHeight: "24px",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap"
						},
						children: sep + summary
					}),
					children: [args === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PayloadBlock, {
						label: t("activityInput"),
						text: pretty(args),
						filename: "input.json",
						t
					}), result === void 0 ? null : result === "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-card-empty-result": true,
						style: {
							color: "var(--dsw-alias-label-tertiary)",
							fontSize: 13
						},
						children: t("activityNoOutput")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-card-result": rowState === "error" ? "error" : "ok",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PayloadBlock, {
							label: t("activityOutput"),
							text: pretty(result),
							filename: "output.txt",
							t
						})
					})]
				})
			});
		}
		function titleOf(toolName, conversationT) {
			const key = TITLE_KEYS[toolName];
			return key === void 0 ? conversationT("tool.title.generic") : conversationT(key);
		}
		function iconOf(toolName) {
			switch (toolName) {
				case "read": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutline16, { size: 14 });
				case "grep":
				case "glob":
				case "web_search": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 14 });
				case "bash": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutline14, { size: 14 });
				case "write":
				case "edit": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 });
				case "web_fetch": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutline14, { size: 14 });
				default: return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 14 });
			}
		}
		const banner = {
			display: "flex",
			alignItems: "center",
			gap: 12,
			width: "100%",
			boxSizing: "border-box",
			padding: "9px 14px"
		};
		const actions$1 = {
			display: "flex",
			marginLeft: "auto",
			flexShrink: 0,
			gap: 8
		};
		const ghost = {
			background: "transparent",
			border: 0,
			padding: 0,
			cursor: "pointer",
			color: "var(--dsw-alias-label-secondary)",
			font: "11px/18px var(--dsw-font-family)"
		};
		function PayloadBlock({ label, text, filename, t }) {
			const [copied, setCopied] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-native-payload": label,
				style: {
					width: "100%",
					minWidth: 0,
					borderRadius: 12,
					background: "var(--dsw-alias-markdown-code-block)"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: banner,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							minWidth: 0,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap"
						},
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						"data-native-payload-actions": true,
						style: actions$1,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							"data-native-copy": true,
							style: ghost,
							onClick: () => {
								(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(text).then((ok) => {
									if (!ok) return;
									setCopied(true);
									window.setTimeout(() => {
										setCopied(false);
									}, 1e3);
								});
							},
							children: copied ? t("markdownCopied") : t("markdownCopy")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							"data-native-download": true,
							style: ghost,
							onClick: () => {
								downloadText(filename, text);
							},
							children: t("activityDownload")
						})]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					style: {
						margin: 0,
						padding: "0 14px 14px",
						overflow: "auto",
						maxHeight: 240,
						font: "var(--dsw-font-markdown-code-block)"
					},
					children: text
				})]
			});
		}
		function pretty(text) {
			try {
				return JSON.stringify(JSON.parse(text), null, 2);
			} catch {
				return text;
			}
		}
		function downloadText(filename, text) {
			const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.rel = "noopener";
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 0);
		}
		//#endregion
		//#region src/web/native-tool-card.ts
		/** Folded native title to canonical wire name. Prefixes, a small command regex,
		* and a command/cmd arg fill gaps Cursor leaves as "Read /path" / raw git lines.
		* Anything else stays verbatim. */
		const NATIVE_TOOL_NAMES = {
			"run command": "bash",
			"view file": "read",
			"read file": "read",
			"fetch page": "web_fetch",
			fetch: "web_fetch",
			search: "web_search",
			grep: "grep",
			glob: "glob",
			"write file": "write",
			"edit file": "edit"
		};
		/** Native argument aliases to canonical DSH argument keys, each verified
		* against the card models that read them: command feeds the terminal shell
		* call, file_path is what the read model requires (path alone never
		* qualifies), url feeds web_fetch and renders as summary text without result
		* metadata. Unknown keys survive verbatim. */
		const ARG_KEY_ALIASES = {
			CommandLine: "command",
			commandLine: "command",
			command_line: "command",
			AbsolutePath: "file_path",
			URL: "url",
			uri: "url"
		};
		/** Path-ish keys a location fallback must not override. */
		const PATH_KEYS = [
			"path",
			"file_path",
			"directory_path"
		];
		function foldName(name) {
			return name.trim().replace(/[_-]+/gu, " ").replace(/\s+/gu, " ").toLowerCase();
		}
		function aliasArgs(parsed) {
			if (parsed === void 0) return void 0;
			const args = {};
			for (const [key, value] of Object.entries(parsed)) {
				const canonical = ARG_KEY_ALIASES[key] ?? key;
				if (args[canonical] === void 0) args[canonical] = value;
			}
			return args;
		}
		function parseRecord(raw) {
			try {
				const value = JSON.parse(raw);
				return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
			} catch {
				return;
			}
		}
		/**
		* Map a recorded native tool name to its canonical DSH wire name.
		* Table, title prefixes, a small command regex, then command/cmd args.
		* Unknown names stay verbatim.
		*/
		function nativeToolName(name, input) {
			const folded = foldName(name.startsWith("Running ") ? name.slice(8) : name);
			const known = NATIVE_TOOL_NAMES[folded];
			if (known !== void 0) return known;
			if (folded === "grep" || folded.startsWith("grep ") || folded === "find" || folded.startsWith("find ")) return "grep";
			if (folded === "glob" || folded.startsWith("glob ")) return "glob";
			if (folded === "read" || folded.startsWith("read ") || folded.startsWith("read/")) return "read";
			if (folded === "shell" || folded === "terminal" || folded === "command") return "bash";
			if (folded.startsWith("web fetch") || folded.startsWith("fetch ")) return "web_fetch";
			if (folded.startsWith("search ")) return "web_search";
			if (/^(git|echo|ls|cat|npm|pnpm|yarn|python|node|curl|bash|sh)(\s|$)/u.test(folded) || folded.includes(" && ")) return "bash";
			const parsed = input === void 0 ? void 0 : parseRecord(input);
			if (parsed !== void 0 && (typeof parsed.command === "string" || typeof parsed.cmd === "string")) return "bash";
			return name;
		}
		const SUMMARY_KEYS = [
			"command",
			"file_path",
			"path",
			"pattern",
			"glob",
			"query",
			"url",
			"directory_path"
		];
		/** One-line ToolRow summary: canonical args, then location, then the ACP title remainder. */
		function nativeToolSummary(state, toolName) {
			const aliased = state.input === void 0 ? void 0 : aliasArgs(parseRecord(state.input));
			if (aliased !== void 0) for (const key of SUMMARY_KEYS) {
				const value = aliased[key];
				if (typeof value === "string" && value !== "") return value;
			}
			if (state.location !== void 0) return state.location.target;
			const core = state.name.startsWith("Running ") ? state.name.slice(8) : state.name;
			if (toolName === "read") return core.replace(/^Read\s+/u, "").replace(/^read\s+/u, "");
			if (toolName === "grep" || toolName === "glob") return core.replace(/^Find\s+/u, "").replace(/^find\s+/u, "").replace(/^[`']|['`]$/gu, "");
			return core;
		}
		/**
		* Build the canonical args JSON for one folded row. Known native keys move to
		* their canonical slots; every other key survives verbatim, so unknowns keep
		* their data. A sidecar location fills a missing path/url on a structured
		* args object only: raw non-JSON input passes through untouched (the generic
		* summary and body read it verbatim), and then a location has no canonical
		* slot — the output text still carries the readable result.
		* @param state - folded native row state.
		* @returns argsRaw for the presentation block: canonical JSON or raw input.
		*/
		function nativeToolArgs(state) {
			if (state.input === void 0) {
				if (state.location === void 0) return "";
				return JSON.stringify(state.location.kind === "file" ? { path: state.location.target } : { url: state.location.target });
			}
			const parsed = parseRecord(state.input);
			if (parsed === void 0) return state.input;
			const args = aliasArgs(parsed) ?? {};
			const location = state.location;
			if (location !== void 0) {
				if (location.kind === "file" && !PATH_KEYS.some((key) => typeof args[key] === "string" && args[key] !== "")) args.path = location.target;
				if (location.kind === "url" && typeof args.url !== "string") args.url = location.target;
			}
			return JSON.stringify(args);
		}
		/**
		* Build presentation props for one folded row: the normalized wire name plus a
		* running block while pending/running, or a settled block honoring the actual
		* outcome (failed settles isError, completed does not). The verbatim native
		* name is the card title attribute when the canonical label renames it.
		* No result metadata is ever synthesized, so rich cards trigger only off
		* genuine canonical arguments.
		* @param state - folded native row state.
		* @param timeMs - row wall clock for the block timestamps; defaults to 0.
		* @returns wire name, verbatim native name and tool id, and the presentation-only block.
		*/
		function nativeToolBlock(state, timeMs = 0) {
			const toolName = nativeToolName(state.name, state.input);
			const argsRaw = nativeToolArgs(state);
			const callId = state.toolId;
			if (state.status !== "completed" && state.status !== "failed") return {
				toolName,
				nativeName: state.name,
				callId,
				block: {
					callId,
					name: toolName,
					argsRaw,
					turn: 0,
					step: 0,
					time: timeMs,
					subCalls: []
				}
			};
			const text = state.status === "failed" ? state.error ?? state.output ?? "" : state.output ?? state.error ?? "";
			return {
				toolName,
				nativeName: state.name,
				callId,
				block: {
					kind: "tool-result",
					seq: 0,
					time: timeMs,
					callId,
					call: {
						name: toolName,
						argsRaw
					},
					callTime: null,
					content: text === "" ? [] : [{
						type: "text",
						text
					}],
					isError: state.status === "failed",
					subCalls: []
				}
			};
		}
		//#endregion
		//#region src/web/CursorAgentToolNode.tsx
		function CursorAgentToolNode({ row, t, conversationT }) {
			const parsed = Date.parse(row.firstSeenAt);
			const { toolName, nativeName, callId, block } = nativeToolBlock(row.state, Number.isFinite(parsed) ? parsed : 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CursorAgentReadonlyCard, {
				callId,
				toolName,
				nativeName,
				summary: nativeToolSummary(row.state, toolName),
				block,
				t,
				conversationT
			});
		}
		//#endregion
		//#region src/web/NativeActivityNode.tsx
		/** Display native child trajectories using the shared DSH disclosure chrome. */
		const SWEEP = `@keyframes dsh-agy-subagent-sweep {
  0% { left: -300px; }
  90%, 100% { left: 100%; }
}
[data-native-subagent-panel][data-state="running"] [data-disclosure-row] {
  position: relative;
  overflow: hidden;
}
[data-native-subagent-panel][data-state="running"] [data-disclosure-row]::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 300px;
  background: linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-bg-base) 60%, transparent) 55%, transparent 100%);
  animation: dsh-agy-subagent-sweep 2.6s ease-out infinite;
  pointer-events: none;
}`;
		function ThoughtRow({ branch, ...labels }) {
			const [open, setOpen] = (0, react.useState)(false);
			const summary = branch.text.trim().split(String.fromCharCode(10))[0] ?? "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				"data-native-agent-text": branch.key,
				"data-native-thought": "",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkle16, { size: 14 }),
					title: labels.t("activityThink"),
					open,
					expandable: branch.text.length > 0,
					expandOnRowClick: true,
					keepContentWhenOpen: true,
					onToggle: () => {
						setOpen((value) => !value);
					},
					collapsedContent: summary === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							minWidth: 0,
							overflow: "hidden",
							color: "var(--dsw-alias-label-tertiary)",
							fontSize: 14,
							lineHeight: "24px",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap"
						},
						children: " · " + summary
					}),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							whiteSpace: "pre-wrap",
							color: "var(--dsw-alias-label-secondary)",
							fontSize: "var(--dsh-content-font-size-secondary, 13px)"
						},
						children: branch.text
					})
				})
			});
		}
		function NativeSubagentNode({ branch, ...labels }) {
			const [open, setOpen] = (0, react.useState)(false);
			const shortId = branch.trajectoryId.replace(/-/g, "").slice(0, 8);
			const running = activityBranchRunning(branch);
			const status = running ? labels.t("activityRunning").replace("{count}", String(Math.max(branch.toolCount, 1))) : branch.toolCount === 0 ? labels.t("activityChildEmpty") : labels.t("activityTools").replace("{count}", String(branch.toolCount));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"data-native-subagent": branch.key,
				"data-native-trajectory": branch.trajectoryId,
				"data-native-subagent-panel": "",
				"data-state": running ? "running" : void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: SWEEP }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutline16, { size: 14 }),
					title: `${labels.t("activitySubagent")} ${shortId}`,
					open,
					expandable: true,
					expandOnRowClick: true,
					keepContentWhenOpen: true,
					onToggle: () => {
						setOpen((value) => !value);
					},
					collapsedContent: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							color: "var(--dsw-alias-label-tertiary)",
							fontSize: "var(--dsh-content-font-size-secondary, 13px)",
							lineHeight: "calc(24px + var(--dsh-content-font-delta, 0px))"
						},
						children: ` · ${status}`
					}),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							paddingInlineStart: 16,
							borderInlineStart: "1px solid var(--dsw-alias-border-l2)",
							display: "flex",
							flexDirection: "column",
							gap: 8
						},
						children: [branch.children.map((child) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NativeActivityNode, {
							branch: child,
							...labels
						}, child.key)), branch.children.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 12,
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: labels.t("activityChildEmpty")
						}) : null]
					})
				})]
			});
		}
		/** Render one native tool or child group; children are never repeated as root rows.
		* @param props - Grouped activity and the separate native/conversation locale seats.
		* @returns A canonical tool card or a initially collapsed child trajectory.
		*/
		function NativeActivityNode({ branch, ...labels }) {
			switch (branch.kind) {
				case "tool": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					title: branch.row.state.name,
					"data-native-tool-id": branch.row.state.toolId,
					"data-native-trajectory": branch.row.state.ownership?.trajectoryId,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CursorAgentToolNode, {
						row: branch.row,
						t: labels.t,
						conversationT: labels.conversationT
					})
				});
				case "text": return branch.thought ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThoughtRow, {
					branch,
					...labels
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					"data-native-agent-text": branch.key,
					style: {
						width: "100%",
						minWidth: 0
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
						text: branch.text,
						labels: {
							code: {
								copyLabel: labels.t("markdownCopy"),
								copiedLabel: labels.t("markdownCopied")
							},
							footnotes: labels.t("markdownFootnotes")
						}
					})
				});
				case "agent": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NativeSubagentNode, {
					branch,
					...labels
				});
			}
			return branch;
		}
		//#endregion
		//#region src/web/NativeTurnContainer.tsx
		/** Per-turn native tool container mounted in the Chat transcript.
		*
		* One instance per turn renders that turn's sidecar rows through the pure
		* row renderer. Display only: never a DSH tool-call block, so the loop
		* never executes native tools. Rows come from one session-scoped shared
		* history subscription, so trailing records after a turn ends still arrive
		* while any native view stays mounted; each container partitions by the
		* loaded Chat timeline (public uiConversation binding, target "chat") and
		* marks rows outside its actual Core window as unattributed.
		*/
		const wrap = {
			display: "flex",
			flexDirection: "column",
			gap: 8,
			minWidth: 0,
			width: "100%"
		};
		const nativeCss = [
			"[data-cursor-agent-native-turn] .md-code-block{width:100%;min-width:0}",
			"[data-cursor-agent-native-turn] [data-code-block-banner]{width:100%;box-sizing:border-box}",
			"[data-cursor-agent-native-turn] [data-code-block-banner]>:last-child{margin-left:auto;flex-shrink:0}"
		].join("");
		const head = {
			margin: 0,
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary)",
			overflowWrap: "anywhere"
		};
		const errorText = {
			margin: 0,
			fontSize: 12,
			color: "var(--dsw-alias-state-error-primary)",
			overflowWrap: "anywhere"
		};
		const EMPTY_NATIVE_ROWS = [];
		const retry = {
			minHeight: 36,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 5,
			padding: "7px 10px",
			color: "var(--dsw-alias-label-primary)",
			background: "var(--dsw-alias-bg-layer-1)",
			cursor: "pointer",
			marginLeft: 8
		};
		function NativeTurnContainer(props) {
			const { turn, startMs, endMs } = props.node.data;
			const chatSource = (0, react.useMemo)(() => props.uiConversation.binding(props.sessionId).target("chat"), [props.uiConversation, props.sessionId]);
			const chatSnapshot = (0, react.useSyncExternalStore)(chatSource.subscribe, chatSource.getSnapshot);
			const historyStore = (0, react.useMemo)(() => getNativeHistoryStore(props.rpc, props.sessionId), [props.rpc, props.sessionId]);
			const history = (0, react.useSyncExternalStore)(historyStore.subscribe, historyStore.getSnapshot);
			const orderedStarts = (0, react.useMemo)(() => {
				const timeline = chatSnapshot?.timeline;
				if (timeline === void 0) return [];
				const out = [];
				for (const item of timeline.turnOrder) {
					const ms = timeline.turns.get(item)?.start?.time;
					if (typeof ms === "number" && Number.isFinite(ms)) out.push({
						turn: item,
						startMs: ms
					});
				}
				return out;
			}, [chatSnapshot]);
			const knownIndex = orderedStarts.findIndex((item) => item.turn === turn);
			const followingStartMs = knownIndex >= 0 ? nextStartMs(orderedStarts, turn) : null;
			const includeEarlier = knownIndex === 0;
			const rows = (0, react.useMemo)(() => {
				if (knownIndex < 0) return EMPTY_NATIVE_ROWS;
				return rowsForTurnWindow(history.rows, startMs, followingStartMs, Date.now(), includeEarlier);
			}, [
				history.rows,
				startMs,
				followingStartMs,
				includeEarlier,
				knownIndex
			]);
			const branches = (0, react.useMemo)(() => groupNativeActivity(rows, knownIndex < 0 ? [] : rowsForTurnWindow(history.agents, startMs, followingStartMs, Date.now(), includeEarlier), knownIndex < 0 ? [] : rowsForTurnWindow(history.texts ?? [], startMs, followingStartMs, Date.now(), includeEarlier)), [
				rows,
				history.agents,
				history.texts,
				knownIndex,
				startMs,
				followingStartMs,
				includeEarlier
			]);
			if (branches.length === 0 && history.error === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"data-cursor-agent-native-turn": turn,
				style: wrap,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: nativeCss }),
					branches.map((branch) => {
						const unattributed = !isOwnedByTurn(Date.parse(branch.kind === "tool" ? branch.row.firstSeenAt : branch.kind === "text" ? branch.firstSeenAt : branch.firstSeenAt), startMs, endMs);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.default.Fragment, { children: [unattributed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							"data-native-unattributed": true,
							style: head,
							children: props.t("activityBetweenTurns")
						}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NativeActivityNode, {
							branch,
							t: props.t,
							conversationT: props.conversationT
						})] }, branch.key);
					}),
					history.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						role: "alert",
						style: errorText,
						children: [history.error, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: retry,
							onClick: () => {
								historyStore.refresh();
							},
							children: props.t("activityRetry")
						})]
					})
				]
			});
		}
		//#endregion
		//#region ../../../dsh-acp-cursor/node_modules/.pnpm/dsh-llm-providers-ui@https+++github.com+NOirBRight+dsh-llm-providers-ui+releases+downlo_41183cff4b318658da5946fd8970188a/node_modules/dsh-llm-providers-ui/lib/model-catalog.js
		const inputStyle = {
			boxSizing: "border-box",
			width: "100%",
			minHeight: 36,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			padding: "7px 10px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit"
		};
		const rowInputStyle = {
			...inputStyle,
			minHeight: 32,
			padding: "4px 10px"
		};
		const selectStyle = {
			boxSizing: "border-box",
			minHeight: 32,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			padding: "4px 28px 4px 10px",
			backgroundColor: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			appearance: "none",
			backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
			backgroundRepeat: "no-repeat",
			backgroundPosition: "right 8px center"
		};
		const rowStyle$1 = {
			display: "grid",
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
			gap: 10
		};
		const modelContentStyle = {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr) auto auto",
			alignItems: "start",
			gap: 8,
			padding: "10px 8px"
		};
		const modelContentSortingStyle = {
			...modelContentStyle,
			gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr) auto"
		};
		const modelDetailStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			padding: "10px 4px 4px"
		};
		const capabilitiesStyle = {
			display: "flex",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 14
		};
		const fieldStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 6
		};
		const labelStyle = {
			fontSize: 13,
			color: "var(--dsw-alias-label-secondary)"
		};
		/** Expanded model details spanning the sortable row. */
		function ModelCatalogDetails({ children }) {
			return (0, react_jsx_runtime.jsx)("div", {
				style: {
					...modelDetailStyle,
					gridColumn: "1 / -1"
				},
				children
			});
		}
		/** Two-column field row inside model details. */
		function ModelCatalogRow({ children }) {
			return (0, react_jsx_runtime.jsx)("div", {
				style: rowStyle$1,
				children
			});
		}
		/** Capability and default-effort cluster. */
		function ModelCatalogCapabilities({ children }) {
			return (0, react_jsx_runtime.jsx)("div", {
				style: capabilitiesStyle,
				children
			});
		}
		const catalogStyles = {
			inputStyle,
			rowInputStyle,
			selectStyle,
			rowStyle: rowStyle$1,
			modelContentStyle,
			modelContentSortingStyle,
			modelDetailStyle,
			capabilitiesStyle,
			fieldStyle,
			labelStyle
		};
		/** Pointer-driven sortable list with a floating ghost and animated live preview. */
		const listStyle$1 = {
			display: "flex",
			flexDirection: "column",
			gap: 8
		};
		const rowStyle = {
			display: "grid",
			gridTemplateColumns: "30px minmax(0, 1fr)",
			alignItems: "stretch",
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			transition: "box-shadow 150ms ease, opacity 150ms ease, transform 150ms ease"
		};
		const handleStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 30,
			minHeight: 42,
			alignSelf: "stretch",
			border: 0,
			borderRight: "1px solid var(--dsw-alias-border-l2)",
			padding: 0,
			flex: "none",
			touchAction: "none",
			userSelect: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			position: "relative",
			zIndex: 2
		};
		const cardRowStyle = {
			...rowStyle,
			borderRadius: 10,
			background: "var(--dsw-alias-bg-module-platform)",
			overflow: "hidden"
		};
		const cardItemStyle = {
			minWidth: 0,
			display: "flex",
			flexDirection: "column"
		};
		const bareRowStyle = {
			...rowStyle,
			border: 0,
			borderRadius: 0,
			background: "transparent",
			overflow: "visible"
		};
		const bareHandleStyle = {
			...handleStyle,
			width: 22,
			minHeight: 0,
			borderRight: 0,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const plainRowStyle = {
			display: "grid",
			alignItems: "stretch",
			background: "transparent"
		};
		const plainItemStyle = {
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
			padding: "4px 0"
		};
		const moveButtonStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			minWidth: 34,
			minHeight: 34,
			alignSelf: "center",
			border: 0,
			padding: 0,
			flex: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 16,
			cursor: "pointer"
		};
		const touchCss = "@media (pointer:coarse){[data-sortable-handle],[data-sortable-move]{min-width:44px;min-height:44px}}";
		const cardCss = "[data-sortable-card] [data-sortable-item] li,[data-sortable-ghost] [data-sortable-item] li{border:0!important;border-radius:0!important;background:transparent!important;overflow:visible!important;list-style:none;margin:0}";
		/** Grip glyph marking one row's pointer handle. */
		function IconGrip() {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: "10",
				height: "14",
				viewBox: "0 0 10 14",
				fill: "currentColor",
				"aria-hidden": true,
				children: [
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "2.5",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "2.5",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "7",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "7",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "11.5",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "11.5",
						r: "1.2"
					})
				]
			});
		}
		/**
		* Pointer-driven sortable list: an in-tree floating ghost follows the pointer,
		* a preview array records the prospective order, and FLIP animations move
		* sibling rows. The ghost stays inside the list ancestry so ancestor-scoped
		* row styles keep matching it while it floats (position:fixed escapes
		* overflow clipping without leaving the scope). Constraint: no
		* transform/filter/perspective on list ancestors, which would re-anchor
		* the fixed ghost to that ancestor instead of the viewport.
		*/
		function SortableList({ items, getId, renderItem, dragLabel, onReorder, disabled = false, chrome = "row", sorting = true, moveButtons = false, moveUpLabel, moveDownLabel }) {
			const card = chrome === "card";
			const plain = chrome === "plain";
			const bare = chrome === "bare";
			const interactive = sorting && !disabled;
			const showHandle = sorting;
			const upLabel = moveUpLabel ?? (() => "Move up");
			const downLabel = moveDownLabel ?? (() => "Move down");
			/** Commit a durable reorder moving one row by an offset. Pointer preview stays untouched. */
			const moveBy = (id, offset) => {
				if (!interactive || draggedId !== null) return;
				const from = items.findIndex((item) => getId(item) === id);
				if (from < 0) return;
				const to = from + offset;
				if (to < 0 || to >= items.length) return;
				const next = [...items];
				const moved = next.splice(from, 1)[0];
				if (moved === void 0) return;
				next.splice(to, 0, moved);
				onReorder(next);
			};
			/** Arrow keys on a handle commit the same reorder as a pointer drag. */
			const handleKeyDown = (event, id) => {
				if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
				event.preventDefault();
				moveBy(id, event.key === "ArrowUp" ? -1 : 1);
			};
			const [draggedId, setDraggedId] = (0, react.useState)(null);
			const [dropTargetId, setDropTargetId] = (0, react.useState)(null);
			const [previewItems, setPreviewItems] = (0, react.useState)(null);
			const [dragGhost, setDragGhost] = (0, react.useState)(null);
			const rowRefs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const previousRects = (0, react.useRef)(null);
			const previewRef = (0, react.useRef)(null);
			const dragGhostRef = (0, react.useRef)(null);
			const renderedItems = previewItems ?? items;
			const draggedItem = draggedId === null ? void 0 : renderedItems.find((item) => getId(item) === draggedId) ?? items.find((item) => getId(item) === draggedId);
			(0, react.useEffect)(() => {
				if (draggedId === null) return;
				const style = document.createElement("style");
				style.textContent = "html.providers-sortable-dragging, html.providers-sortable-dragging * { cursor: grabbing !important; user-select: none !important; }";
				const previousRootCursor = document.documentElement.style.cursor;
				const previousBodyCursor = document.body.style.cursor;
				document.head.appendChild(style);
				document.documentElement.classList.add("providers-sortable-dragging");
				document.documentElement.style.cursor = "grabbing";
				document.body.style.cursor = "grabbing";
				return () => {
					document.documentElement.classList.remove("providers-sortable-dragging");
					style.remove();
					document.documentElement.style.cursor = previousRootCursor;
					document.body.style.cursor = previousBodyCursor;
				};
			}, [draggedId]);
			(0, react.useEffect)(() => {
				if (draggedId === null) return;
				const handlePointerMove = (event) => {
					const currentGhost = dragGhostRef.current;
					if (currentGhost === null) return;
					event.preventDefault();
					const nextGhost = {
						...currentGhost,
						x: event.clientX - currentGhost.offsetX,
						y: event.clientY - currentGhost.offsetY
					};
					dragGhostRef.current = nextGhost;
					setDragGhost(nextGhost);
					movePreviewFromPointer(nextGhost.y + nextGhost.height / 2);
				};
				const handlePointerUp = (event) => {
					event.preventDefault();
					finishDrag(true);
				};
				const handlePointerCancel = (event) => {
					event.preventDefault();
					finishDrag(false);
				};
				const handleKeyDown = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					finishDrag(false);
				};
				window.addEventListener("pointermove", handlePointerMove, { passive: false });
				window.addEventListener("pointerup", handlePointerUp, { passive: false });
				window.addEventListener("pointercancel", handlePointerCancel, { passive: false });
				window.addEventListener("keydown", handleKeyDown);
				return () => {
					window.removeEventListener("pointermove", handlePointerMove);
					window.removeEventListener("pointerup", handlePointerUp);
					window.removeEventListener("pointercancel", handlePointerCancel);
					window.removeEventListener("keydown", handleKeyDown);
				};
			}, [draggedId]);
			(0, react.useLayoutEffect)(() => {
				const rects = previousRects.current;
				if (rects === null) return;
				previousRects.current = null;
				rowRefs.current.forEach((node, id) => {
					const previous = rects.get(id);
					if (previous === void 0) return;
					const next = node.getBoundingClientRect();
					const deltaX = previous.left - next.left;
					const deltaY = previous.top - next.top;
					if (deltaX === 0 && deltaY === 0 || typeof node.animate !== "function") return;
					node.animate([{ transform: "translate(" + String(deltaX) + "px, " + String(deltaY) + "px)" }, { transform: "translate(0, 0)" }], {
						duration: 160,
						easing: "cubic-bezier(0.2, 0, 0, 1)"
					});
				});
			}, [renderedItems]);
			const startDrag = (event, id) => {
				if (!interactive || dragGhostRef.current !== null) return;
				if (event.pointerType === "mouse" && event.button !== 0) return;
				const row = event.currentTarget.closest("[data-sortable-row=\"true\"]");
				if (!(row instanceof HTMLElement)) return;
				event.preventDefault();
				if (typeof event.currentTarget.focus === "function") event.currentTarget.focus();
				try {
					event.currentTarget.setPointerCapture(event.pointerId);
				} catch {}
				const rect = row.getBoundingClientRect();
				const nextGhost = {
					id,
					x: rect.left,
					y: rect.top,
					width: rect.width,
					height: rect.height,
					offsetX: event.clientX - rect.left,
					offsetY: event.clientY - rect.top
				};
				dragGhostRef.current = nextGhost;
				const initial = [...items];
				previewRef.current = initial;
				setPreviewItems(initial);
				setDragGhost(nextGhost);
				setDraggedId(id);
			};
			const finishDrag = (commit) => {
				const next = previewRef.current;
				if (commit && next !== null && !sameOrder(next, items, getId)) onReorder(next);
				previewRef.current = null;
				dragGhostRef.current = null;
				setPreviewItems(null);
				setDragGhost(null);
				setDraggedId(null);
				setDropTargetId(null);
			};
			const captureRects = () => {
				previousRects.current = new Map(Array.from(rowRefs.current.entries()).map(([id, node]) => [id, node.getBoundingClientRect()]));
			};
			const setRowRef = (id, node) => {
				if (node === null) rowRefs.current.delete(id);
				else rowRefs.current.set(id, node);
			};
			/** The ghost clones live row controls: keep the copy unfocusable. React 18 types no inert prop, so set the DOM flag behind a support guard. */
			const setGhostInert = (node) => {
				if (node !== null && "inert" in node) node.inert = true;
			};
			const movePreviewFromPointer = (pointerY) => {
				if (draggedId === null) return;
				const current = previewRef.current ?? [...items];
				const from = current.findIndex((item) => getId(item) === draggedId);
				if (from < 0) return;
				const dragged = current[from];
				if (dragged === void 0) return;
				const remaining = current.filter((item) => getId(item) !== draggedId);
				let insertionIndex = remaining.length;
				let nextDropTargetId = remaining.length === 0 ? null : getId(remaining[remaining.length - 1]);
				for (let index = 0; index < remaining.length; index += 1) {
					const item = remaining[index];
					if (item === void 0) continue;
					const id = getId(item);
					const node = rowRefs.current.get(id);
					if (node === void 0) continue;
					const rect = node.getBoundingClientRect();
					if (pointerY < rect.top + rect.height / 2) {
						insertionIndex = index;
						nextDropTargetId = id;
						break;
					}
				}
				const next = [
					...remaining.slice(0, insertionIndex),
					dragged,
					...remaining.slice(insertionIndex)
				];
				setDropTargetId(nextDropTargetId);
				if (sameOrder(next, current, getId)) return;
				captureRects();
				previewRef.current = next;
				setPreviewItems(next);
			};
			const rowChromeStyle = bare ? bareRowStyle : plain ? plainRowStyle : card ? cardRowStyle : rowStyle;
			const rowGridColumns = (showHandle ? "44px " : "") + "minmax(0,1fr)" + (moveButtons && showHandle ? " auto auto" : "");
			const rowItemStyle = plain ? plainItemStyle : card ? cardItemStyle : { minWidth: 0 };
			return (0, react_jsx_runtime.jsxs)("div", {
				"data-sortable-card": card ? "" : void 0,
				"data-sortable-plain": plain ? "" : void 0,
				style: {
					...listStyle$1,
					...card ? { gap: 12 } : {},
					...plain ? { gap: 0 } : {}
				},
				children: [
					card ? (0, react_jsx_runtime.jsx)("style", { children: cardCss }) : null,
					plain || moveButtons ? (0, react_jsx_runtime.jsx)("style", { children: touchCss }) : null,
					renderedItems.map((item, index) => {
						const id = getId(item);
						const dragging = draggedId === id;
						const targeted = dropTargetId === id && draggedId !== id;
						return (0, react_jsx_runtime.jsxs)("div", {
							ref: (node) => {
								setRowRef(id, node);
							},
							"data-sortable-row": "true",
							style: {
								...rowChromeStyle,
								gridTemplateColumns: rowGridColumns,
								visibility: dragging ? "hidden" : "visible",
								pointerEvents: dragging ? "none" : "auto",
								borderColor: dragging ? "transparent" : "var(--dsw-alias-border-l2)",
								boxShadow: targeted ? "0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 20%, transparent)" : "none"
							},
							onPointerDown: (event) => {
								const target = event.target;
								if (target instanceof Element && target.closest("a, input, select, textarea, label, button:not([data-sortable-handle])") !== null) return;
								startDrag(event, id);
							},
							children: [
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-sortable-handle": "",
									style: {
										...bare ? bareHandleStyle : handleStyle,
										display: showHandle ? "flex" : "none",
										...plain ? { borderRight: 0 } : {},
										cursor: disabled ? "default" : draggedId === null ? "grab" : "grabbing"
									},
									"aria-label": dragLabel(item, index),
									"aria-grabbed": dragging,
									title: dragLabel(item, index),
									disabled,
									hidden: !showHandle,
									onDragStart: (event) => {
										event.preventDefault();
									},
									onPointerDown: (event) => {
										startDrag(event, id);
									},
									onKeyDown: (event) => {
										handleKeyDown(event, id);
									},
									children: (0, react_jsx_runtime.jsx)(IconGrip, {})
								}),
								(0, react_jsx_runtime.jsx)("div", {
									"data-sortable-item": "",
									style: rowItemStyle,
									children: renderItem(item, index)
								}),
								moveButtons ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-sortable-move": "up",
									style: {
										...moveButtonStyle,
										display: showHandle ? "inline-flex" : "none"
									},
									"aria-label": upLabel(item, index),
									title: upLabel(item, index),
									disabled: !interactive || index === 0,
									hidden: !showHandle,
									onClick: () => {
										moveBy(id, -1);
									},
									children: "↑"
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-sortable-move": "down",
									style: {
										...moveButtonStyle,
										display: showHandle ? "inline-flex" : "none"
									},
									"aria-label": downLabel(item, index),
									title: downLabel(item, index),
									disabled: !interactive || index === renderedItems.length - 1,
									hidden: !showHandle,
									onClick: () => {
										moveBy(id, 1);
									},
									children: "↓"
								})] }) : null
							]
						}, id);
					}),
					dragGhost !== null && draggedItem !== void 0 ? (0, react_jsx_runtime.jsxs)("div", {
						"data-sortable-row": "true",
						"data-sortable-ghost": "true",
						"aria-hidden": "true",
						ref: setGhostInert,
						style: {
							...rowChromeStyle,
							gridTemplateColumns: rowGridColumns,
							position: "fixed",
							boxSizing: "border-box",
							left: dragGhost.x,
							top: dragGhost.y,
							width: dragGhost.width,
							minHeight: dragGhost.height,
							zIndex: 1e4,
							pointerEvents: "none",
							opacity: .96,
							boxShadow: "var(--dsw-shadow-lv2, 0 10px 30px rgba(0, 0, 0, 0.18))",
							outline: "2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent)"
						},
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								"data-sortable-handle": "",
								style: {
									...handleStyle,
									display: showHandle ? "flex" : "none",
									...plain ? { borderRight: 0 } : {},
									cursor: "grabbing"
								},
								children: (0, react_jsx_runtime.jsx)(IconGrip, {})
							}),
							(0, react_jsx_runtime.jsx)("div", {
								"data-sortable-item": "",
								style: rowItemStyle,
								children: renderItem(draggedItem, renderedItems.findIndex((item) => getId(item) === draggedId))
							}),
							moveButtons && showHandle ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								style: {
									...moveButtonStyle,
									visibility: "hidden"
								},
								children: "↑"
							}), (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								style: {
									...moveButtonStyle,
									visibility: "hidden"
								},
								children: "↓"
							})] }) : null
						]
					}) : null
				]
			});
		}
		function sameOrder(left, right, getId) {
			return left.length === right.length && left.every((item, index) => {
				const other = right[index];
				return other !== void 0 && getId(item) === getId(other);
			});
		}
		const iconButtonStyle$1 = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 28,
			height: 28,
			border: 0,
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			cursor: "pointer"
		};
		/** Copy declared draft keys, including contextWindow. Thinking false clears defaultEffort. */
		function applyCatalogPatch(model, patch) {
			const next = {};
			for (const [key, value] of Object.entries(model)) next[key] = value;
			for (const [key, value] of Object.entries(patch)) if (value === void 0) delete next[key];
			else next[key] = value;
			if (patch.thinking === false) delete next.defaultEffort;
			return next;
		}
		function IconChevron$1({ open }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: "12",
				height: "12",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				style: {
					flex: "none",
					transform: open ? "rotate(90deg)" : "none",
					transition: "transform 120ms ease"
				},
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M6 3.5L10.5 8L6 12.5",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function IconTrash() {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4M6.5 6.8v4.4M9.5 6.8v4.4",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function Capability({ label, value, disabled, triState, unknownLabel, supportedLabel, unsupportedLabel, onChange }) {
			if (!triState) return (0, react_jsx_runtime.jsxs)("label", {
				style: {
					...catalogStyles.labelStyle,
					display: "inline-flex",
					alignItems: "center",
					gap: 6
				},
				children: [(0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: value === true,
					disabled,
					onChange: (event) => {
						onChange(event.target.checked);
					}
				}), label]
			});
			const selected = value === true ? "yes" : value === false ? "no" : "unknown";
			return (0, react_jsx_runtime.jsxs)("label", {
				style: {
					...catalogStyles.labelStyle,
					display: "inline-flex",
					alignItems: "center",
					gap: 6
				},
				children: [label, (0, react_jsx_runtime.jsxs)("select", {
					style: catalogStyles.selectStyle,
					value: selected,
					disabled,
					"aria-label": label,
					onChange: (event) => {
						const next = event.target.value;
						onChange(next === "yes" ? true : next === "no" ? false : void 0);
					},
					children: [
						(0, react_jsx_runtime.jsx)("option", {
							value: "unknown",
							children: unknownLabel
						}),
						(0, react_jsx_runtime.jsx)("option", {
							value: "yes",
							children: supportedLabel
						}),
						(0, react_jsx_runtime.jsx)("option", {
							value: "no",
							children: unsupportedLabel
						})
					]
				})]
			});
		}
		function Source({ labels, sources, field }) {
			const source = sources?.[field];
			if (source === void 0 || labels.source === void 0) return null;
			return (0, react_jsx_runtime.jsx)("span", {
				style: {
					fontSize: 12,
					color: "var(--dsw-alias-label-tertiary)"
				},
				children: labels.source.replace("{source}", source)
			});
		}
		function Restore({ labels, field, overrides, disabled, onRestore }) {
			if (labels.restoreAuto === void 0 || onRestore === void 0 || overrides?.[field] !== true) return null;
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				style: {
					...iconButtonStyle$1,
					width: "auto",
					padding: "0 8px",
					fontSize: 12
				},
				disabled,
				onClick: () => {
					onRestore(field);
				},
				children: labels.restoreAuto
			});
		}
		/** Sortable catalog rows with optional vision, thinking, effort, and capacity fields. */
		function ModelCatalogEditor(props) {
			const { items, fields, labels, disabled = false, sorting = false, expanded, onRestore } = props;
			const allClosed = items.length > 0 && items.every((model) => !expanded.has(model.rowId));
			const zh = typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("zh");
			const expandLabel = labels.expandAll ?? (zh ? "全部展开" : "Expand all");
			const collapseLabel = labels.collapseAll ?? (zh ? "全部收起" : "Collapse all");
			return (0, react_jsx_runtime.jsxs)("div", { children: [items.length === 0 ? null : (0, react_jsx_runtime.jsx)("div", {
				style: {
					display: "flex",
					justifyContent: "flex-end",
					marginBottom: 8
				},
				children: (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					disabled,
					"aria-pressed": !allClosed,
					style: {
						...iconButtonStyle$1,
						width: "auto",
						minWidth: 96,
						padding: "0 10px",
						gap: 6,
						fontSize: 12
					},
					onClick: () => {
						for (const model of items) {
							const open = expanded.has(model.rowId);
							if (allClosed && !open) props.onToggle(model.rowId);
							if (!allClosed && open) props.onToggle(model.rowId);
						}
					},
					children: allClosed ? expandLabel : collapseLabel
				})
			}), (0, react_jsx_runtime.jsx)(SortableList, {
				items: [...items],
				getId: (model) => model.rowId,
				disabled,
				sorting,
				chrome: "row",
				dragLabel: (model, index) => labels.drag + ": " + (model.id.trim() || String(index + 1)),
				onReorder: props.onReorder,
				renderItem: (model, index) => {
					const label = model.id.trim() || String(index + 1);
					const open = expanded.has(model.rowId);
					const efforts = model.efforts ?? [];
					const patch = (next) => {
						props.onPatch(index, next);
					};
					return (0, react_jsx_runtime.jsxs)("div", {
						"data-model-row": label,
						"data-provider-model": "",
						style: sorting ? catalogStyles.modelContentSortingStyle : catalogStyles.modelContentStyle,
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								style: catalogStyles.fieldStyle,
								children: [(0, react_jsx_runtime.jsx)("span", {
									style: catalogStyles.labelStyle,
									children: labels.modelId
								}), (0, react_jsx_runtime.jsx)("input", {
									style: catalogStyles.rowInputStyle,
									value: model.id,
									placeholder: labels.modelId,
									"aria-label": labels.modelId + " " + String(index + 1),
									disabled,
									onChange: (event) => {
										patch({ id: event.target.value });
									}
								})]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								style: catalogStyles.fieldStyle,
								children: [(0, react_jsx_runtime.jsx)("span", {
									style: catalogStyles.labelStyle,
									children: labels.modelName
								}), (0, react_jsx_runtime.jsx)("input", {
									style: catalogStyles.rowInputStyle,
									value: model.name ?? "",
									placeholder: labels.modelName,
									"aria-label": labels.modelName + " " + String(index + 1),
									disabled,
									onChange: (event) => {
										patch({ name: event.target.value || void 0 });
									}
								})]
							}),
							sorting ? null : (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...iconButtonStyle$1,
									marginTop: 18
								},
								"aria-label": labels.modelDetails + ": " + label,
								"aria-expanded": open,
								title: labels.modelDetails,
								onClick: () => {
									props.onToggle(model.rowId);
								},
								children: (0, react_jsx_runtime.jsx)(IconChevron$1, { open })
							}),
							props.onRemove === void 0 ? null : (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...iconButtonStyle$1,
									marginTop: 18
								},
								"aria-label": labels.remove + " " + label,
								title: labels.remove,
								disabled,
								onClick: () => {
									props.onRemove?.(index);
								},
								children: (0, react_jsx_runtime.jsx)(IconTrash, {})
							}),
							open ? (0, react_jsx_runtime.jsxs)(ModelCatalogDetails, { children: [fields.context || fields.inputLimit || fields.output ? (0, react_jsx_runtime.jsxs)(ModelCatalogRow, { children: [
								fields.context ? (0, react_jsx_runtime.jsxs)("label", {
									style: catalogStyles.fieldStyle,
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											style: catalogStyles.labelStyle,
											children: labels.contextWindow
										}),
										(0, react_jsx_runtime.jsx)("input", {
											style: catalogStyles.inputStyle,
											inputMode: "numeric",
											placeholder: labels.contextWindowDefault,
											value: model.contextWindow ?? "",
											disabled,
											"aria-label": labels.contextWindow,
											onChange: (event) => {
												patch({ contextWindow: event.target.value });
											}
										}),
										(0, react_jsx_runtime.jsx)(Source, {
											labels,
											sources: model.sources,
											field: "contextWindow"
										}),
										(0, react_jsx_runtime.jsx)(Restore, {
											labels,
											field: "contextWindow",
											overrides: model.overrides,
											disabled,
											onRestore: (field) => {
												onRestore?.(index, field);
											}
										})
									]
								}) : null,
								fields.inputLimit ? (0, react_jsx_runtime.jsxs)("label", {
									style: catalogStyles.fieldStyle,
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											style: catalogStyles.labelStyle,
											children: labels.inputLimit ?? labels.contextWindow
										}),
										(0, react_jsx_runtime.jsx)("input", {
											style: catalogStyles.inputStyle,
											inputMode: "numeric",
											placeholder: labels.contextWindowDefault,
											value: model.inputLimit ?? "",
											disabled,
											"aria-label": labels.inputLimit ?? labels.contextWindow,
											onChange: (event) => {
												patch({ inputLimit: event.target.value });
											}
										}),
										(0, react_jsx_runtime.jsx)(Source, {
											labels,
											sources: model.sources,
											field: "inputLimit"
										}),
										(0, react_jsx_runtime.jsx)(Restore, {
											labels,
											field: "inputLimit",
											overrides: model.overrides,
											disabled,
											onRestore: (field) => {
												onRestore?.(index, field);
											}
										})
									]
								}) : null,
								fields.output ? (0, react_jsx_runtime.jsxs)("label", {
									style: catalogStyles.fieldStyle,
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											style: catalogStyles.labelStyle,
											children: labels.output ?? labels.contextWindow
										}),
										(0, react_jsx_runtime.jsx)("input", {
											style: catalogStyles.inputStyle,
											inputMode: "numeric",
											placeholder: labels.contextWindowDefault,
											value: model.output ?? "",
											disabled,
											"aria-label": labels.output ?? labels.contextWindow,
											onChange: (event) => {
												patch({ output: event.target.value });
											}
										}),
										(0, react_jsx_runtime.jsx)(Source, {
											labels,
											sources: model.sources,
											field: "output"
										}),
										(0, react_jsx_runtime.jsx)(Restore, {
											labels,
											field: "output",
											overrides: model.overrides,
											disabled,
											onRestore: (field) => {
												onRestore?.(index, field);
											}
										})
									]
								}) : null
							] }) : null, (0, react_jsx_runtime.jsxs)(ModelCatalogCapabilities, { children: [
								fields.vision ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									(0, react_jsx_runtime.jsx)(Capability, {
										label: labels.vision,
										value: model.vision,
										disabled,
										triState: fields.triState === true,
										unknownLabel: labels.unknown ?? labels.contextWindowDefault,
										supportedLabel: labels.supported ?? labels.vision,
										unsupportedLabel: labels.unsupported ?? labels.thinking,
										onChange: (vision) => {
											patch({ vision });
										}
									}),
									(0, react_jsx_runtime.jsx)(Source, {
										labels,
										sources: model.sources,
										field: "vision"
									}),
									(0, react_jsx_runtime.jsx)(Restore, {
										labels,
										field: "vision",
										overrides: model.overrides,
										disabled,
										onRestore: (field) => {
											onRestore?.(index, field);
										}
									})
								] }) : null,
								fields.thinking ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									(0, react_jsx_runtime.jsx)(Capability, {
										label: labels.thinking,
										value: model.thinking,
										disabled,
										triState: fields.triState === true,
										unknownLabel: labels.unknown ?? labels.contextWindowDefault,
										supportedLabel: labels.supported ?? labels.vision,
										unsupportedLabel: labels.unsupported ?? labels.thinking,
										onChange: (thinking) => {
											patch({ thinking });
										}
									}),
									(0, react_jsx_runtime.jsx)(Source, {
										labels,
										sources: model.sources,
										field: "thinking"
									}),
									(0, react_jsx_runtime.jsx)(Restore, {
										labels,
										field: "thinking",
										overrides: model.overrides,
										disabled,
										onRestore: (field) => {
											onRestore?.(index, field);
										}
									})
								] }) : null,
								fields.defaultEffort && efforts.length > 0 ? (0, react_jsx_runtime.jsxs)("label", {
									style: {
										...catalogStyles.labelStyle,
										display: "inline-flex",
										alignItems: "center",
										gap: 6
									},
									children: [
										labels.defaultEffort,
										(0, react_jsx_runtime.jsxs)("select", {
											style: catalogStyles.selectStyle,
											value: model.defaultEffort ?? (fields.triState ? "" : efforts[0]?.id ?? ""),
											disabled: disabled || model.thinking === false,
											"aria-label": labels.defaultEffort + " " + label,
											onChange: (event) => {
												const value = event.target.value;
												patch({ defaultEffort: value === "" ? void 0 : efforts.find((entry) => entry.id === value)?.id });
											},
											children: [fields.triState ? (0, react_jsx_runtime.jsx)("option", {
												value: "",
												children: labels.unknown ?? labels.contextWindowDefault
											}) : null, efforts.map((effort) => (0, react_jsx_runtime.jsx)("option", {
												value: effort.id,
												children: effort.name
											}, effort.id))]
										}),
										(0, react_jsx_runtime.jsx)(Source, {
											labels,
											sources: model.sources,
											field: "defaultEffort"
										}),
										(0, react_jsx_runtime.jsx)(Restore, {
											labels,
											field: "defaultEffort",
											overrides: model.overrides,
											disabled,
											onRestore: (field) => {
												onRestore?.(index, field);
											}
										})
									]
								}) : null
							] })] }) : null
						]
					});
				}
			})] });
		}
		/** Presentation-only model picker overlay. Callers supply grouped candidates. */
		const rootStyle = {
			position: "fixed",
			inset: 0,
			zIndex: 1e3,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			boxSizing: "border-box",
			padding: 24
		};
		const maskStyle = {
			position: "absolute",
			inset: 0,
			background: "var(--dsw-alias-bg-mask-1)",
			backdropFilter: "var(--dsw-mask-blur)"
		};
		const dialogStyle = {
			position: "relative",
			zIndex: 1,
			display: "flex",
			flexDirection: "column",
			width: "min(520px, 100%)",
			maxHeight: "min(680px, calc(100vh - 48px))",
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-inverted)",
			borderRadius: 24,
			background: "var(--dsw-alias-bg-layer-2)",
			boxShadow: "var(--dsw-shadow-lv3)",
			color: "var(--dsw-alias-label-primary)"
		};
		const headerStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			padding: "22px 14px 12px 24px"
		};
		const titleStyle = {
			margin: 0,
			fontSize: 16,
			lineHeight: "24px",
			fontWeight: 500
		};
		const closeStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 28,
			height: 28,
			border: 0,
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			cursor: "pointer",
			fontSize: 22
		};
		const descriptionStyle = {
			margin: 0,
			padding: "0 24px",
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-primary)"
		};
		const searchStyle = {
			boxSizing: "border-box",
			width: "calc(100% - 48px)",
			minHeight: 36,
			margin: "16px 24px 0",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			padding: "7px 10px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit"
		};
		const listStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 16,
			minHeight: 0,
			margin: "12px 24px 20px",
			padding: 0,
			overflowY: "auto",
			listStyle: "none"
		};
		const brandHeaderStyle = {
			padding: "2px 0 0",
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const brandListStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			margin: 0,
			padding: 0,
			listStyle: "none"
		};
		const candidateStyle = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			fontSize: 14,
			lineHeight: "22px",
			cursor: "pointer"
		};
		const footerStyle = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8,
			padding: "12px 24px 20px"
		};
		const buttonStyle = {
			minHeight: 36,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			padding: "7px 12px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			cursor: "pointer"
		};
		const statusStyle = {
			margin: "16px 24px",
			fontSize: 13,
			color: "var(--dsw-alias-label-secondary)"
		};
		const errorStyle$1 = {
			...statusStyle,
			color: "var(--dsw-alias-state-error-primary)"
		};
		function matches(model, query) {
			if (query.trim() === "") return true;
			return ((model.name ?? "") + " " + model.id).toLowerCase().includes(query.trim().toLowerCase());
		}
		/** Searchable grouped checkbox dialog. Does not own discovery or brand rules. */
		function ModelPickerDialog(props) {
			const { open, loading, error, labels } = props;
			const [query, setQuery] = (0, react.useState)("");
			const searchRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!open) setQuery("");
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKeyDown = (event) => {
					if (event.key === "Escape") props.onClose();
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open, props.onClose]);
			(0, react.useEffect)(() => {
				if (!open || loading || error !== void 0) return;
				searchRef.current?.focus();
			}, [
				open,
				loading,
				error
			]);
			if (!open || typeof document === "undefined") return null;
			const visible = props.sections.map((section) => ({
				...section,
				models: section.models.filter((model) => matches(model, query))
			})).filter((section) => section.models.length > 0);
			return (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
				style: rootStyle,
				role: "presentation",
				children: [(0, react_jsx_runtime.jsx)("div", {
					style: maskStyle,
					"aria-hidden": "true",
					onClick: props.onClose
				}), (0, react_jsx_runtime.jsxs)("section", {
					style: dialogStyle,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": labels.title,
					"aria-busy": loading,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							style: headerStyle,
							children: [(0, react_jsx_runtime.jsx)("h2", {
								style: titleStyle,
								children: labels.title
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: closeStyle,
								"aria-label": labels.close,
								onClick: props.onClose,
								children: "×"
							})]
						}),
						(0, react_jsx_runtime.jsx)("p", {
							style: descriptionStyle,
							children: labels.description
						}),
						loading ? (0, react_jsx_runtime.jsx)("p", {
							style: statusStyle,
							role: "status",
							children: labels.loading
						}) : error !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle$1,
							role: "alert",
							children: error
						}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("input", {
							ref: searchRef,
							style: searchStyle,
							type: "search",
							value: query,
							placeholder: labels.search,
							"aria-label": labels.search,
							onChange: (event) => {
								setQuery(event.target.value);
							}
						}), visible.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
							style: statusStyle,
							role: "status",
							children: labels.empty
						}) : (0, react_jsx_runtime.jsx)("ul", {
							style: listStyle,
							children: visible.map((section) => (0, react_jsx_runtime.jsxs)("li", { children: [(0, react_jsx_runtime.jsx)("div", {
								style: brandHeaderStyle,
								children: section.label
							}), (0, react_jsx_runtime.jsx)("ul", {
								style: brandListStyle,
								children: section.models.map((model) => (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsxs)("label", {
									style: candidateStyle,
									children: [(0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: props.picked.has(model.id),
										onChange: () => {
											props.onToggle(model.id);
										}
									}), (0, react_jsx_runtime.jsxs)("span", {
										style: {
											display: "flex",
											flexDirection: "column",
											gap: 2
										},
										children: [(0, react_jsx_runtime.jsxs)("span", { children: [model.name ?? model.id, model.name !== void 0 && model.name !== model.id ? " (" + model.id + ")" : ""] }), model.hint === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
											style: {
												fontSize: 12,
												color: "var(--dsw-alias-label-tertiary)"
											},
											children: model.hint
										})]
									})]
								}) }, model.id))
							})] }, section.id))
						})] }),
						(0, react_jsx_runtime.jsxs)("div", {
							style: footerStyle,
							children: [(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle,
								onClick: props.onClose,
								children: labels.cancel
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...buttonStyle,
									...loading || error !== void 0 ? {
										cursor: "not-allowed",
										opacity: .4
									} : {}
								},
								disabled: loading || error !== void 0,
								onClick: props.onApply,
								children: labels.apply
							})]
						})
					]
				})]
			}), document.body);
		}
		//#endregion
		//#region ../../../dsh-acp-cursor/node_modules/.pnpm/dsh-llm-providers-ui@https+++github.com+NOirBRight+dsh-llm-providers-ui+releases+downlo_41183cff4b318658da5946fd8970188a/node_modules/dsh-llm-providers-ui/lib/provider-ui.js
		/** Plain-object guard shared by the reader factories and the sidebar cache validator. */
		function recordUsageValue$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		/** Non-empty string guard shared by the reader factories and the sidebar cache validator. */
		function nonEmptyString$1(value) {
			return typeof value === "string" && value.length > 0;
		}
		function finiteNumber(value) {
			return typeof value === "number" && Number.isFinite(value);
		}
		/** Non-negative finite number guard shared by the reader factories and the sidebar cache validator. */
		function nonNegativeNumber(value) {
			return finiteNumber(value) && value >= 0;
		}
		const PERIOD_RANK = {
			M: 6,
			W: 5,
			D: 4,
			CURS: 3,
			S: 1,
			A: 0,
			L: 0,
			CR: -1
		};
		function periodRank(shortLabelValue) {
			const normalized = shortLabelValue.toUpperCase();
			return PERIOD_RANK[normalized] ?? (/^\d+H$/.test(normalized) ? 2 : 0);
		}
		/** Headline window: longest remaining-percent period. Text-only windows are skipped. */
		function pickPrimaryWindow(windows) {
			let best;
			for (const quotaWindow of windows) {
				if (quotaWindow.remainingPercent === void 0) continue;
				if (best === void 0 || periodRank(quotaWindow.shortLabel) > periodRank(best.shortLabel)) best = quotaWindow;
			}
			if (best !== void 0 && best.remainingPercent === 100 && !nonEmptyString$1(best.resetsAt)) {
				let fallback;
				for (const quotaWindow of windows) {
					if (quotaWindow === best || !nonEmptyString$1(quotaWindow.resetsAt) || quotaWindow.remainingPercent === void 0) continue;
					if (fallback === void 0 || periodRank(quotaWindow.shortLabel) > periodRank(fallback.shortLabel)) fallback = quotaWindow;
				}
				if (fallback !== void 0) return fallback;
			}
			return best;
		}
		/** Shortest period first: 5-hour, week, month. Cached summaries keep emission order, so display sorts. */
		function displayWindowRank(quotaWindow) {
			const id = quotaWindow.id.toLowerCase();
			const shortLabelValue = quotaWindow.shortLabel.toLowerCase();
			if (id === "fivehour" || id === "five-hour" || id === "5h" || shortLabelValue === "5h") return 0;
			if (id === "weekly" || id === "week" || shortLabelValue === "w") return 1;
			if (id === "monthly" || id === "month" || shortLabelValue === "m") return 2;
			return 3;
		}
		function orderUsageWindows(windows) {
			return [...windows].sort((left, right) => displayWindowRank(left) - displayWindowRank(right));
		}
		function formatRemainingDuration(ms) {
			const rtf = new Intl.RelativeTimeFormat(void 0, { numeric: "always" });
			const days = Math.round(ms / 864e5);
			if (Math.abs(days) >= 1) return rtf.format(days, "day");
			const hours = Math.round(ms / 36e5);
			if (Math.abs(hours) >= 1) return rtf.format(hours, "hour");
			const minutes = Math.max(1, Math.round(Math.abs(ms) / 6e4));
			return rtf.format(ms < 0 ? -minutes : minutes, "minute");
		}
		function parseResetTime(resetsAt) {
			if (/^\d{4}-\d{2}-\d{2}/u.test(resetsAt)) {
				const iso = Date.parse(resetsAt);
				return Number.isFinite(iso) ? iso : void 0;
			}
			if (!/^\d{10,}$/u.test(resetsAt)) return void 0;
			const n = Number(resetsAt);
			if (!Number.isFinite(n) || n <= 0) return void 0;
			return n < 0xe8d4a51000 ? n * 1e3 : n;
		}
		/** System-zone instant for a reset ISO. Language copy stays in the UI. */
		function formatResetInstant(resetsAt) {
			if (!nonEmptyString$1(resetsAt)) return void 0;
			const time = parseResetTime(resetsAt);
			if (time === void 0) return void 0;
			const delta = time - Date.now();
			if (delta < -3456e7 || delta > 6912e7) return void 0;
			return {
				when: new Intl.DateTimeFormat(void 0, {
					dateStyle: "short",
					timeStyle: "short"
				}).format(new Date(time)),
				overdue: delta <= 0,
				relative: formatRemainingDuration(delta)
			};
		}
		const USAGE_CACHE_KEY$1 = "dsh-llm-providers-ui:usage-cache";
		/**
		* Browser last-good usage cache shared across bundles: the sidebar store and
		* each provider Settings card bundle their own copy of this module, so the
		* module-level memory map below is per-bundle while storage is shared.
		* Readable storage is authoritative, including empty after invalidation; memory
		* is only a fallback while storage is unavailable. Stale status persists
		* honestly, and collapsed-header headlines never replace a full multi-window
		* summary (a later full read upgrades a headline).
		*/
		let memoryUsageCache$1 = /* @__PURE__ */ new Map();
		/** Whether a ready or stale summary retains displayable usage windows.
		* @param summary - Current or retained provider usage.
		* @returns Whether its windows can be displayed and persisted.
		*/
		function hasUsageData(summary) {
			return summary !== void 0 && summary.windows.length > 0 && (summary.status === "ready" || summary.status === "stale");
		}
		function cachedSummary(value) {
			const item = recordUsageValue$1(value);
			if (item === void 0 || !nonEmptyString$1(item.providerKey) || !nonEmptyString$1(item.name)) return void 0;
			const status = item.status;
			if (status !== "ready" && status !== "stale") return void 0;
			if (!Array.isArray(item.windows) || item.windows.length === 0) return void 0;
			const windows = [];
			for (const windowValue of item.windows) {
				const quotaWindow = recordUsageValue$1(windowValue);
				if (quotaWindow === void 0 || !nonEmptyString$1(quotaWindow.id) || !nonEmptyString$1(quotaWindow.label) || !nonEmptyString$1(quotaWindow.shortLabel) || !nonEmptyString$1(quotaWindow.valueText)) return void 0;
				if (quotaWindow.remainingPercent !== void 0 && (!nonNegativeNumber(quotaWindow.remainingPercent) || quotaWindow.remainingPercent > 100)) return void 0;
				if (quotaWindow.resetsAt !== void 0 && !nonEmptyString$1(quotaWindow.resetsAt)) return void 0;
				windows.push({
					id: quotaWindow.id,
					label: quotaWindow.label,
					shortLabel: quotaWindow.shortLabel,
					valueText: quotaWindow.valueText,
					...quotaWindow.remainingPercent === void 0 ? {} : { remainingPercent: quotaWindow.remainingPercent },
					...quotaWindow.resetsAt === void 0 ? {} : { resetsAt: quotaWindow.resetsAt }
				});
			}
			return {
				providerKey: item.providerKey,
				name: item.name,
				status,
				windows: orderUsageWindows(windows),
				...nonEmptyString$1(item.fetchedAt) ? { fetchedAt: item.fetchedAt } : {}
			};
		}
		/** Readable storage backends. A backend that throws on read is unusable and skipped. */
		function usageStorageBackends$1() {
			const backends = [];
			for (const name of ["localStorage", "sessionStorage"]) try {
				const backend = globalThis[name];
				if (backend === void 0 || backend === null) continue;
				backend.getItem(USAGE_CACHE_KEY$1);
				backends.push(backend);
			} catch {}
			return backends;
		}
		function storageRead$1() {
			const backends = usageStorageBackends$1();
			if (backends.length === 0) return {
				available: false,
				raw: null
			};
			for (const backend of backends) try {
				const raw = backend.getItem(USAGE_CACHE_KEY$1);
				if (raw !== null) return {
					available: true,
					raw
				};
			} catch {}
			return {
				available: true,
				raw: null
			};
		}
		function storageWrite$1(value) {
			for (const backend of usageStorageBackends$1()) try {
				backend.setItem(USAGE_CACHE_KEY$1, value);
			} catch {}
		}
		function parseUsageCache(raw) {
			const cached = /* @__PURE__ */ new Map();
			if (raw === null) return cached;
			try {
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return cached;
				for (const value of parsed) {
					const item = cachedSummary(value);
					if (item !== void 0) cached.set(item.providerKey, item);
				}
			} catch {}
			return cached;
		}
		function readUsageCache() {
			const { available, raw } = storageRead$1();
			if (!available) return new Map(memoryUsageCache$1);
			const fromStorage = parseUsageCache(raw);
			memoryUsageCache$1 = new Map(fromStorage);
			return fromStorage;
		}
		/** Persistable copy: status stays ready/stale as the caller holds it, never laundered to ready. */
		function persistableUsage(summary) {
			return {
				providerKey: summary.providerKey,
				name: summary.name,
				status: summary.status,
				windows: orderUsageWindows(summary.windows),
				...summary.fetchedAt === void 0 ? {} : { fetchedAt: summary.fetchedAt }
			};
		}
		/** A collapsed-header single window, never a full multi-window summary. */
		function isHeadlineOnly(summary) {
			return summary.windows.length === 1 && summary.windows[0]?.id === "headline";
		}
		function writeUsageCache(current) {
			const entries = [...current.values()].filter(hasUsageData);
			const { available, raw } = storageRead$1();
			if (!available) {
				for (const item of entries) memoryUsageCache$1.set(item.providerKey, persistableUsage(item));
				return;
			}
			const merged = parseUsageCache(raw);
			for (const item of entries) {
				const previous = merged.get(item.providerKey);
				if (previous !== void 0 && !isHeadlineOnly(previous) && isHeadlineOnly(item)) continue;
				merged.set(item.providerKey, persistableUsage(item));
			}
			memoryUsageCache$1 = new Map(merged);
			if (merged.size === 0) return;
			storageWrite$1(JSON.stringify([...merged.values()]));
		}
		function dropPersistedUsageKeys$1(keys) {
			const drop = new Set(keys);
			for (const key of drop) memoryUsageCache$1.delete(key);
			const { available, raw } = storageRead$1();
			if (!available || raw === null) return;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return;
			}
			if (!Array.isArray(parsed)) return;
			const kept = parsed.filter((value) => {
				const item = recordUsageValue$1(value);
				return item === void 0 || !nonEmptyString$1(item.providerKey) || !drop.has(item.providerKey);
			});
			if (kept.length === parsed.length) return;
			storageWrite$1(JSON.stringify(kept));
		}
		/** Last-good quota for a Provider card header, available on first paint. */
		function peekCachedUsage(providerKey) {
			return readUsageCache().get(providerKey);
		}
		function rememberCachedUsage(summary) {
			if (!hasUsageData(summary)) return;
			writeUsageCache(/* @__PURE__ */ new Map([[summary.providerKey, summary]]));
		}
		/**
		* Collapsed-header last-good quota for first paint. Ignores headlines without
		* a finite in-range remaining percent so missing quota renders no meter, never
		* a zero bar. Never replaces a cached full multi-window summary, and records
		* no fetchedAt: a headline is display data, not a fetch, so freshness checks
		* treat it as expired and refetch.
		*/
		function rememberHeadlineQuota(providerKey, name, quota) {
			if (quota?.remainingPercent === void 0 || !Number.isFinite(quota.remainingPercent)) return;
			const remainingPercent = Math.round(quota.remainingPercent * 10) / 10;
			if (remainingPercent < 0 || remainingPercent > 100) return;
			const label = quota.label ?? "Quota";
			rememberCachedUsage({
				providerKey,
				name,
				status: "ready",
				windows: [{
					id: "headline",
					label,
					shortLabel: label,
					valueText: String(remainingPercent) + "%",
					remainingPercent
				}]
			});
		}
		function headerQuotaFromCache(summary) {
			if (summary === void 0) return void 0;
			const quotaWindow = pickPrimaryWindow(summary.windows);
			if (quotaWindow === void 0) return void 0;
			const instant = formatResetInstant(quotaWindow.resetsAt);
			const detail = instant === void 0 ? void 0 : instant.when;
			return {
				label: quotaWindow.shortLabel || quotaWindow.label,
				...quotaWindow.remainingPercent === void 0 ? {} : { remainingPercent: quotaWindow.remainingPercent },
				...detail === void 0 ? {} : { detail }
			};
		}
		/**
		* Normalize remaining quota to a 0-100 percent value.
		* Valid readings keep their precision (99.9 stays 99.9, never rounds to 100).
		* NaN, Infinity, and out-of-range readings are unavailable, not clamped:
		* clamping would fabricate a full or empty bar from bad data.
		* @param input - percent and/or fraction quota reading.
		* @returns the 0-100 remaining value, or undefined when unavailable.
		*/
		function normalizeQuotaRemaining(input) {
			const percent = input.remainingPercent;
			if (percent !== void 0) return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : void 0;
			const fraction = input.remainingFraction;
			if (fraction !== void 0) return Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 ? fraction * 100 : void 0;
		}
		/**
		* Remaining quota for a provider card header, from one cache shared with the
		* Provider Usage sidebar. The first frame paints the cached entry, a live answer
		* wins and is written back, and a known sign-out drops the entry rather than
		* leaving another account's quota behind.
		* @param providerKey - usage cache key, identical to the sidebar reader's key.
		* @param providerName - display name recorded with the cached quota.
		* @param quota - the live answer, or null while none has arrived. Only the label and
		* the remaining percent are persisted, because that is all a stored headline holds.
		* @param auth - settled state of the account read.
		* @returns the live quota, else the cached one; null when withheld or when neither is displayable.
		*/
		function useProviderQuotaCache(providerKey, providerName, quota, auth) {
			const { answered, signedOut, withheld } = auth;
			(0, react.useEffect)(() => {
				if (signedOut) {
					if (answered) dropPersistedUsageKeys$1([providerKey]);
					return;
				}
				if (withheld === true) return;
				if (quota !== null) rememberHeadlineQuota(providerKey, providerName, quota);
			}, [
				answered,
				signedOut,
				withheld,
				providerKey,
				providerName,
				quota?.remainingPercent,
				quota?.label
			]);
			const cached = (0, react.useMemo)(() => answered && signedOut ? void 0 : headerQuotaFromCache(peekCachedUsage(providerKey)), [
				answered,
				signedOut,
				providerKey
			]);
			return withheld === true ? null : quota ?? cached ?? null;
		}
		const meterWrapStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 5,
			minWidth: 0
		};
		const meterTopStyle = {
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: 8
		};
		const meterLabelStyle = {
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		const meterValueStyle = {
			flex: "none",
			fontVariantNumeric: "tabular-nums",
			fontWeight: 500,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-primary)"
		};
		const meterTrackStyle = {
			display: "block",
			width: "100%",
			height: 6,
			overflow: "hidden",
			border: 0,
			borderRadius: 2,
			background: "color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)",
			position: "relative"
		};
		const meterFillBase = {
			display: "block",
			height: "100%",
			borderRadius: 2,
			position: "relative",
			background: "color-mix(in srgb, var(--dsw-alias-label-primary) 55%, var(--dsw-alias-label-secondary))"
		};
		const meterKnobStyle = {
			position: "absolute",
			right: 0,
			top: 0,
			bottom: 0,
			width: 2,
			background: "var(--dsw-alias-label-primary)"
		};
		const meterSegmentsStyle = {
			position: "absolute",
			inset: 0,
			pointerEvents: "none",
			background: "repeating-linear-gradient(to right, transparent 0, transparent calc(10% - 1px), var(--dsw-alias-bg-layer-1) calc(10% - 1px), var(--dsw-alias-bg-layer-1) 10%)"
		};
		/** Approved A low-quota fill: amber only, no red tier, no hardcoded hue. */
		const meterWarnFill = { background: "var(--dsw-alias-state-warn-primary)" };
		const meterDetailStyle = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "16px"
		};
		const meterMissingStyle = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		/** Segmented remaining-quota meter. Unavailable quota renders a placeholder, never a zero bar. */
		function ProviderQuotaMeter(props) {
			const remaining = normalizeQuotaRemaining(props);
			const label = props.label ?? "Quota";
			if (remaining === void 0) return (0, react_jsx_runtime.jsx)("span", {
				"data-provider-quota-missing": "",
				style: meterMissingStyle,
				children: props.emptyLabel ?? "—"
			});
			const warn = remaining < 20;
			const text = String(remaining);
			return (0, react_jsx_runtime.jsxs)("span", {
				"data-provider-quota": "",
				style: meterWrapStyle,
				...props.id === void 0 ? {} : { id: props.id },
				children: [
					(0, react_jsx_runtime.jsxs)("span", {
						style: meterTopStyle,
						children: [(0, react_jsx_runtime.jsx)("span", {
							style: meterLabelStyle,
							children: label
						}), (0, react_jsx_runtime.jsx)("span", {
							style: meterValueStyle,
							children: text + "%"
						})]
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						"data-provider-quota-meter": "",
						role: "meter",
						"aria-label": label,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": remaining,
						style: meterTrackStyle,
						children: [(0, react_jsx_runtime.jsx)("span", {
							style: {
								...meterFillBase,
								...warn ? meterWarnFill : {},
								width: text + "%"
							},
							children: (0, react_jsx_runtime.jsx)("span", { style: meterKnobStyle })
						}), (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							style: meterSegmentsStyle
						})]
					}),
					props.detail === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
						style: meterDetailStyle,
						children: props.detail
					})
				]
			});
		}
		const headerMainStyle = {
			display: "flex",
			alignItems: "center",
			gap: 14,
			minWidth: 0,
			flex: 1
		};
		const headerIdentityStyle = {
			display: "flex",
			alignItems: "center",
			gap: 12,
			minWidth: 0,
			flex: 1
		};
		const headerMarkStyle = {
			width: 28,
			height: 28,
			flex: "none",
			display: "grid",
			placeItems: "center",
			overflow: "visible"
		};
		const headerTitleColStyle = {
			display: "flex",
			flexDirection: "column",
			minWidth: 0,
			flex: 1
		};
		const headerTitleStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 8,
			fontSize: 14,
			fontWeight: 600,
			lineHeight: "20px"
		};
		const headerBadgeBase = {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			whiteSpace: "nowrap",
			fontSize: 10,
			fontWeight: 500,
			lineHeight: "16px",
			padding: "0 5px",
			borderRadius: 3,
			border: "1px solid transparent"
		};
		const headerBadgeLlm = {
			color: "var(--dsw-alias-label-secondary)",
			borderColor: "var(--dsw-alias-border-l2)",
			background: "transparent"
		};
		const headerBadgeAgent = {
			color: "var(--dsw-alias-bg-layer-1)",
			borderColor: "var(--dsw-alias-label-primary)",
			background: "var(--dsw-alias-label-primary)"
		};
		const headerSummaryStyle = {
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-tertiary)",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
		};
		const headerMiniStyle = {
			width: 172,
			flex: "none",
			minWidth: 0
		};
		const headerStatusStyle = {
			width: 96,
			flex: "none",
			textAlign: "right",
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-tertiary)",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
		};
		const headerSideStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 10,
			flex: "none"
		};
		const headerUnsavedStyle = {
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const headerChevronStyle = {
			width: 15,
			fontSize: 20,
			lineHeight: 1,
			textAlign: "center",
			color: "var(--dsw-alias-label-tertiary)"
		};
		/**
		* Monochrome role badge: outlined message glyph for LLM, filled terminal glyph
		* for Agent. Shared by migrated card headers and the shell legacy fallback.
		*/
		function ProviderRoleBadge(props) {
			const agent = (props.role ?? "llm") === "agent";
			return (0, react_jsx_runtime.jsxs)("span", {
				"data-provider-role-badge": agent ? "agent" : "llm",
				style: {
					...headerBadgeBase,
					...agent ? headerBadgeAgent : headerBadgeLlm
				},
				children: [(0, react_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.4,
					"aria-hidden": "true",
					children: agent ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("rect", {
						x: "1.5",
						y: "2",
						width: "13",
						height: "12",
						rx: "2"
					}), (0, react_jsx_runtime.jsx)("path", { d: "m4 5 3 3-3 3m5 0h3" })] }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("rect", {
						x: "2",
						y: "2",
						width: "12",
						height: "9",
						rx: "3"
					}), (0, react_jsx_runtime.jsx)("path", { d: "m5 11-1 3 5-3M5 6h6" })] })
				}), agent ? "Agent" : "LLM"]
			});
		}
		/**
		* Approved A header geometry in one row: identity (mark beside title, badge,
		* and count) on the left, headline quota at the right, caller status, and the
		* chevron. Narrow screens stack identity plus chevron over quota plus status.
		* Renders a fragment for the caller-owned header button; props keep the legacy
		* codex provider-chrome signature so existing call sites keep working.
		*/
		function ProviderCardHeader(props) {
			const quota = props.quota === void 0 || props.quota === null ? void 0 : {
				...props.quota.remainingPercent === void 0 ? {} : { remainingPercent: props.quota.remainingPercent },
				...props.quota.remainingFraction === void 0 ? {} : { remainingFraction: props.quota.remainingFraction },
				...props.quota.label === void 0 ? {} : { label: props.quota.label },
				...props.quota.detail === void 0 ? {} : { detail: props.quota.detail }
			};
			return (0, react_jsx_runtime.jsxs)("span", {
				"data-provider-header-main": "",
				style: headerMainStyle,
				children: [
					(0, react_jsx_runtime.jsxs)("span", {
						"data-provider-header-identity": "",
						style: headerIdentityStyle,
						children: [(0, react_jsx_runtime.jsx)("span", {
							"data-provider-header-mark": "",
							style: headerMarkStyle,
							children: props.mark
						}), (0, react_jsx_runtime.jsxs)("span", {
							style: headerTitleColStyle,
							children: [(0, react_jsx_runtime.jsxs)("span", {
								style: headerTitleStyle,
								children: [(0, react_jsx_runtime.jsx)("span", { children: props.title }), (0, react_jsx_runtime.jsx)(ProviderRoleBadge, { ...props.role === void 0 ? {} : { role: props.role } })]
							}), (0, react_jsx_runtime.jsx)("span", {
								"data-provider-header-summary": "",
								style: headerSummaryStyle,
								children: props.summary
							})]
						})]
					}),
					quota === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
						"data-provider-quota-mini": "",
						style: headerMiniStyle,
						children: (0, react_jsx_runtime.jsx)(ProviderQuotaMeter, { ...quota })
					}),
					props.status === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
						"data-provider-header-status": "",
						style: headerStatusStyle,
						children: props.status
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						"data-provider-header-side": "",
						style: headerSideStyle,
						children: [props.unsaved === true && props.unsavedLabel !== void 0 ? (0, react_jsx_runtime.jsx)("span", {
							style: headerUnsavedStyle,
							children: props.unsavedLabel
						}) : null, (0, react_jsx_runtime.jsx)("span", {
							"data-provider-header-chevron": "",
							"aria-hidden": "true",
							style: {
								...headerChevronStyle,
								transform: props.open ? "rotate(180deg)" : "none"
							},
							children: "⌄"
						})]
					})
				]
			});
		}
		/**
		* Scoped provider chrome CSS: plain card reset, header button layout, body and
		* model rows, quota meter responsive rules, and coarse-pointer touch targets.
		* The shell injects it once per page; provider cards may also inject it once
		* for standalone use. Duplicate style tags are harmless: every rule is scoped
		* to a data-provider-* attribute; shared geometry overrides legacy inline layout styles.
		*/
		const providerUiCss = [
			"[data-provider-card]{box-sizing:border-box;width:100%;min-width:0;list-style:none;margin:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;overflow:visible}",
			"[data-provider-card-header]{box-sizing:border-box;width:100%;min-height:76px!important;display:flex;align-items:center;justify-content:space-between;gap:16px;border:0;padding:12px 14px!important;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}",
			"[data-provider-body][hidden]{display:none!important}",
			"[data-provider-role-badge] svg{width:12px;height:12px}",
			"[data-provider-card-header]:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent)}",
			"[data-provider-body]{display:flex;flex-direction:column;gap:18px;border-top:1px solid var(--dsw-alias-border-l2);padding:16px 14px 18px}",
			"[data-provider-model]{display:flex;align-items:center;gap:9px;min-height:40px}",
			"[data-provider-quota-mini]{display:block}",
			"[data-providers-list]{display:flex;flex-direction:column}",
			"[data-providers-list] [data-sortable-row]+[data-sortable-row]{border-top:1px solid var(--dsw-alias-border-l2)}",
			"[data-providers-section]{container-type:inline-size}",
			"@media (max-width:680px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px!important;height:11px!important}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-header-side] [data-provider-header-chevron]{width:18px}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}[data-provider-model]{min-height:48px}[data-provider-model] input[type=checkbox]{width:17px;height:17px}[data-providers-section] button,[data-provider-card] button{min-height:44px}}",
			"@container (max-width:540px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px!important;height:11px!important}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-header-side] [data-provider-header-chevron]{width:18px}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}[data-provider-model]{min-height:48px}[data-provider-model] input[type=checkbox]{width:17px;height:17px}[data-providers-section] button,[data-provider-card] button{min-height:44px}}",
			"@media (pointer:coarse){[data-sortable-handle],[data-sortable-move]{min-width:44px;min-height:44px}}"
		].join("\n");
		//#endregion
		//#region ../../../dsh-acp-cursor/node_modules/.pnpm/dsh-llm-providers-ui@https+++github.com+NOirBRight+dsh-llm-providers-ui+releases+downlo_41183cff4b318658da5946fd8970188a/node_modules/dsh-llm-providers-ui/lib/usage-readers.js
		/** Plain-object guard shared by the reader factories and the sidebar cache validator. */
		function recordUsageValue(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		/** Non-empty string guard shared by the reader factories and the sidebar cache validator. */
		function nonEmptyString(value) {
			return typeof value === "string" && value.length > 0;
		}
		const USAGE_CACHE_KEY = "dsh-llm-providers-ui:usage-cache";
		/**
		* Browser last-good usage cache shared across bundles: the sidebar store and
		* each provider Settings card bundle their own copy of this module, so the
		* module-level memory map below is per-bundle while storage is shared.
		* Readable storage is authoritative, including empty after invalidation; memory
		* is only a fallback while storage is unavailable. Stale status persists
		* honestly, and collapsed-header headlines never replace a full multi-window
		* summary (a later full read upgrades a headline).
		*/
		let memoryUsageCache = /* @__PURE__ */ new Map();
		/** Readable storage backends. A backend that throws on read is unusable and skipped. */
		function usageStorageBackends() {
			const backends = [];
			for (const name of ["localStorage", "sessionStorage"]) try {
				const backend = globalThis[name];
				if (backend === void 0 || backend === null) continue;
				backend.getItem(USAGE_CACHE_KEY);
				backends.push(backend);
			} catch {}
			return backends;
		}
		function storageRead() {
			const backends = usageStorageBackends();
			if (backends.length === 0) return {
				available: false,
				raw: null
			};
			for (const backend of backends) try {
				const raw = backend.getItem(USAGE_CACHE_KEY);
				if (raw !== null) return {
					available: true,
					raw
				};
			} catch {}
			return {
				available: true,
				raw: null
			};
		}
		function storageWrite(value) {
			for (const backend of usageStorageBackends()) try {
				backend.setItem(USAGE_CACHE_KEY, value);
			} catch {}
		}
		function dropPersistedUsageKeys(keys) {
			const drop = new Set(keys);
			for (const key of drop) memoryUsageCache.delete(key);
			const { available, raw } = storageRead();
			if (!available || raw === null) return;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return;
			}
			if (!Array.isArray(parsed)) return;
			const kept = parsed.filter((value) => {
				const item = recordUsageValue(value);
				return item === void 0 || !nonEmptyString(item.providerKey) || !drop.has(item.providerKey);
			});
			if (kept.length === parsed.length) return;
			storageWrite(JSON.stringify(kept));
		}
		//#endregion
		//#region src/web/usage-reader.ts
		/** One-decimal remaining percent shared by the card header, body, and sidebar writer. */
		function headlineRemainingPercent(fraction) {
			return Math.round(fraction * 1e3) / 10;
		}
		function createCursorAgentUsageReader() {
			return {
				providerKey: "cursor-agent",
				name: "Cursor",
				async read(rpc, _refresh, signal) {
					const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, QUOTA_ENDPOINT, {}, signal);
					if (!result.ok) return {
						status: "error",
						message: result.error.message
					};
					const quota = decodeQuotaSnapshot(result.value);
					if (quota === void 0) return {
						status: "error",
						message: "Invalid Cursor quota response"
					};
					if (quota.status === "authentication-required" || quota.status === "account-changed") return { status: "logged-out" };
					if (quota.status === "not-entitled") return { status: "unsupported" };
					if (quota.status !== "ready") return {
						status: "error",
						...quota.message === void 0 ? {} : { message: quota.message }
					};
					const resetsPrefix = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh") ? "重置时间 " : "Resets ";
					return {
						status: "ready",
						fetchedAt: quota.observedAt,
						windows: quota.groups.flatMap((group, gi) => group.buckets.flatMap((bucket, bi) => {
							if (bucket.disabled || bucket.remainingFraction === void 0) return [];
							const remaining = headlineRemainingPercent(bucket.remainingFraction);
							const label = bucket.displayName ?? bucket.window ?? group.displayName ?? "Cursor";
							const resetsAt = bucket.resetTime === void 0 ? void 0 : resetsPrefix + new Date(bucket.resetTime).toLocaleString();
							return [{
								id: bucket.bucketId ?? String(gi) + ":" + String(bi),
								label,
								shortLabel: label,
								valueText: String(remaining) + "%",
								remainingPercent: remaining,
								...resetsAt === void 0 ? {} : { resetsAt }
							}];
						}))
					};
				}
			};
		}
		//#endregion
		//#region src/web/BrandMark.tsx
		/** Official Cursor logomark path from dsh-llm-cursor BrandMark. */
		const CURSOR_BRAND_PATH = "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23";
		const SIZE = 18;
		/** Compact Cursor logo for the Provider card and Model Switch runtime. */
		function BrandMark() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: SIZE,
				height: SIZE,
				viewBox: "0 0 24 24",
				"aria-hidden": "true",
				style: { flex: "none" },
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					fill: "currentColor",
					d: CURSOR_BRAND_PATH
				})
			});
		}
		//#endregion
		//#region src/web/settings-state.ts
		/** Classify the browser that opened Settings. App WebView wins over hostname. */
		function cursorAgentAccessKind(hostname, userAgent = "") {
			const ua = userAgent.toLowerCase();
			if (ua.includes("; wv)") || ua.includes("dsh-mobile") || ua.includes("dshmobile")) return "app";
			const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
			if (host === "127.0.0.1" || host === "localhost" || host === "::1") return "local";
			const parts = host.split(".");
			if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part))) {
				const octets = parts.map(Number);
				if (octets.every((n) => n <= 255) && (octets[0] === 10 || octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)) return "lan";
			}
			return "remote";
		}
		/** Locale key for the access-kind login hint. */
		function cursorAgentAccessHintKey(kind) {
			if (kind === "local") return "accessLocal";
			if (kind === "lan") return "accessLan";
			if (kind === "app") return "accessApp";
			return "accessRemote";
		}
		/** Resolve setup from probe-backed installation and provider authentication status. A failed probe reports the failure it saw instead of claiming the account needs sign-in. */
		function resolveCursorAgentCardState(row) {
			if (row === void 0) return "loading";
			if (!row.installed) return "missing";
			if (row.probeFailed === true) return "error";
			if (!row.authenticated) return "login";
			return "connected";
		}
		/** Whether a live snapshot invalidates retained account quota.
		* @param previous - Last accepted row, absent on first paint.
		* @param incoming - Newly received authentication and profile state.
		* @returns True on logout, missing provider, or a known profile change.
		*/
		function shouldClearQuota(previous, incoming) {
			return !incoming?.authenticated || previous !== void 0 && (previous.authenticated !== incoming.authenticated || previous.accountEmail !== incoming.accountEmail || previous.instanceId !== incoming.instanceId || previous.stateDirectory !== incoming.stateDirectory);
		}
		/** Override flags one editor patch adds: the fields the user just set to a value.
		*
		* The editor reports only what changed, which is the single piece of edit evidence a
		* row outside the accepted snapshot has; a patch that clears a field sets no flag.
		* @param patch - the catalog patch handed to the card.
		* @returns flag names to merge into the row, or undefined when the patch set nothing.
		*/
		function patchedOverrideFlags(patch) {
			const flags = {};
			for (const field of [
				"name",
				"vision",
				"thinking",
				"contextWindow",
				"defaultEffort"
			]) if (patch[field] !== void 0) flags[field] = true;
			return Object.keys(flags).length === 0 ? void 0 : flags;
		}
		/** Name every catalog field the save payload must store as a user override.
		*
		* The payload replaces the stored override set, so a field is stored when either
		* of two things holds: the row differs from the snapshot it was edited from (a new
		* edit), or that snapshot already stored the field and the edit left it alone. The
		* second case is what keeps an earlier save from being cleared by any later save
		* the user makes without touching that field.
		*
		* Three states share one flag map, and only these meanings are supported:
		* `true` the field is stored as a user override; `false` the user restored it, so
		* it must not be stored; an absent key the field is untouched. A `true` the snapshot
		* does not corroborate stores nothing: the map is a client signal for actions, and
		* the snapshot is the only record of what was actually written.
		*
		* A row the baseline does not carry is either brand new or absent from the saved
		* membership. There the editor's `true` is the only evidence of a user edit, and a
		* value discovery supplied without one stays the catalog's: adopting a discovered
		* model must not freeze the facts it was built from. A caller with no snapshot at
		* all must not call this: it has nothing to compare against and keeps the row's own
		* flags instead.
		* @param model - the row about to be persisted.
		* @param baseline - the same row in the last accepted snapshot, or undefined when that snapshot does not carry it.
		* @returns fields to write, or undefined when the row stores no override.
		*/
		function catalogOverrideFlags(model, baseline) {
			const flags = {};
			const stored = baseline?.overrides ?? {};
			const store = (name, differs) => {
				if (model.overrides?.[name] === false) return;
				if (differs || stored[name] === true) flags[name] = true;
			};
			/** A row the baseline lacks: the editor's own `true` is the only edit evidence. */
			const storeEdit = (name, source, differs) => {
				if (baseline !== void 0) return store(name, differs);
				if (model.overrides?.[name] === true) return store(name, true);
				if (model.sources?.[source] !== void 0) return;
				store(name, differs);
			};
			store("name", model.name !== baseline?.name);
			storeEdit("vision", "vision", model.vision !== baseline?.vision);
			storeEdit("thinking", "thinking", model.thinking !== baseline?.thinking);
			storeEdit("contextWindow", "contextWindow", model.contextWindow !== baseline?.contextWindow);
			storeEdit("output", "maxOutputTokens", model.maxOutputTokens !== baseline?.maxOutputTokens);
			storeEdit("defaultEffort", "defaultEffort", model.reasoning?.defaultEffort !== baseline?.reasoning?.defaultEffort);
			return Object.keys(flags).length === 0 ? void 0 : flags;
		}
		/** Merge live health/catalog data without overwriting unsaved configuration edits. */
		function mergeSettingsDraft(current, incoming, dirty) {
			if (!dirty || current === void 0 || incoming === void 0 || current.instanceId !== incoming.instanceId || current.stateDirectory !== incoming.stateDirectory) return incoming;
			const next = {
				...incoming,
				enabled: current.enabled,
				executablePath: current.executablePath,
				harnessPath: current.harnessPath,
				models: current.models
			};
			if (current.model === void 0) delete next.model;
			else next.model = current.model;
			return next;
		}
		//#endregion
		//#region src/row-keys.ts
		/**
		* Stable per-row keys across id edits, reorders, and removals. The shared
		* sortable list keys rows by this id, so the key must survive the very edit
		* it identifies; matching prefers id, then position, then mints fresh.
		* A simultaneous reorder plus replacement can inherit a retired key, which only
		* affects expansion state, never saved data.
		* @param previous - keys aligned with the previous rows.
		* @param ids - current row ids in order.
		* @param mint - fresh key factory for unseen rows.
		* @returns keys aligned with the current rows.
		*/
		function syncRowKeys(previous, ids, mint) {
			const free = previous.map((entry) => ({
				...entry,
				used: false
			}));
			const byId = /* @__PURE__ */ new Map();
			free.forEach((entry, index) => {
				const list = byId.get(entry.id) ?? [];
				list.push(index);
				byId.set(entry.id, list);
			});
			const keys = new Array(ids.length);
			const take = (index) => {
				free[index].used = true;
				return free[index].key;
			};
			ids.forEach((id, at) => {
				if (at < free.length && !free[at].used && free[at].id === id) {
					keys[at] = take(at);
					return;
				}
				const found = byId.get(id)?.find((index) => !free[index].used);
				if (found !== void 0) {
					keys[at] = take(found);
					return;
				}
				if (at < free.length && !free[at].used) {
					keys[at] = take(at);
					return;
				}
				keys[at] = mint();
			});
			return keys;
		}
		//#endregion
		//#region src/catalog-group.ts
		/** Peel a trailing `-<n>k` / `-<n>m` context tier. Product names like `-max` stay. */
		function parseCursorContextSuffix(id) {
			const match = /-(\d+)(k|m)$/iu.exec(id);
			if (match === null || match.index === 0) return { base: id };
			const n = Number(match[1]);
			const unit = match[2].toLowerCase();
			return {
				base: id.slice(0, match.index),
				tokens: unit === "m" ? n * 1e6 : n * 1e3
			};
		}
		function cursorBaseFamilyId(id) {
			return parseCursorContextSuffix(id).base;
		}
		/** Strip `-thinking` (a Cursor parameter, not a family) and map `cursor-grok-*` to `grok-*`. */
		function canonicalizeFamilyId(family) {
			const next = family.replace(/-thinking(?=-|$)/gu, "");
			const fast = next.endsWith("-fast") && next.length > 5;
			const core = fast ? next.slice(0, -5) : next;
			const renamed = core.startsWith("cursor-grok-") ? `grok-${core.slice(12)}` : core;
			return fast ? `${renamed}-fast` : renamed;
		}
		function clusterOf(family) {
			const base = cursorBaseFamilyId(canonicalizeFamilyId(family));
			return base.endsWith("-fast") ? base.slice(0, -5) : base;
		}
		function isCursorGrokId(id) {
			return id.startsWith("grok-4.5") || id.startsWith("grok-4.6") || id.startsWith("cursor-grok-");
		}
		/** Infer the lab / first-party brand from a family id and display name. */
		function brandOfCursorFamily(familyId, name = "") {
			const id = clusterOf(familyId).toLowerCase();
			const label = name.toLowerCase();
			if (id === "default" || id === "auto" || id.startsWith("composer") || id.startsWith("cursor-")) return "cursor";
			if (isCursorGrokId(id) || /\bcursor grok\b/u.test(label)) return "cursor";
			if (id.startsWith("grok") || /\bgrok\b/u.test(label)) return "xai";
			if (id.startsWith("gpt") || id.startsWith("chatgpt") || /^o[1-9]/u.test(id) || /\bgpt-/u.test(label)) return "openai";
			if (id.startsWith("claude") || label.includes("claude")) return "anthropic";
			if (id.startsWith("gemini") || label.includes("gemini")) return "google";
			if (id.startsWith("deepseek") || label.includes("deepseek")) return "deepseek";
			if (id.startsWith("kimi") || label.includes("kimi")) return "moonshot";
			if (id.startsWith("glm") || label.includes("glm")) return "zhipu";
			if (id.startsWith("minimax") || label.includes("minimax")) return "minimax";
			if (id.startsWith("mistral") || id.startsWith("codestral") || id.startsWith("devstral") || id.startsWith("magistral") || id.startsWith("pixtral")) return "mistral";
			if (id.startsWith("llama") || label.includes("llama")) return "meta";
			if (id.startsWith("qwen") || label.includes("qwen")) return "alibaba";
			return "other";
		}
		const CURSOR_BRAND_LABELS = {
			cursor: "Cursor",
			openai: "OpenAI",
			anthropic: "Anthropic",
			google: "Google",
			xai: "xAI",
			deepseek: "DeepSeek",
			moonshot: "Moonshot",
			zhipu: "Zhipu",
			minimax: "MiniMax",
			mistral: "Mistral",
			meta: "Meta",
			alibaba: "Alibaba",
			other: "Other"
		};
		/** Partition an already-sorted catalog into brand sections for the picker. */
		function cursorBrandSections(models) {
			const sections = [];
			const index = /* @__PURE__ */ new Map();
			for (const model of models) {
				const brand = brandOfCursorFamily(model.id, model.name ?? "");
				let section = index.get(brand);
				if (section === void 0) {
					section = {
						brand,
						label: CURSOR_BRAND_LABELS[brand],
						models: []
					};
					index.set(brand, section);
					sections.push(section);
				}
				section.models.push(model);
			}
			return sections;
		}
		//#endregion
		//#region src/web/ExternalAgentsSection.tsx
		/** Cursor Agent provider settings: state-driven Install, Sign in, then Account/Quota/Model. Runtime paths stay in backend config only. */
		const button = {
			minHeight: 34,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 18,
			padding: "6px 14px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			cursor: "pointer"
		};
		const primaryButtonStyle = {
			...button,
			borderColor: "var(--dsw-alias-button-primary-fill)",
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)"
		};
		const iconButtonStyle = {
			boxSizing: "border-box",
			width: 28,
			height: 28,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "none",
			border: 0,
			borderRadius: 6,
			padding: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			font: "inherit",
			cursor: "pointer"
		};
		const disclosureStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 8,
			minWidth: 0,
			border: 0,
			padding: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer"
		};
		const sectionTitleStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const hintStyle = {
			margin: 0,
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const actionsStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 10
		};
		const errorStyle = {
			margin: 0,
			fontSize: 13,
			color: "var(--dsw-alias-state-error-primary)"
		};
		const actions = {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: 8
		};
		const section = {
			padding: "18px 0",
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			display: "flex",
			flexDirection: "column",
			gap: 12,
			minWidth: 0
		};
		const muted = {
			margin: 0,
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary)",
			overflowWrap: "anywhere"
		};
		const localCss = "[data-provider-body][hidden]{display:none!important}[data-cursor-agent-quota]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 24px}[data-cursor-agent-heading]{font-size:13px;font-weight:600;margin:0}[data-provider-card=\"cursor-agent\"] [data-provider-header-main]>span:first-child{flex:1 1 190px!important;min-width:190px}[data-provider-card=\"cursor-agent\"] [data-provider-quota-mini]{width:auto!important;flex:1 1 210px!important;min-width:210px!important;max-width:260px!important}[data-provider-card=\"cursor-agent\"] [data-provider-header-status]{flex:0 0 auto!important;width:64px!important}@media(max-width:680px){[data-cursor-agent-quota]{grid-template-columns:1fr}[data-provider-card=\"cursor-agent\"] button,[data-provider-card=\"cursor-agent\"] select,[data-provider-card=\"cursor-agent\"] a,[data-provider-card=\"cursor-agent\"] input:not([type=checkbox]){min-height:44px}}";
		function catalogDraft(model, index) {
			return {
				rowId: model.id === "" ? "manual:" + String(index) : model.id,
				id: model.id,
				...model.name === void 0 ? {} : { name: model.name },
				...model.vision === void 0 ? {} : { vision: model.vision },
				...model.thinking === void 0 ? {} : { thinking: model.thinking },
				...model.contextWindow === void 0 ? {} : { contextWindow: String(model.contextWindow) },
				...model.reasoning?.defaultEffort === void 0 ? {} : { defaultEffort: model.reasoning.defaultEffort },
				...model.reasoning?.efforts === void 0 ? {} : { efforts: model.reasoning.efforts },
				...model.sources === void 0 ? {} : { sources: model.sources },
				...model.overrides === void 0 ? {} : { overrides: model.overrides }
			};
		}
		function IconChevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "12",
				height: "12",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				style: {
					flex: "none",
					transform: open ? "rotate(90deg)" : "none",
					transition: "transform 120ms ease"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6 3.5L10.5 8L6 12.5",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function IconRefresh() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M13.5 8a5.5 5.5 0 11-1.6-3.9M13.5 1.8v2.6h-2.6",
					stroke: "currentColor",
					strokeWidth: "1.4",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function parsePositiveInt(text) {
			if (!/^\d+$/.test(text.trim())) return void 0;
			const value = Number(text.trim());
			return Number.isSafeInteger(value) && value > 0 ? value : void 0;
		}
		/** Render Install at top when missing, Sign in at top when installed, Account/Quota/Model when connected.
		* @param props the live row, snapshot, quota, and state callbacks.
		* @returns the ordered card sections without runtime path internals.
		*/
		function CursorAgentCardBody({ t, row, snapshot, state, quota, quotaError, quotaLoading, working, polling, saving, dirty, onAction, onRefresh, onRefreshModels, onRefreshQuota, onCatalogChange, onPersist, onDiscard, accessKind, mode, detailCopy, sharedTemplate, sharedUsage, onSharedQuotaRefresh }) {
			const kind = accessKind ?? (typeof window === "undefined" ? "remote" : cursorAgentAccessKind(window.location.hostname, window.navigator.userAgent));
			const phase = snapshot.install?.phase;
			const showInstall = state === "missing" || phase === "downloading" || phase === "failed";
			const [menu, setMenu] = (0, react.useState)(false);
			const [confirm, setConfirm] = (0, react.useState)();
			const [expandedModels, setExpandedModels] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [sorting, setSorting] = (0, react.useState)(false);
			const [catalogOpen, setCatalogOpen] = (0, react.useState)(false);
			const [fetching, setFetching] = (0, react.useState)(false);
			const [fetchError, setFetchError] = (0, react.useState)();
			const [pickerError, setPickerError] = (0, react.useState)();
			const [candidates, setCandidates] = (0, react.useState)(null);
			const [picker, setPicker] = (0, react.useState)(false);
			const [picked, setPicked] = (0, react.useState)(/* @__PURE__ */ new Set());
			const rowKeySeq = (0, react.useRef)(0);
			const pendingRowKeys = (0, react.useRef)([]);
			const rowKeys = (0, react.useRef)([]);
			rowKeys.current = (() => {
				const keys = syncRowKeys(rowKeys.current, row.models.map((model) => model.id), () => {
					const queued = pendingRowKeys.current.shift();
					if (queued !== void 0) return queued;
					rowKeySeq.current += 1;
					return "cursor-model-row-" + String(rowKeySeq.current);
				});
				return row.models.map((model, at) => ({
					key: keys[at],
					id: model.id
				}));
			})();
			const drafts = row.models.map((model, index) => ({
				...catalogDraft(model, index),
				rowId: rowKeys.current[index].key
			}));
			const customModels = dirty || row.models.some((model) => model.overrides !== void 0 && Object.keys(model.overrides).length > 0);
			const invalidModels = (() => {
				const seen = /* @__PURE__ */ new Set();
				for (const model of row.models) {
					const id = model.id.trim();
					if (id.length === 0 || seen.has(id)) return true;
					seen.add(id);
				}
				return false;
			})();
			const patchModel = (index, patch) => {
				const current = drafts[index];
				if (current === void 0) return;
				const next = applyCatalogPatch(current, patch);
				onCatalogChange(row.models.map((model, at) => {
					if (at !== index) return model;
					const contextWindow = next.contextWindow === void 0 || next.contextWindow.trim() === "" ? void 0 : parsePositiveInt(next.contextWindow);
					if (next.contextWindow !== void 0 && next.contextWindow.trim() !== "" && contextWindow === void 0) return model;
					const efforts = model.reasoning?.efforts ?? next.efforts ?? [];
					const defaultEffort = next.defaultEffort !== void 0 && efforts.some((effort) => effort.id === next.defaultEffort) ? next.defaultEffort : void 0;
					const patched = patchedOverrideFlags(patch);
					const overrides = patched === void 0 ? model.overrides : {
						...model.overrides,
						...patched
					};
					const updated = {
						...model,
						id: next.id.trim(),
						name: next.name ?? next.id.trim(),
						...next.vision === void 0 ? {} : { vision: next.vision },
						...next.thinking === void 0 ? {} : { thinking: next.thinking },
						...efforts.length === 0 && defaultEffort === void 0 ? {} : { reasoning: {
							efforts,
							...defaultEffort === void 0 ? {} : { defaultEffort }
						} },
						...next.sources === void 0 ? {} : { sources: next.sources },
						...overrides === void 0 ? {} : { overrides }
					};
					if (contextWindow === void 0) delete updated.contextWindow;
					else updated.contextWindow = contextWindow;
					if (next.vision === void 0) delete updated.vision;
					if (next.thinking === void 0) delete updated.thinking;
					if (efforts.length === 0 && defaultEffort === void 0) delete updated.reasoning;
					return updated;
				}));
			};
			const removeModel = (index) => {
				onCatalogChange(row.models.filter((_, at) => at !== index));
			};
			const restoreModelField = (index, field) => {
				const model = row.models[index];
				if (model === void 0) return;
				const next = {
					...model,
					overrides: {
						...model.overrides,
						[field]: false
					}
				};
				onCatalogChange(row.models.map((current, at) => at === index ? next : current));
			};
			const toggleModel = (rowId) => {
				setExpandedModels((current) => {
					const next = new Set(current);
					if (!next.delete(rowId)) next.add(rowId);
					return next;
				});
			};
			const fetchModels = async () => {
				setPicked(new Set(row.models.map((model) => model.id)));
				setCandidates(null);
				setFetchError(void 0);
				setPickerError(void 0);
				setFetching(true);
				setPicker(true);
				try {
					const fresh = await onRefreshModels();
					const freshIds = new Set(fresh.map((model) => model.id));
					const currentOnly = row.models.filter((model) => !freshIds.has(model.id));
					if (fresh.length === 0 && currentOnly.length === 0) {
						setPicker(false);
						setFetchError(t("fetchEmpty"));
						return;
					}
					setCandidates([...fresh, ...currentOnly]);
				} catch (caught) {
					const message = caught instanceof Error && caught.message.length > 0 ? caught.message : t("failed");
					setPickerError(message);
					setFetchError(message);
				} finally {
					setFetching(false);
				}
			};
			const pickerSections = cursorBrandSections(candidates ?? row.models).map((section) => ({
				id: section.brand,
				label: section.label,
				models: section.models.map((model) => ({
					id: model.id,
					name: model.name ?? model.id,
					...model.thinking === true ? { hint: t("thinking") } : {}
				}))
			}));
			const adoptModels = () => {
				const source = candidates ?? row.models;
				const byId = new Map(row.models.map((model) => [model.id, model]));
				const selected = [];
				for (const id of picked) {
					const candidate = source.find((model) => model.id === id);
					if (candidate === void 0) continue;
					const previous = byId.get(id);
					selected.push(previous ?? candidate);
				}
				onCatalogChange(selected);
				setCandidates(null);
				setPicker(false);
				setCatalogOpen(true);
			};
			const modelPicker = /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelPickerDialog, {
				open: picker,
				loading: fetching,
				...pickerError === void 0 ? {} : { error: pickerError },
				labels: {
					title: t("pickerTitle"),
					description: t("pickerDescription"),
					search: t("pickerSearch"),
					loading: t("pickerLoading"),
					empty: t("pickerEmpty"),
					cancel: t("cancel"),
					apply: t("applySelected"),
					close: t("cancel")
				},
				sections: pickerSections,
				picked,
				onClose: () => {
					setPicker(false);
					setCandidates(null);
				},
				onToggle: (id) => setPicked((current) => {
					const next = new Set(current);
					if (!next.delete(id)) next.add(id);
					return next;
				}),
				onApply: adoptModels
			});
			const loginActive = state === "login";
			const loginUrl = row.authorizationUrl;
			const installBlock = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "c-control",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...muted,
							margin: 0
						},
						children: row.message ?? t("missingBadge")
					}),
					snapshot.install && phase !== "idle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						role: "status",
						className: "c-field-hint",
						style: { paddingLeft: 0 },
						children: [snapshot.install.message, snapshot.install.totalBytes > 0 && polling ? " " + Math.round(100 * snapshot.install.downloadedBytes / snapshot.install.totalBytes) + "%" : ""]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: 8,
							marginTop: 6
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: button,
							disabled: working || polling,
							onClick: () => onAction("install-runtime"),
							children: polling ? t("installing") : t("install")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: button,
							disabled: working || polling,
							onClick: onRefresh,
							children: t("rescan")
						})]
					})
				]
			});
			const accountActions = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: actions,
				children: row.authenticated ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: {
						display: "inline-flex",
						gap: 8
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: iconButtonStyle,
						"aria-label": t("rescan"),
						title: t("rescan"),
						disabled: working || polling,
						onClick: onRefresh,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRefresh, {})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: button,
						onClick: () => setMenu((open) => !open),
						children: t("manageAccount")
					})]
				}) : snapshot.signingIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: button,
					disabled: working,
					onClick: () => onAction("cancel-login"),
					children: t("cancel")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: button,
					disabled: working || polling || !row.installed,
					onClick: () => onAction("sign-in"),
					children: t("signIn")
				})
			});
			const accountBody = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				menu && row.authenticated && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: actions,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: button,
						onClick: () => setConfirm("switch"),
						children: t("switchAccount")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: button,
						onClick: () => setConfirm("logout"),
						children: t("signOut")
					})]
				}),
				state === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 8
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						style: errorStyle,
						children: row.message ?? t("errorBadge")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: actions,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: button,
							disabled: working || polling,
							onClick: onRefresh,
							children: t("rescan")
						})
					})]
				}),
				loginActive && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 8
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: muted,
							children: t(cursorAgentAccessHintKey(kind))
						}),
						snapshot.signingIn && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							style: muted,
							children: t("loginWaiting")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: actions,
							children: [loginUrl && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								href: loginUrl,
								target: "_blank",
								rel: "noopener noreferrer",
								style: {
									...button,
									textDecoration: "none",
									display: "inline-flex",
									alignItems: "center"
								},
								children: t("openLogin")
							}), loginUrl && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: button,
								onClick: () => {
									navigator.clipboard?.writeText(loginUrl);
								},
								children: t("copyLogin")
							})]
						}),
						loginUrl && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: {
								...muted,
								overflowWrap: "anywhere"
							},
							children: loginUrl
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: muted,
							children: t("loginCli")
						})
					]
				}),
				confirm && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "dialog",
					"aria-modal": "true",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: muted,
						children: t(confirm === "switch" ? "confirmSwitch" : "confirmSignOut")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: button,
							onClick: () => setConfirm(void 0),
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: button,
							onClick: () => {
								setConfirm(void 0);
								setMenu(false);
								onAction("sign-out");
							},
							children: t(confirm === "switch" ? "switchAccount" : "signOut")
						})]
					})]
				})
			] });
			const modelsList = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelCatalogEditor, {
				items: drafts,
				fields: {
					vision: true,
					thinking: true,
					defaultEffort: true,
					context: true
				},
				labels: {
					modelId: t("modelId"),
					modelName: t("modelName"),
					modelDetails: t("modelDetails"),
					remove: t("removeModel"),
					drag: t("dragModel"),
					moveUp: t("moveUp"),
					moveDown: t("moveDown"),
					vision: t("vision"),
					thinking: t("thinking"),
					defaultEffort: t("defaultEffort"),
					contextWindow: t("contextWindow"),
					contextWindowDefault: t("unknown"),
					unknown: t("unknown"),
					supported: t("supported"),
					unsupported: t("unsupported"),
					restoreAuto: t("restoreAuto")
				},
				disabled: saving,
				sorting,
				expanded: expandedModels,
				onReorder: (items) => {
					const byId = new Map(row.models.map((model) => [model.id, model]));
					onCatalogChange(items.map((item) => byId.get(item.rowId) ?? byId.get(item.id) ?? {
						id: item.id,
						name: item.name ?? item.id
					}));
				},
				onPatch: (index, patch) => {
					patchModel(index, patch);
				},
				onRestore: (index, field) => {
					restoreModelField(index, field);
				},
				onRemove: (index) => {
					removeModel(index);
				},
				onToggle: (rowId) => {
					toggleModel(rowId);
				}
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				style: {
					...button,
					alignSelf: "flex-start"
				},
				disabled: saving,
				onClick: () => {
					rowKeySeq.current += 1;
					const rowId = "cursor-model-row-" + String(rowKeySeq.current);
					pendingRowKeys.current.push(rowId);
					onCatalogChange([...row.models, {
						id: "",
						name: ""
					}]);
					setExpandedModels((current) => new Set(current).add(rowId));
				},
				children: t("addModel")
			})] });
			const draftBlock = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [invalidModels ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				style: errorStyle,
				children: t("invalidModels")
			}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: actionsStyle,
				children: [
					dirty && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							...muted,
							marginRight: "auto"
						},
						children: t("unsaved")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: button,
						disabled: !dirty || saving,
						onClick: onDiscard,
						children: t("cancel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: primaryButtonStyle,
						disabled: !dirty || invalidModels || saving || working,
						onClick: onPersist,
						children: t(saving ? "saving" : "save")
					})
				]
			})] });
			/** Provider-specific fields for one expanded model row; shared by both layouts. */
			const modelExtra = (model, index) => {
				const draft = catalogDraft(model, index);
				const efforts = model.reasoning?.efforts ?? [];
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "c-extra-grid",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "c-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "c-field-label",
								children: t("contextWindow")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "c-input",
								inputMode: "numeric",
								value: draft.contextWindow ?? "",
								disabled: saving,
								"aria-label": t("contextWindow"),
								onChange: (event) => {
									patchModel(index, { contextWindow: event.target.value });
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "c-extra-checks",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: model.vision === true,
								disabled: saving,
								onChange: (event) => {
									patchModel(index, { vision: event.target.checked });
								}
							}), t("vision")] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: model.thinking === true,
								disabled: saving,
								onChange: (event) => {
									patchModel(index, { thinking: event.target.checked });
								}
							}), t("thinking")] })]
						}),
						efforts.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "c-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "c-field-label",
								children: t("defaultEffort")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
								className: "c-input",
								value: model.reasoning?.defaultEffort ?? "",
								disabled: saving,
								"aria-label": t("defaultEffort"),
								onChange: (event) => {
									patchModel(index, { defaultEffort: event.target.value });
								},
								children: efforts.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: effort.id,
									children: effort.name ?? effort.id
								}, effort.id))
							})]
						}),
						model.overrides?.contextWindow === true || model.overrides?.vision === true || model.overrides?.thinking === true || model.overrides?.defaultEffort === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: button,
							disabled: saving,
							onClick: () => {
								const overrides = {
									...model.overrides,
									contextWindow: false,
									vision: false,
									thinking: false,
									defaultEffort: false
								};
								onCatalogChange(row.models.map((current, at) => at === index ? {
									...current,
									overrides
								} : current));
							},
							children: t("restoreAuto")
						}) : null
					]
				});
			};
			if (mode === "detail" && sharedTemplate !== void 0 && detailCopy !== void 0) {
				const SharedDetail = sharedTemplate;
				const allOpen = drafts.length > 0 && drafts.every((draft) => expandedModels.has(draft.rowId));
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SharedDetail, {
					name: "Cursor",
					role: "agent",
					mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
					copy: detailCopy,
					account: {
						state: row.authenticated ? "connected" : "unconnected",
						label: row.authenticated ? row.accountEmail ?? t("connected") : state === "missing" ? t("missingBadge") : state === "error" ? t("errorBadge") : t("authBadge"),
						meta: t("loginCli"),
						actions: accountActions,
						body: accountBody
					},
					quota: {
						status: row.authenticated ? sharedUsage?.status ?? "loading" : "logged-out",
						windows: row.authenticated ? sharedUsage?.windows ?? [] : [],
						...onSharedQuotaRefresh === void 0 ? {} : { onRefresh: onSharedQuotaRefresh }
					},
					models: {
						count: row.models.length,
						allOpen,
						onToggleAll: () => {
							setExpandedModels(allOpen ? /* @__PURE__ */ new Set() : new Set(drafts.map((draft) => draft.rowId)));
						},
						sorting,
						onToggleSorting: () => {
							setSorting((current) => !current);
						},
						sortDisabled: saving || row.models.length < 2,
						onChooseFromAccount: () => {
							fetchModels();
						},
						chooseDisabled: fetching || saving || !row.authenticated,
						items: row.models.map((model, index) => {
							const draft = catalogDraft(model, index);
							return {
								rowId: draft.rowId,
								id: draft.id,
								...draft.name === void 0 ? {} : { name: draft.name }
							};
						}),
						expanded: [...expandedModels],
						onPatch: (rowId, patch) => {
							const index = row.models.findIndex((model, at) => catalogDraft(model, at).rowId === rowId);
							if (index >= 0) patchModel(index, patch);
						},
						onRemove: (rowId) => {
							const index = row.models.findIndex((model, at) => catalogDraft(model, at).rowId === rowId);
							if (index >= 0) removeModel(index);
						},
						onToggle: (rowId) => {
							toggleModel(rowId);
						},
						onReorder: (rowIds) => {
							const byId = new Map(row.models.map((model, at) => [catalogDraft(model, at).rowId, model]));
							const next = rowIds.map((rowId) => byId.get(rowId)).filter((model) => model !== void 0);
							if (next.length === row.models.length) onCatalogChange(next);
						},
						onAdd: () => {
							rowKeySeq.current += 1;
							const rowId = "cursor-model-row-" + String(rowKeySeq.current);
							pendingRowKeys.current.push(rowId);
							onCatalogChange([...row.models, {
								id: "",
								name: ""
							}]);
							setExpandedModels((current) => new Set(current).add(rowId));
						},
						addDisabled: saving,
						extra: (rowItem) => {
							const index = row.models.findIndex((model, at) => catalogDraft(model, at).rowId === rowItem.rowId);
							const model = row.models[index];
							return index < 0 || model === void 0 ? null : modelExtra(model, index);
						}
					},
					advanced: installBlock,
					draft: draftBlock
				}), modelPicker] });
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				showInstall && installBlock,
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: section,
					className: "compact",
					children: [accountActions, accountBody]
				}),
				state === "connected" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: section,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								...actions,
								justifyContent: "space-between"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								"data-cursor-agent-heading": true,
								children: t("quota")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: button,
								disabled: !row.authenticated || quotaLoading || working,
								onClick: onRefreshQuota,
								children: quotaLoading ? t("loading") : t("refreshQuota")
							})]
						}),
						quotaError && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							role: "status",
							style: muted,
							children: [quotaError, quota ? " · " + t("staleQuota") : ""]
						}),
						!quota && !quotaError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: muted,
							children: t("quotaUnavailable")
						}),
						quota?.groups.map((group, gi) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							"data-cursor-agent-heading": true,
							children: group.displayName ?? t("quota")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							"data-cursor-agent-quota": true,
							children: group.buckets.map((bucket, bi) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderQuotaMeter, {
								label: bucket.displayName ?? bucket.window ?? t("quota"),
								...bucket.disabled || bucket.remainingFraction === void 0 ? {} : { remainingPercent: headlineRemainingPercent(bucket.remainingFraction) },
								emptyLabel: bucket.disabled ? t("disabledBadge") : t("quotaUnavailable"),
								...bucket.resetTime ? { detail: t("resetsAt") + " " + new Date(bucket.resetTime).toLocaleString() } : {}
							}) }, bucket.bucketId ?? bi))
						})] }, gi)),
						quota && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							style: muted,
							children: [
								t("updatedAt"),
								" ",
								new Date(quota.observedAt).toLocaleString()
							]
						})
					]
				}),
				state === "connected" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: section,
					"aria-label": t("model"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 10
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								style: disclosureStyle,
								"aria-expanded": catalogOpen,
								"aria-label": t("model"),
								onClick: () => {
									setCatalogOpen(!catalogOpen);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { open: catalogOpen }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: sectionTitleStyle,
										children: t("model")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: hintStyle,
										children: customModels ? t("customized") : t("inherited")
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									display: "inline-flex",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: button,
									"aria-pressed": sorting,
									disabled: saving || row.models.length < 2,
									onClick: () => {
										setSorting((current) => !current);
									},
									children: t(sorting ? "doneSorting" : "sortModels")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: button,
									disabled: fetching || saving || !row.authenticated,
									onClick: () => {
										fetchModels();
									},
									children: t(fetching ? "fetchingModels" : "fetchModels")
								})]
							})]
						}),
						fetchError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							style: errorStyle,
							children: fetchError
						}),
						catalogOpen ? modelsList : null,
						modelPicker
					]
				}),
				draftBlock
			] });
		}
		/** Provider card container: live snapshot, quota, install/sign-in actions, and shared header.
		* @param props the injected Settings face.
		* @returns the collapsible Cursor provider card.
		*/
		function ExternalAgentsSection({ t, load, save, run, quota: readQuota, ...slot }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [snapshot, setSnapshot] = (0, react.useState)();
			const [draft, setDraft] = (0, react.useState)();
			const [dirty, setDirty] = (0, react.useState)(false);
			const dirtyRef = (0, react.useRef)(false);
			const snapshotRef = (0, react.useRef)();
			const [saving, setSaving] = (0, react.useState)(false);
			const [working, setWorking] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const [quota, setQuota] = (0, react.useState)();
			const [quotaError, setQuotaError] = (0, react.useState)();
			const [quotaLoading, setQuotaLoading] = (0, react.useState)(false);
			const epoch = (0, react.useRef)(0);
			const quotaEpoch = (0, react.useRef)(0);
			const quotaAbort = (0, react.useRef)();
			const mounted = (0, react.useRef)(false);
			const fail = (caught) => {
				if (mounted.current) setError(caught instanceof Error ? caught.message : t("failed"));
			};
			const clearQuota = () => {
				dropPersistedUsageKeys(["cursor-agent"]);
				quotaEpoch.current++;
				quotaAbort.current?.abort();
				setQuota(void 0);
				setQuotaError(void 0);
				setQuotaLoading(false);
			};
			const accept = (next) => {
				const previous = snapshotRef.current?.rows[0], incoming = next.rows[0];
				if (shouldClearQuota(previous, incoming)) clearQuota();
				snapshotRef.current = next;
				setSnapshot(next);
				setDraft((current) => mergeSettingsDraft(current, incoming, dirtyRef.current));
			};
			const fetchQuota = async () => {
				if (slot.mode === "detail") return;
				quotaAbort.current?.abort();
				const controller = new AbortController(), request = ++quotaEpoch.current;
				quotaAbort.current = controller;
				setQuotaLoading(true);
				try {
					const next = await readQuota(controller.signal);
					if (!mounted.current || request !== quotaEpoch.current) return;
					if (next.status === "ready") {
						setQuota(next);
						setQuotaError(void 0);
						next.groups.flatMap((group) => group.buckets.map((bucket) => ({
							group: group.displayName,
							bucket
						}))).find((item) => !item.bucket.disabled && item.bucket.remainingFraction !== void 0);
					} else {
						if (next.status !== "error") clearQuota();
						setQuotaError(next.message ?? t("quotaUnavailable"));
					}
				} catch (caught) {
					if (mounted.current && request === quotaEpoch.current && !controller.signal.aborted) setQuotaError(caught instanceof Error ? caught.message : t("quotaUnavailable"));
				} finally {
					if (mounted.current && request === quotaEpoch.current) setQuotaLoading(false);
				}
			};
			const refresh = async () => {
				const request = ++epoch.current;
				let next = await load();
				if (!mounted.current || request !== epoch.current) return;
				accept(next);
				if ((next.rows[0]?.executablePath ?? "").trim() === "") {
					try {
						await run("probe-installation");
						next = await load();
					} catch {}
					if (!mounted.current || request !== epoch.current) return;
					accept(next);
				}
				if (next.rows[0]?.authenticated) await fetchQuota();
			};
			(0, react.useEffect)(() => {
				mounted.current = true;
				refresh().catch(fail);
				return () => {
					mounted.current = false;
					epoch.current++;
					quotaEpoch.current++;
					quotaAbort.current?.abort();
				};
			}, [load, readQuota]);
			const phase = snapshot?.install?.phase;
			const polling = snapshot?.signingIn === true || phase === "downloading";
			(0, react.useEffect)(() => {
				if (!polling) return;
				let stopped = false, pending = false;
				const timer = window.setInterval(() => {
					if (pending) return;
					pending = true;
					const request = epoch.current;
					load().then((next) => {
						if (!stopped && request === epoch.current && mounted.current) accept(next);
					}).catch(fail).finally(() => {
						pending = false;
					});
				}, 500);
				return () => {
					stopped = true;
					window.clearInterval(timer);
				};
			}, [polling, load]);
			(0, react.useEffect)(() => {
				if (snapshot?.rows[0]?.authenticated) fetchQuota();
			}, [snapshot?.rows[0]?.authenticated]);
			const change = (row) => {
				dirtyRef.current = true;
				setDirty(true);
				setDraft(row);
			};
			const refreshModels = async () => {
				if (working) throw new Error(t("loading"));
				setWorking(true);
				setError(void 0);
				epoch.current++;
				try {
					const fresh = decodeCatalogModels(await run("refresh-models"));
					if (fresh === void 0) throw new Error(t("failed"));
					return fresh;
				} finally {
					if (mounted.current) setWorking(false);
				}
			};
			const action = async (name, value) => {
				if (working) return;
				setWorking(true);
				setError(void 0);
				epoch.current++;
				if (name === "sign-in" || name === "sign-out") clearQuota();
				try {
					await run(name, value);
					await refresh();
				} catch (caught) {
					fail(caught);
				} finally {
					if (mounted.current) setWorking(false);
				}
			};
			const persist = async () => {
				if (!draft || saving) return;
				setSaving(true);
				setError(void 0);
				try {
					await save(draft);
					dirtyRef.current = false;
					setDirty(false);
					await refresh();
				} catch (caught) {
					fail(caught);
				} finally {
					if (mounted.current) setSaving(false);
				}
			};
			const row = draft;
			const state = resolveCursorAgentCardState(row);
			const status = row === void 0 ? t("loading") : !row.enabled ? t("disabledBadge") : state === "missing" ? t("missingBadge") : state === "error" ? t("errorBadge") : state === "login" ? t("authBadge") : t("connected");
			const first = quota?.groups.flatMap((group) => group.buckets.map((bucket) => ({
				group: group.displayName,
				bucket
			}))).find((item) => !item.bucket.disabled && item.bucket.remainingFraction !== void 0);
			const resetDetail = first?.bucket.resetTime === void 0 ? void 0 : t("resetsAt") + " " + new Date(first.bucket.resetTime).toLocaleString();
			const liveQuota = first === void 0 ? null : {
				remainingPercent: headlineRemainingPercent(first.bucket.remainingFraction),
				label: [first.group, first.bucket.window ?? first.bucket.displayName].filter(Boolean).join(" · "),
				...resetDetail === void 0 ? {} : { detail: resetDetail }
			};
			const signedOut = snapshot !== void 0 && snapshot.rows[0]?.authenticated !== true;
			const headerQuota = useProviderQuotaCache("cursor-agent", "Cursor", liveQuota ?? null, {
				answered: snapshot !== void 0,
				signedOut,
				withheld: signedOut || quotaError !== void 0 || quota !== void 0 && first === void 0
			});
			if (slot.mode === "detail" && row && snapshot) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				style: errorStyle,
				children: error
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CursorAgentCardBody, {
				t,
				row,
				snapshot,
				state,
				...quota === void 0 ? {} : { quota },
				...quotaError === void 0 ? {} : { quotaError },
				quotaLoading,
				working,
				polling,
				saving,
				dirty,
				mode: "detail",
				...slot.copy === void 0 ? {} : { detailCopy: slot.copy },
				...slot.template === void 0 ? {} : { sharedTemplate: slot.template },
				...slot.usage === void 0 ? {} : { sharedUsage: slot.usage },
				...slot.onRefresh === void 0 ? {} : { onSharedQuotaRefresh: slot.onRefresh },
				onAction: (name, value) => void action(name, value),
				onRefresh: () => void action("refresh-status"),
				onRefreshModels: refreshModels,
				onRefreshQuota: () => void fetchQuota(),
				onCatalogChange: (models) => change({
					...row,
					models
				}),
				onPersist: () => void persist(),
				onDiscard: () => {
					dirtyRef.current = false;
					setDirty(false);
					setDraft(snapshot.rows[0]);
				}
			})] });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"data-provider-card": "cursor-agent",
				"data-provider-role": "agent",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: providerUiCss + localCss }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"data-provider-card-header": true,
						"aria-expanded": open,
						onClick: () => setOpen(!open),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderCardHeader, {
							title: "Cursor",
							mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
							role: "agent",
							summary: row === void 0 ? "" : t("modelCount").replace("{count}", String(row.models.length)),
							status,
							open,
							unsaved: dirty,
							unsavedLabel: t("unsaved"),
							...headerQuota === void 0 ? {} : { quota: headerQuota }
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						"data-provider-body": true,
						hidden: !open,
						children: [error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							style: {
								...muted,
								color: "var(--dsw-alias-state-error-primary)"
							},
							children: error
						}), row && snapshot ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CursorAgentCardBody, {
							t,
							row,
							snapshot,
							state,
							...quota === void 0 ? {} : { quota },
							...quotaError === void 0 ? {} : { quotaError },
							quotaLoading,
							working,
							polling,
							saving,
							dirty,
							onAction: (name, value) => void action(name, value),
							onRefresh: () => void action("refresh-status"),
							onRefreshModels: refreshModels,
							onRefreshQuota: () => void fetchQuota(),
							onCatalogChange: (models) => change({
								...row,
								models
							}),
							onPersist: () => void persist(),
							onDiscard: () => {
								dirtyRef.current = false;
								setDirty(false);
								setDraft(snapshot.rows[0]);
							}
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							style: muted,
							children: t("loading")
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/web/locales.ts
		/** Provider settings copy shared by the native ACP card and quota reader. */
		const en = {
			nav: "External Agents",
			title: "Cursor",
			intro: "Uses the official Cursor CLI on this host. Sign-in is cursor-agent login.",
			rescan: "Refresh status",
			save: "Save",
			saved: "Saved",
			saving: "Saving…",
			cancel: "Discard",
			failed: "Settings operation failed",
			signIn: "Sign in",
			signOut: "Sign out",
			openLogin: "Open Cursor login on this device",
			pasteCallback: "Unused. Sign-in uses the DeepControl link, not a 127.0.0.1 paste.",
			callbackUrl: "Redirect address",
			submitCallback: "Continue sign-in",
			accessLocal: "Sign-in runs cursor-agent login on this computer.",
			accessLan: "Open the loginDeepControl link on this device. The host CLI waits for that login.",
			accessRemote: "Open the loginDeepControl link in this phone browser. The host CLI waits for that login.",
			accessApp: "Open or copy the loginDeepControl link into the system browser. The host CLI waits for that login.",
			signOutHint: "Sign out runs cursor-agent logout on this host.",
			installHint: "Installs the official Cursor CLI on this host, then refreshes.",
			installCommand: "curl https://cursor.com/install -fsS | bash",
			installDocs: "Cursor CLI install docs",
			loginCli: "This is cursor-agent login. It signs in the CLI on the host, not dsh-llm-cursor.",
			enabledBadge: "Enabled",
			disabledBadge: "Disabled",
			missingBadge: "Not installed",
			authBadge: "Sign-in required",
			errorBadge: "Connection failed",
			connected: "Connected",
			model: "Models",
			install: "Install Cursor",
			installing: "Installing…",
			signingIn: "Opening Cursor sign-in…",
			loading: "Loading…",
			quota: "Account quota",
			quotaUnavailable: "Quota unavailable",
			refreshQuota: "Refresh quota",
			staleQuota: "Previous snapshot; refresh failed",
			resetsAt: "Resets",
			updatedAt: "Updated",
			account: "Account",
			enableProvider: "Enable provider",
			unsaved: "Unsaved changes",
			modelCount: "{count} models",
			refreshModels: "Refresh models",
			fetchModels: "Fetch available models",
			fetchingModels: "Fetching models…",
			addModel: "Add model manually",
			customized: "Custom catalog",
			inherited: "Using the composed catalog",
			defaultModel: "Default model",
			accountDefault: "Account default",
			nativeModels: "Availability comes from native ACP. Context prefers the advertised context option, then Cursor published defaults, otherwise unknown.",
			manageAccount: "Manage account",
			switchAccount: "Switch account",
			copyLogin: "Copy login link",
			loginStep1: "Open the Cursor sign-in page",
			loginStep2: "Paste the redirect address",
			loginWaiting: "Waiting for Cursor sign-in to finish.",
			confirmSignOut: "Sign out runs cursor-agent logout on this host (CLI sharing this login will sign out too).",
			confirmSwitch: "Switch account signs out the host CLI first. Sign in again with the new account.",
			vision: "Vision",
			thinking: "Reasoning",
			defaultEffort: "Default thinking",
			contextWindow: "Context window",
			inputLimit: "Input limit",
			output: "Max output",
			unknown: "Unknown",
			supported: "Yes",
			unsupported: "No",
			restoreAuto: "Restore auto",
			source: "Source: {source}",
			modelId: "Model ID",
			modelName: "Display name",
			modelDetails: "Details",
			dragModel: "Drag to reorder",
			moveUp: "Move up",
			moveDown: "Move down",
			invalidModels: "Every model needs a unique ID.",
			removeModel: "Remove",
			sortModels: "Sort",
			doneSorting: "Done",
			pickerTitle: "Choose models",
			pickerDescription: "Select models from the native account catalog.",
			pickerSearch: "Search",
			pickerLoading: "Loading models…",
			pickerEmpty: "No matching models",
			applySelected: "Apply",
			fetchEmpty: "The endpoint returned no models.",
			declaredDefault: "Account default model",
			followNative: "Follow native",
			activityRunning: "{count} native tools running",
			activityTools: "{count} native tools",
			activityBetweenTurns: "Outside this turn's recorded interval; ownership unavailable.",
			statusPending: "Pending",
			statusRunning: "Running",
			statusCompleted: "Completed",
			statusFailed: "Failed",
			activitySubagent: "Subagent",
			activityChildEmpty: "No native tools yet",
			activityChildUnknown: "Child status unavailable",
			activityFailed: "Native tool activity is unavailable",
			activityRetry: "Retry",
			activityNoOutput: "No displayable output.",
			activityThink: "Think",
			activityInput: "Input",
			activityOutput: "Output",
			jsonTruncated: "{total} characters",
			markdownCopy: "Copy",
			markdownCopied: "Copied",
			markdownFootnotes: "Footnotes",
			activityDownload: "Download"
		};
		const zh = {
			nav: "外部 Agent",
			title: "Cursor",
			intro: "用本机官方 Cursor CLI。登录即 cursor-agent login。",
			rescan: "刷新状态",
			save: "保存",
			saved: "已保存",
			saving: "保存中…",
			cancel: "放弃更改",
			failed: "设置操作失败",
			signIn: "登录",
			signOut: "退出登录",
			openLogin: "打开登录页",
			pasteCallback: "已不使用。登录走 loginDeepControl 链接。",
			callbackUrl: "跳转地址",
			submitCallback: "继续登录",
			accessLocal: "本机浏览器会自动完成 Cursor 回调。换账号：先退出再登录。",
			accessLan: "在这台设备打开 loginDeepControl 链接，主机 CLI 会等这次登录。",
			accessRemote: "用手机浏览器打开 loginDeepControl 链接，主机 CLI 会等这次登录。",
			accessApp: "打开或复制 loginDeepControl 链接到系统浏览器。主机 CLI 会等这次登录。",
			signOutHint: "退出登录只清掉本实例的 Cursor 资料。再登录时用你打开这个页面的同一条路径。",
			installHint: "在这台主机后台安装官方 Cursor CLI，然后自动刷新。",
			installCommand: "curl https://cursor.com/install -fsS | bash",
			installDocs: "Cursor CLI 安装文档",
			loginCli: "这是 cursor-agent login，登的是主机 CLI，不是 dsh-llm-cursor。",
			enabledBadge: "已启用",
			disabledBadge: "已禁用",
			missingBadge: "未安装",
			authBadge: "需要登录",
			errorBadge: "连接失败",
			connected: "已连接",
			model: "模型",
			install: "安装 Cursor",
			installing: "安装中…",
			signingIn: "正在打开 Cursor 登录…",
			loading: "加载中…",
			quota: "账户额度",
			quotaUnavailable: "额度暂不可用",
			refreshQuota: "刷新额度",
			staleQuota: "刷新失败，显示上次快照",
			resetsAt: "重置时间",
			updatedAt: "更新时间",
			account: "账户",
			enableProvider: "启用 Provider",
			unsaved: "有未保存修改",
			modelCount: "{count} 个模型",
			refreshModels: "更新模型目录",
			fetchModels: "获取可用模型",
			fetchingModels: "正在获取模型…",
			addModel: "手动添加模型",
			customized: "自定义模型目录",
			inherited: "正在使用组合层模型目录",
			defaultModel: "默认模型",
			accountDefault: "跟随账户默认",
			nativeModels: "可选模型以 ACP 为准；上下文优先用广告的 context 选项，其次 Cursor 文档默认值，否则为未知。",
			manageAccount: "管理账户",
			switchAccount: "更换账户",
			copyLogin: "复制登录链接",
			loginStep1: "打开 Cursor 登录页",
			loginStep2: "回传跳转地址",
			loginWaiting: "等待 Cursor 授权完成。",
			confirmSignOut: "退出登录会在这台主机执行 cursor-agent logout，共用该登录的 CLI 也会退出。",
			confirmSwitch: "换号会先退出主机 CLI。再用新账号登录。",
			vision: "视觉",
			thinking: "推理",
			defaultEffort: "默认思考",
			contextWindow: "上下文窗口",
			inputLimit: "输入上限",
			output: "最大输出",
			unknown: "未知",
			supported: "支持",
			unsupported: "不支持",
			restoreAuto: "恢复自动",
			source: "来源：{source}",
			modelId: "模型 ID",
			modelName: "显示名称",
			modelDetails: "详细设置",
			dragModel: "拖动调整顺序",
			moveUp: "上移",
			moveDown: "下移",
			invalidModels: "每个模型必须有唯一 ID。",
			removeModel: "删除",
			sortModels: "排序",
			doneSorting: "完成排序",
			pickerTitle: "选择模型",
			pickerDescription: "从当前账户的原生目录勾选模型。",
			pickerSearch: "搜索",
			pickerLoading: "正在加载模型…",
			pickerEmpty: "没有匹配的模型",
			applySelected: "应用",
			fetchEmpty: "端点没有返回任何模型。",
			declaredDefault: "账户声明的默认模型",
			followNative: "跟随原生",
			activityRunning: "{count} 个原生工具进行中",
			activityTools: "{count} 个原生工具",
			activityBetweenTurns: "不在本轮记录区间内；所属轮次未确认。",
			statusPending: "待处理",
			statusRunning: "进行中",
			statusCompleted: "已完成",
			statusFailed: "失败",
			activitySubagent: "子代理",
			activityChildEmpty: "尚无原生工具",
			activityChildUnknown: "子任务状态不可用",
			activityFailed: "原生工具动态暂不可用",
			activityRetry: "重试",
			activityNoOutput: "无可显示的输出。",
			activityThink: "思考",
			activityInput: "输入",
			activityOutput: "输出",
			jsonTruncated: "{total} 个字符",
			markdownCopy: "复制",
			markdownCopied: "已复制",
			markdownFootnotes: "脚注",
			activityDownload: "下载"
		};
		//#endregion
		//#region src/web/index.ts
		const name = "dsh-acp-cursor-client";
		const inject = [
			"slots",
			"locale",
			"connection",
			"uiConversation"
		];
		/** Grace period for dsh-llm-providers-ui to register the providers settings section. */
		const MISSING_OWNER_GRACE_MS = 15e3;
		function installProviderDirectory(ctx, modelCount, extras) {
			ctx.inject(["providerDirectory"], (scope) => {
				scope.effect(() => {
					const declaration = Object.assign({
						key: "cursor-agent",
						name: "Cursor",
						role: "agent",
						header: "shared",
						detail: "shared",
						usage: createCursorAgentUsageReader(),
						modelCount
					}, {
						catalogId: "cursor-agent",
						account: extras.account,
						binding: extras.binding
					});
					return scope.providerDirectory.register(declaration);
				}, "dsh-acp-cursor: provider directory registration");
			});
		}
		function apply(ctx) {
			const localeNamespace = "settings.acp-cursor";
			ctx.effect(() => ctx.locale.register(localeNamespace, {
				zh,
				en
			}), "dsh-acp-cursor: Settings page copy");
			const t = ctx.locale.bind(localeNamespace);
			const { rpc } = ctx.connection;
			const invalidateUsage = () => {
				dropPersistedUsageKeys(["cursor-agent"]);
				ctx.get("providerDirectory")?.invalidateUsage("cursor-agent");
			};
			let acceptedRow;
			const account = { state: "unknown" };
			let closed = false;
			const publishAccount = (state) => {
				if (closed || account.state === state) return;
				account.state = state;
				ctx.get("providerDirectory")?.update?.("cursor-agent");
			};
			installProviderDirectory(ctx, () => acceptedRow?.models.length, {
				account: () => ({ state: account.state }),
				binding: {
					channel: ACP_SETTINGS_RPC_CHANNEL,
					endpoint: ACTIVITY_BINDING_ENDPOINT
				}
			});
			const load = async () => {
				const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, SNAPSHOT_ENDPOINT, {}, void 0);
				if (!result.ok) throw new Error(result.error.message);
				const decoded = decodeSnapshot(result.value);
				if (decoded === void 0) throw new Error(t("failed"));
				if (closed) return decoded;
				if (shouldClearQuota(acceptedRow, decoded.rows[0])) invalidateUsage();
				acceptedRow = decoded.rows[0];
				if (acceptedRow !== void 0) publishAccount(acceptedRow.authenticated ? "connected" : "unconnected");
				return decoded;
			};
			const quota = async (signal) => {
				const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, QUOTA_ENDPOINT, {}, signal);
				if (!result.ok) throw new Error(result.error.message);
				const decoded = decodeQuotaSnapshot(result.value);
				if (decoded === void 0) throw new Error(t("quotaUnavailable"));
				if (decoded.status === "account-changed" || decoded.status === "authentication-required" || decoded.status === "not-entitled") invalidateUsage();
				return decoded;
			};
			const save = async (row) => {
				const catalogOrder = row.models.map((model) => model.id).filter((id) => id.trim().length > 0);
				const catalogOverrides = {};
				const edited = acceptedRow === void 0 ? void 0 : new Map(acceptedRow.models.map((model) => [model.id, model]));
				for (const model of row.models) {
					const flags = edited === void 0 ? model.overrides : catalogOverrideFlags(model, edited.get(model.id));
					if (flags === void 0) continue;
					const over = {
						id: model.id,
						name: model.name
					};
					if (flags.vision === true && typeof model.vision === "boolean") over.vision = model.vision;
					if (flags.thinking === true && typeof model.thinking === "boolean") over.thinking = model.thinking;
					if (flags.contextWindow === true && model.contextWindow !== void 0) over.contextWindow = model.contextWindow;
					if (flags.output === true && model.maxOutputTokens !== void 0) over.maxOutputTokens = model.maxOutputTokens;
					if (flags.defaultEffort === true && model.reasoning?.defaultEffort !== void 0) over.reasoning = {
						efforts: model.reasoning.efforts,
						defaultEffort: model.reasoning.defaultEffort
					};
					if (Object.keys(flags).length > 0) catalogOverrides[model.id] = {
						id: model.id,
						name: model.name,
						...over
					};
				}
				const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, SAVE_ENDPOINT, {
					executablePath: row.executablePath,
					harnessPath: row.harnessPath,
					stateDirectory: row.stateDirectory,
					instanceId: row.instanceId,
					...row.model === void 0 ? {} : { model: row.model },
					...row.modelDiscoveryTimeoutMs === void 0 ? {} : { modelDiscoveryTimeoutMs: row.modelDiscoveryTimeoutMs },
					enabled: row.enabled,
					catalogOrder,
					...Object.keys(catalogOverrides).length === 0 ? {} : { catalogOverrides }
				}, void 0);
				if (!result.ok) throw new Error(result.error.message);
			};
			const run = async (action, value) => {
				const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, "run", {
					action,
					...value === void 0 ? {} : { value }
				}, void 0);
				if (!result.ok) throw new Error(result.error.message);
				if (action === "sign-out" || action === "sign-in") invalidateUsage();
				if (action === "sign-out") publishAccount("unconnected");
				return result.value;
			};
			const pick = async () => {
				const result = await rpc.call(ACP_SETTINGS_RPC_CHANNEL, PICK_ENDPOINT, {}, void 0);
				if (!result.ok) throw new Error(result.error.message);
				return result.value.path ?? null;
			};
			ctx.effect(() => {
				load().catch(() => {});
				return () => {
					closed = true;
				};
			}, "dsh-acp-cursor: account snapshot");
			ctx.slots.inject("settings.provider.item", () => ctx.slots.register({
				name: "settings.provider.item",
				key: "cursor-agent",
				locale: localeNamespace,
				inject: () => ({
					t,
					load,
					save,
					run,
					pick,
					quota
				})
			}, ExternalAgentsSection));
			ctx.effect(() => ctx.uiConversation.events.register(nativeTurnDefinition), "dsh-acp-cursor: native turn fold");
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "cursor-agent-native",
				inject: (sessionId) => ({
					t,
					conversationT: ctx.locale.bind("conversation"),
					rpc,
					sessionId,
					uiConversation: ctx.uiConversation
				})
			}, NativeTurnContainer));
			ctx.effect(() => {
				let warned = false;
				const hasProviders = () => ctx.slots.entries("settings.section").some((entry) => entry.options.id === "providers");
				const check = () => {
					if (hasProviders() || warned) return;
					warned = true;
					console.warn("[dsh-acp-cursor] LLM Providers page missing; install dsh-llm-providers-ui to show the Cursor card.");
				};
				const timer = setTimeout(check, MISSING_OWNER_GRACE_MS);
				const stop = ctx.slots.subscribe("settings.section", () => {
					if (!hasProviders()) return;
					warned = true;
					clearTimeout(timer);
				});
				return () => {
					clearTimeout(timer);
					stop();
				};
			}, "dsh-acp-cursor: providers page diagnostic");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
