const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class MonsterBrowserSD extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		id: "binos-monster-browser",
		classes: ["binos-sd-tools", "monster-browser"],
		position: { width: 820, height: 600 },
		window: {
			title: "BINOS.monsterBrowser.title",
			resizable: true,
		},
		actions: {
			openMonster: MonsterBrowserSD.#openMonster,
		},
	};

	static PARTS = {
		header: {
			template: "modules/binos-shadowdark-tools/templates/apps/monster-browser-header.hbs",
		},
		results: {
			template: "modules/binos-shadowdark-tools/templates/apps/monster-browser-results.hbs",
			scrollable: [".monster-list"],
		},
	};

	#searchTerm = "";
	#debounceTimer = null;
	#dragDrop = null;

	async _preparePartContext(partId, context, options) {
		context = await super._preparePartContext(partId, context, options);
		if (partId === "results") {
			context.monsters = this.#searchTerm.length >= 3
				? await this.#search(this.#searchTerm)
				: [];
			context.hasSearch = this.#searchTerm.length >= 3;
		}
		return context;
	}

	_onRender(context, options) {
		// ApplicationV2 doesn't auto-process dragDrop from DEFAULT_OPTIONS, so we bind manually.
		// Called after every render (including partial results re-renders) to pick up new .monster-row elements.
		if (!this.#dragDrop) {
			this.#dragDrop = new foundry.applications.ux.DragDrop.implementation({
				dragSelector: ".monster-row",
				permissions: { dragstart: () => true },
				callbacks: { dragstart: this._onDragStart.bind(this) },
			});
		}
		this.#dragDrop.bind(this.element);

		const input = this.element.querySelector(".monster-search");
		if (!input || input.dataset.bound) return;
		input.dataset.bound = "1";
		input.focus();
		input.addEventListener("input", (e) => {
			clearTimeout(this.#debounceTimer);
			this.#debounceTimer = setTimeout(() => {
				this.#searchTerm = e.target.value.trim();
				this.render({ parts: ["results"] });
			}, 300);
		});
	}

	_onDragStart(event) {
		const uuid = event.currentTarget.dataset.uuid;
		event.dataTransfer.setData("text/plain", JSON.stringify({ type: "Actor", uuid }));
	}

	async #search(term) {
		const normalized = term.toLowerCase();
		const results = [];

		// World actors
		for (const actor of game.actors) {
			if (actor.type !== "NPC") continue;
			if (!actor.name.toLowerCase().includes(normalized)) continue;
			results.push({
				uuid: actor.uuid,
				img: actor.img,
				name: actor.name,
				level: actor.system.level?.value ?? "—",
				hp: actor.system.attributes?.hp?.max ?? "—",
				ac: actor.system.attributes?.ac?.value ?? "—",
				notes: actor.system.notes ?? "",
				source: game.world.title,
			});
		}

		// Compendium packs
		const actorPacks = game.packs.filter(p => p.documentName === "Actor");
		await Promise.all(actorPacks.map(async (pack) => {
			try {
				const index = await pack.getIndex({
					fields: [
						"system.attributes.hp",
						"system.attributes.ac",
						"system.level",
						"system.notes",
					],
				});
				for (const entry of index) {
					if (entry.type !== "NPC") continue;
					if (!entry.name.toLowerCase().includes(normalized)) continue;
					results.push({
						uuid: entry.uuid,
						img: entry.img,
						name: entry.name,
						level: entry.system?.level?.value ?? "—",
						hp: entry.system?.attributes?.hp?.max ?? "—",
						ac: entry.system?.attributes?.ac?.value ?? "—",
						notes: entry.system?.notes ?? "",
						source: pack.metadata.label,
					});
				}
			} catch { /* skip inaccessible packs */ }
		}));

		results.sort((a, b) => a.name.localeCompare(b.name));
		return results;
	}

	static async #openMonster(event, target) {
		const uuid = target.closest("[data-uuid]").dataset.uuid;
		const doc = await fromUuid(uuid);
		doc?.sheet?.render(true);
	}

	static open() {
		const existing = foundry.applications.instances.get("binos-monster-browser");
		if (existing) return existing.bringToTop();
		new MonsterBrowserSD().render(true);
	}
}
