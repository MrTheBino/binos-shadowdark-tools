const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
import { getActivePartyLight, syncPartyLight, changeLightSettings } from "../utils/syncPartyLight.mjs";
import { SETTINGS } from "../../binos-shadowdark-tools.mjs";

const DEFAULT_PARTY_LIGHT = {
	alpha: 0.2,
	angle: 360,
	animation: { speed: 1, intensity: 1, reverse: false, type: "torch" },
	attenuation: 0.5,
	bright: 5,
	color: "#d1c846",
	coloration: 1,
	contrast: 0,
	darkness: { min: 0, max: 1 },
	dim: 30,
	luminosity: 0.5,
	saturation: 0,
	shadows: 0,
};

export class PartySheetSD extends HandlebarsApplicationMixin(ActorSheetV2) {

	static DEFAULT_OPTIONS = {
		classes: ["binos-sd-tools", "sheet", "actor", "party"],
		position: { width: 750, height: 500 },
		window: { resizable: true },
		dragDrop: [{ dropSelector: null }],
		actions: {
			openActor: PartySheetSD.#openActor,
			removeMember: PartySheetSD.#removeMember,
			deployToScene: PartySheetSD.#deployToScene,
			toggleAutoSync: PartySheetSD.#toggleAutoSync,
			togglePartyLight: PartySheetSD.#togglePartyLight,
		},
		form: {
      	submitOnChange: true
    	},
		actor: {
            type: 'PartySheetSD'
        },
	};

	static PARTS = {
		sheet: {
			template: "modules/binos-shadowdark-tools/templates/actors/party.hbs",
			scrollable: [""]
		},
	};

	constructor(options = {}) {
		super(options);
		console.log("Initializing PartySheetSD with options:", options);
	}

	async _prepareContext(options) {
		console.log("Preparing context for PartySheetSD with options:");
		const context = await super._prepareContext(options);
		context.actor = this.actor;
		context.members = await this._resolveMembers();
		context.pulpMode = game.settings.get("shadowdark", "usePulpMode");
		const light = await getActivePartyLight(this.actor);
		context.activeLight = light
			? { name: light.item.name, img: light.item.img, actorName: light.actor.name }
			: null;
		context.autoSyncLight = game.settings.get("binos-shadowdark-tools", SETTINGS.AUTO_SYNC_LIGHT);
		const canvasToken = canvas.tokens?.placeables.find(t => t.document.actorId === this.actor.id);
		const tokenLight = canvasToken?.document?.light ?? this.actor.prototypeToken?.light;
		context.partyHasLight = (tokenLight?.bright > 0) || (tokenLight?.dim > 0);
		return context;
	}

	async _resolveMembers() {
		const uuids = this.actor.system.members ?? [];
		const resolved = await Promise.all(
			uuids.map(async (uuid, i) => {
				try {
					const actor = await fromUuid(uuid);
					if (!actor) return null;
					return {
						uuid,
						order: i + 1,
						img: actor.prototypeToken?.texture?.src ?? actor.img,
						name: actor.name,
						characterClass: (await actor.system.getClass?.())?.name ?? "—",
						hp: {
							value: actor.system.attributes?.hp?.value ?? "—",
							max: actor.system.attributes?.hp?.max ?? "—",
						},
						ac: actor.system.attributes?.ac?.value ?? "—",
						level: actor.system.level?.value ?? "—",
						xp: actor.system.level?.xp ?? "—",
						luck: {
						remaining: actor.system.luck?.remaining ?? "—",
						available: actor.system.luck?.available ?? false,
					},
						slots: {
							used: actor.system.getSlotUsage?.()?.slots?.total ?? "—",
							max: actor.system.slots ?? "—",
						},
					};
				}
				catch {
					return null;
				}
			})
		);
		return resolved.filter(Boolean);
	}

	async _onRender(context, options) {
		await super._onRender(context, options);

		// Drop-zone visual feedback when the list is empty.
		const dropZone = this.element.querySelector(".party-drop-zone");
		if (dropZone) {
			dropZone.addEventListener("dragover", e => {
				e.preventDefault();
				dropZone.classList.add("dragover");
			});
			dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
			dropZone.addEventListener("drop", () => dropZone.classList.remove("dragover"));
		}

		const rows = [...this.element.querySelectorAll(".party-list-row")];
		if (!rows.length) return;

		let dragSrcUUID = null;

		for (const row of rows) {
			row.addEventListener("dragstart", e => {
				dragSrcUUID = row.dataset.uuid;
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", JSON.stringify({ type: "MemberReorder", uuid: dragSrcUUID }));
				row.classList.add("dragging");
			});

			row.addEventListener("dragend", () => {
				dragSrcUUID = null;
				rows.forEach(r => r.classList.remove("dragging", "drag-over"));
			});

			row.addEventListener("dragover", e => {
				if (!dragSrcUUID || row.dataset.uuid === dragSrcUUID) return;
				e.preventDefault();
				e.stopPropagation();
				rows.forEach(r => r.classList.remove("drag-over"));
				row.classList.add("drag-over");
			});

			row.addEventListener("dragleave", () => {
				row.classList.remove("drag-over");
			});

			row.addEventListener("drop", async e => {
				rows.forEach(r => r.classList.remove("dragging", "drag-over"));
				// Only intercept reorder drags — external actor drops must bubble to _onDrop.
				if (!dragSrcUUID) return;
				e.preventDefault();
				e.stopPropagation();
				const targetUUID = row.dataset.uuid;
				if (dragSrcUUID === targetUUID) return;
				const members = [...(this.actor.system.members ?? [])];
				const from = members.indexOf(dragSrcUUID);
				const to = members.indexOf(targetUUID);
				if (from === -1 || to === -1) return;
				members.splice(from, 1);
				members.splice(to, 0, dragSrcUUID);
				await this.actor.update({ "system.members": members });
			});
		}
	}

	_onFirstRender(context, options) {
		this._memberUpdateHook = Hooks.on("updateActor", (actor) => {
			if (actor.id === this.actor.id || this.actor.system.members?.includes(actor.uuid)) this.render();
		});
		this._lightUpdateHook = Hooks.on("updateItem", (item) => {
			const actor = item.parent;
			if (actor && this.actor.system.members?.includes(actor.uuid)) this.render();
		});
	}

	async close(options = {}) {
		Hooks.off("updateActor", this._memberUpdateHook);
		Hooks.off("updateItem", this._lightUpdateHook);
		return super.close(options);
	}

	async _onDrop(event) {
		console.log("Drop event on PartySheetSD:", event);
		let data;
		try {
			data = JSON.parse(event.dataTransfer.getData("text/plain"));
		} catch {
			return;
		}
		if (data.type !== "Actor") return;
		const uuid = data.uuid;
		if (!uuid) return;
		const current = this.actor.system.members ?? [];
		if (current.includes(uuid)) return;
		await this.actor.update({ "system.members": [...current, uuid] });
	}

	static async #openActor(event, target) {
		const uuid = target.closest("[data-uuid]").dataset.uuid;
		const actor = await fromUuid(uuid);
		actor?.sheet?.render(true);
	}

	static async #removeMember(event, target) {
		const uuid = target.closest("[data-uuid]").dataset.uuid;
		const members = this.document.system.members.filter((m) => m !== uuid);
		await this.document.update({ "system.members": members });
	}

	static async #toggleAutoSync(event, target) {
		const current = game.settings.get("binos-shadowdark-tools", SETTINGS.AUTO_SYNC_LIGHT);
		await game.settings.set("binos-shadowdark-tools", SETTINGS.AUTO_SYNC_LIGHT, !current);
		// If just enabled, immediately sync so the token is up to date.
		if (!current) await syncPartyLight(this.actor);
		this.render();
	}

	static async #togglePartyLight(event, target) {
		const canvasToken = canvas.tokens?.placeables.find(t => t.document.actorId === this.actor.id);
		const tokenLight = canvasToken?.document?.light ?? this.actor.prototypeToken?.light;
		const hasLight = (tokenLight?.bright > 0) || (tokenLight?.dim > 0);
		if (hasLight) {
			await changeLightSettings(this.actor, { bright: 0, dim: 0 });
		} else {
			await changeLightSettings(this.actor, DEFAULT_PARTY_LIGHT);
		}
		this.render();
	}

	static async #deployToScene(event, target) {
		if (!canvas.scene) {
			return ui.notifications.warn(game.i18n.localize("BINOS.sheet.party.deployNoScene"));
		}

		const partyToken = canvas.scene.tokens.find(t => t.actorId === this.actor.id);
		if (!partyToken) {
			return ui.notifications.warn(game.i18n.localize("BINOS.sheet.party.deployNoToken"));
		}

		const members = this.actor.system.members ?? [];
		if (!members.length) return;

		const actors = (await Promise.all(members.map(u => fromUuid(u)))).filter(Boolean);
		if (!actors.length) return;

		const grid = canvas.scene.grid.size;
		const tw = (partyToken.width ?? 1) * grid;
		const th = (partyToken.height ?? 1) * grid;
		const cx = partyToken.x + tw / 2;
		const cy = partyToken.y + th / 2;
		const radius = grid * 1;

		for (let i = 0; i < actors.length; i++) {
			const angle = (2 * Math.PI / actors.length) * i - Math.PI / 2;
			const rawX = cx + Math.cos(angle) * radius - grid / 2;
			const rawY = cy + Math.sin(angle) * radius - grid / 2;

			const { x, y } = canvas.grid.getSnappedPoint(
				{ x: rawX, y: rawY },
				{ mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX }
			);
			const actor = actors[i];

			const existing = canvas.scene.tokens.find(t => t.actorId === actor.id);
			if (existing) {
				await existing.update({ x, y });
			} else {
				const td = await actor.getTokenDocument({ x, y }, { parent: canvas.scene });
				await canvas.scene.createEmbeddedDocuments("Token", [td.toObject()]);
			}
		}
	}
}
