const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class ScenePlayerHUDSD extends HandlebarsApplicationMixin(ApplicationV2) {

	static DEFAULT_OPTIONS = {
		id: "binos-scene-player-hud",
		tag: "div",
		position: { width: "auto", height: "auto" },
		window: { frame: false, positioned: false },
	};

	static PARTS = {
		main: {
			template: "modules/binos-shadowdark-tools/templates/apps/scene-player-hud.hbs",
		},
	};

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		context.players = this.#getPlayerTokenData();
		return context;
	}

	#getPlayerTokenData() {
		const tokens = canvas.tokens?.placeables.filter(
			t => t.actor?.type === "Player"
		) ?? [];

		return tokens.map(token => {
			const actor = token.actor;
			const hpValue = actor.system.attributes?.hp?.value ?? 0;
			const hpMax   = actor.system.attributes?.hp?.max   ?? 1;
			const raw     = (hpValue / hpMax) * 100;
			const hpPercent = Math.max(0, Math.min(99, raw));

			let hpStatus = "healthy";
			if (hpPercent <= 25)      hpStatus = "critical";
			else if (hpPercent <= 50) hpStatus = "injured";
			else if (hpPercent <= 75) hpStatus = "hurt";

			return {
				tokenId:    token.id,
				uuid:       actor.uuid,
				img:        token.document.texture?.src ?? actor.img,
				name:       actor.name,
				ac:         actor.system.attributes?.ac?.value ?? "—",
				hpValue,
				hpMax,
				hpPercent,
				hpStatus,
			};
		});
	}

	_insertElement(element) {
		const existing = document.getElementById(element.id);
		const anchor   = document.querySelector("#scene-controls");

		if (!anchor) return;

		if (existing) {
			if (existing.parentElement !== anchor.parentElement) {
				existing.remove();
				anchor.insertAdjacentElement("afterend", element);
			} else {
				existing.replaceWith(element);
			}
		} else {
			anchor.insertAdjacentElement("afterend", element);
		}
	}

	_onRender(context, options) {
		if (game.user.isGM) {
			for (const portrait of this.element.querySelectorAll(".scene-hud-portrait")) {
				portrait.style.cursor = "pointer";
				portrait.addEventListener("click", async () => {
					const uuid = portrait.closest(".scene-hud-character").dataset.uuid;
					const actor = await fromUuid(uuid);
					actor?.sheet?.render(true);
				});
			}
		}

		for (const input of this.element.querySelectorAll(".scene-hud-hp-input")) {
			input.addEventListener("focus", function () { this.value = ""; });

			input.addEventListener("blur", function () { this.value = this.dataset.value; });

			input.addEventListener("keyup", async function (e) {
				if (e.key !== "Enter") return;
				e.preventDefault();
				e.stopPropagation();

				const actor = await fromUuid(this.dataset.uuid);
				if (!actor) return;

				const current    = Number(this.dataset.value);
				const inputValue = this.value.trim();
				let damageAmount, multiplier;

				if (inputValue.startsWith("+")) {
					damageAmount = parseInt(inputValue.slice(1), 10);
					multiplier   = -1;
				} else if (inputValue.startsWith("-")) {
					damageAmount = parseInt(inputValue.slice(1), 10);
					multiplier   = 1;
				} else {
					const newHP  = parseInt(inputValue, 10);
					damageAmount = current - newHP;
					multiplier   = 1;
				}

				if (!isNaN(damageAmount)) actor.applyDamage(damageAmount, multiplier);
				this.blur();
			});
		}
	}

	static open() {
		const existing = foundry.applications.instances.get("binos-scene-player-hud");
		if (existing) return existing;
		const app = new ScenePlayerHUDSD();
		app.render(true);
		return app;
	}
}
