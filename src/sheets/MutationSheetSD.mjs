const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class MutationSheetSD extends HandlebarsApplicationMixin(ItemSheetV2) {

	static DEFAULT_OPTIONS = {
		classes: ["binos-sd-tools", "sheet", "item", "mutation"],
		position: { width: 460, height: 800 },
		window: { resizable: true },
		form: { submitOnChange: true },
		actions: {
			removeFeature: MutationSheetSD.#removeFeature,
			removeSpecialAttack: MutationSheetSD.#removeSpecialAttack,
		},
	};

	static PARTS = {
		main: {
			template: "modules/binos-shadowdark-tools/templates/items/mutation.hbs",
		},
	};

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		context.item = this.item;
		context.system = this.item.system;
		context.features = await Promise.all(
			(this.item.system.features ?? []).map(async uuid => {
				const doc = await fromUuid(uuid);
				return { uuid, name: doc?.name ?? uuid, img: doc?.img ?? "icons/svg/item-bag.svg" };
			})
		);
		context.specialAttacks = await Promise.all(
			(this.item.system.specialAttacks ?? []).map(async uuid => {
				const doc = await fromUuid(uuid);
				return { uuid, name: doc?.name ?? uuid, img: doc?.img ?? "icons/svg/item-bag.svg" };
			})
		);
		context.descriptionHTML = await TextEditor.enrichHTML(
			this.item.system.description ?? "",
			{ relativeTo: this.item }
		);
		return context;
	}

	async _onDropDocument(event, document) {
		if (document.documentName === "Item" && document.type === "NPC Feature") {
			const uuid = document.uuid;
			const current = this.item.system.features ?? [];
			if (current.includes(uuid)) return null;
			await this.item.update({ "system.features": [...current, uuid] });
			return document;
		}
		if (document.documentName === "Item" && document.type === "NPC Special Attack") {
			const uuid = document.uuid;
			const current = this.item.system.specialAttacks ?? [];
			if (current.includes(uuid)) return null;
			await this.item.update({ "system.specialAttacks": [...current, uuid] });
			return document;
		}
		return super._onDropDocument(event, document);
	}

	static async #removeFeature(event, target) {
		const uuid = target.dataset.uuid;
		const current = this.item.system.features ?? [];
		await this.item.update({ "system.features": current.filter(f => f !== uuid) });
	}

	static async #removeSpecialAttack(event, target) {
		const uuid = target.dataset.uuid;
		const current = this.item.system.specialAttacks ?? [];
		await this.item.update({ "system.specialAttacks": current.filter(f => f !== uuid) });
	}
}
