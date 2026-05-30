const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class MutationCauldronSD extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		id: "binos-mutation-caldron",
		classes: ["binos-sd-tools", "mutation-caldron"],
		position: { width: 680, height: 500 },
		window: {
			title: "BINOS.mutationCaldron.title",
			resizable: true,
		},
		actions: {
			applyMutations: MutationCauldronSD.#applyMutations,
			applyRandomMutations: MutationCauldronSD.#applyRandomMutations,
		},
	};

	static PARTS = {
		main: {
			template: "modules/binos-shadowdark-tools/templates/apps/mutation-caldron.hbs",
			scrollable: [".caldron-list", ".mutations-list"],
		},
	};

	#controlHook = null;
	#checkedMutations = new Set();

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		context.tokens = this.#getSelectedNPCs();
		context.mutations = await this.#getMutations();
		return context;
	}

	_onFirstRender(context, options) {
		this.#controlHook = Hooks.on("controlToken", () => this.render());
	}

	_onRender(context, options) {
		// Restore checkbox states that were checked before the re-render
		for (const id of this.#checkedMutations) {
			const cb = this.element.querySelector(`.mutation-checkbox[data-item-id="${id}"]`);
			if (cb) cb.checked = true;
		}

		// Track checkbox changes
		this.element.querySelectorAll(".mutation-checkbox").forEach(cb => {
			cb.addEventListener("change", (e) => {
				const id = e.target.dataset.itemId;
				if (e.target.checked) this.#checkedMutations.add(id);
				else this.#checkedMutations.delete(id);
			});
		});
	}

	async close(options = {}) {
		Hooks.off("controlToken", this.#controlHook);
		return super.close(options);
	}

	async #getMutations() {
		const items = game.items.filter(i => i.type === "binos-shadowdark-tools.Mutation");
		return Promise.all(items.map(async i => {
			const resolve = async uuids => (await Promise.all(
				(uuids ?? []).map(async uuid => {
					const doc = await fromUuid(uuid);
					return doc ? { name: doc.name, img: doc.img ?? "icons/svg/item-bag.svg" } : null;
				})
			)).filter(Boolean);

			return {
				id: i.id,
				name: i.name,
				img: i.img ?? "icons/svg/item-bag.svg",
				bonusAC:      i.system.bonusAC,
				bonusDamage:  i.system.bonusDamage,
				bonusAttacks: i.system.bonusAttacks,
				bonusLVL:     i.system.bonusLVL,
				bonusHP:      i.system.bonusHP,
				bonusHit:     i.system.bonusHit,
				bonusSTR:     i.system.bonusSTR,
				bonusDEX:     i.system.bonusDEX,
				bonusCON:     i.system.bonusCON,
				bonusINT:     i.system.bonusINT,
				bonusWIS:     i.system.bonusWIS,
				bonusCHA:     i.system.bonusCHA,
				hasStats: i.system.bonusAC !== 0 || !!i.system.bonusDamage?.trim()
				       || i.system.bonusAttacks !== 0 || i.system.bonusLVL !== 0
				       || i.system.bonusHP !== 0 || i.system.bonusHit !== 0,
				hasAbilities: i.system.bonusSTR !== 0 || i.system.bonusDEX !== 0
				           || i.system.bonusCON !== 0 || i.system.bonusINT !== 0
				           || i.system.bonusWIS !== 0 || i.system.bonusCHA !== 0,
				features: await resolve(i.system.features),
				specialAttacks: await resolve(i.system.specialAttacks),
			};
		}));
	}

	#getSelectedNPCs() {
		return (canvas.tokens?.controlled ?? [])
			.filter(t => t.actor?.type === "NPC")
			.map(t => ({
				id: t.id,
				name: t.name,
				img: t.document.texture?.src ?? t.actor?.img ?? "icons/svg/mystery-man.svg",
			}));
	}

	// ── Shared helpers ────────────────────────────────────────────────────────

	static async #applyMutationToActor(actor, mutation) {
		const { bonusAC, bonusDamage, bonusAttacks } = mutation.system;

		// Snapshot existing attacks before adding new items so bonuses skip them.
		const existingAttacks = actor.items.filter(
			i => i.type === "NPC Attack" || i.type === "NPC Special Attack"
		);

		// 1. NPC Feature items
		const featureUuids = mutation.system.features ?? [];
		if (featureUuids.length) {
			const featureDatas = (await Promise.all(featureUuids.map(uuid => fromUuid(uuid))))
				.filter(Boolean).map(f => f.toObject());
			if (featureDatas.length) await actor.createEmbeddedDocuments("Item", featureDatas);
		} else {
			await actor.createEmbeddedDocuments("Item", [{
				name: `Mutation - ${mutation.name}`,
				type: "NPC Feature",
				img: mutation.img,
			}]);
		}

		// 2. NPC Special Attack items
		const specialAttackUuids = mutation.system.specialAttacks ?? [];
		if (specialAttackUuids.length) {
			const specialAttackDatas = (await Promise.all(specialAttackUuids.map(uuid => fromUuid(uuid))))
				.filter(Boolean).map(f => f.toObject());
			if (specialAttackDatas.length) await actor.createEmbeddedDocuments("Item", specialAttackDatas);
		}

		// 3. Bonus AC
		if (bonusAC !== 0) {
			const current = actor.system.attributes?.ac?.value ?? 0;
			await actor.update({ "system.attributes.ac.value": current + bonusAC });
		}

		// 4. Bonus Attacks + Bonus Damage — pre-existing attacks only
		for (const attack of existingAttacks) {
			const updates = {};
			if (bonusAttacks !== 0)
				updates["system.attack.num"] = (attack.system.attack?.num ?? 1) + bonusAttacks;
			if (bonusDamage?.trim()) {
				const current = attack.system.damage?.value ?? "";
				updates["system.damage.value"] = `${current}+${bonusDamage.trim()}`;
			}
			if (Object.keys(updates).length) await attack.update(updates);
		}
	}

	static async #stampMutated(actor) {
		const SUFFIX = " Mutated";
		if (!actor.name.endsWith(SUFFIX)) {
			await actor.update({ name: actor.name + SUFFIX });
			for (const tokenDoc of (canvas.scene?.tokens ?? []).filter(t => t.actorId === actor.id)) {
				if (!tokenDoc.name.endsWith(SUFFIX))
					await tokenDoc.update({ name: tokenDoc.name + SUFFIX });
			}
		}
	}

	// ── Actions ────────────────────────────────────────────────────────────────

	static async #applyMutations(event, target) {
		const mutationIds = [...this.#checkedMutations];
		if (!mutationIds.length) return;

		const actors = (canvas.tokens?.controlled ?? [])
			.filter(t => t.actor?.type === "NPC").map(t => t.actor);
		if (!actors.length) return;

		const mutations = mutationIds.map(id => game.items.get(id)).filter(Boolean);

		for (const actor of actors) {
			for (const mutation of mutations)
				await MutationCauldronSD.#applyMutationToActor(actor, mutation);
			await MutationCauldronSD.#stampMutated(actor);
		}

		ui.notifications.info(`Applied ${mutations.length} mutation(s) to ${actors.length} NPC(s).`);
	}

	static async #applyRandomMutations(event, target) {
		const countInput = this.element.querySelector(".random-count-input");
		const count = Math.max(1, parseInt(countInput?.value ?? "1", 10));

		const actors = (canvas.tokens?.controlled ?? [])
			.filter(t => t.actor?.type === "NPC").map(t => t.actor);
		if (!actors.length) return;

		const pool = game.items.filter(i => i.type === "binos-shadowdark-tools.Mutation");
		if (!pool.length) return;

		const actualCount = Math.min(count, pool.length);

		for (const actor of actors) {
			// Fisher-Yates shuffle — each actor gets its own independent draw.
			const shuffled = [...pool];
			for (let i = shuffled.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
			}
			const selected = shuffled.slice(0, actualCount);

			for (const mutation of selected)
				await MutationCauldronSD.#applyMutationToActor(actor, mutation);
			await MutationCauldronSD.#stampMutated(actor);
		}

		ui.notifications.info(`Applied ${actualCount} random mutation(s) to ${actors.length} NPC(s).`);
	}

	static open() {
		const existing = foundry.applications.instances.get("binos-mutation-caldron");
		if (existing) return existing.bringToTop();
		new MutationCauldronSD().render(true);
	}
}
