import { PartySD } from "./src/models/PartySD.mjs";
import { PartySheetSD } from "./src/sheets/PartySheetSD.mjs";
import { MutationSD } from "./src/models/MutationSD.mjs";
import { MutationSheetSD } from "./src/sheets/MutationSheetSD.mjs";
import { MonsterBrowserSD } from "./src/apps/MonsterBrowserSD.mjs";
import { MutationCauldronSD } from "./src/apps/MutationCauldronSD.mjs";
import { ScenePlayerHUDSD } from "./src/apps/ScenePlayerHUDSD.mjs";
import { syncPartyLight } from "./src/utils/syncPartyLight.mjs";

export const SETTINGS = {
	AUTO_SYNC_LIGHT: "autoSyncPartyLight",
};

Hooks.once("init", () => {
	CONFIG.Actor.dataModels["binos-shadowdark-tools.Party"] = PartySD;
	CONFIG.Item.dataModels["binos-shadowdark-tools.Mutation"] = MutationSD;

	foundry.documents.collections.Actors.registerSheet("binos-shadowdark-tools", PartySheetSD, {
		types: ["binos-shadowdark-tools.Party"],
		makeDefault: true,
		label: "BINOS.sheet.party.title",
	});

	foundry.documents.collections.Items.registerSheet("binos-shadowdark-tools", MutationSheetSD, {
		types: ["binos-shadowdark-tools.Mutation"],
		makeDefault: true,
		label: "BINOS.sheet.mutation.title",
	});

	// list all foundry.documents.collections.Actors.registerSheet to verify our sheet is registered
	console.log("Registered Actor Sheets:", foundry.documents.collections.Actors.contents);

	foundry.applications.handlebars.loadTemplates([
		"modules/binos-shadowdark-tools/templates/actors/party.hbs",
		"modules/binos-shadowdark-tools/templates/apps/monster-browser-header.hbs",
		"modules/binos-shadowdark-tools/templates/apps/monster-browser-results.hbs",
		"modules/binos-shadowdark-tools/templates/items/mutation.hbs",
		"modules/binos-shadowdark-tools/templates/apps/mutation-caldron.hbs",
		"modules/binos-shadowdark-tools/templates/apps/scene-player-hud.hbs",
	]);

	game.settings.register("binos-shadowdark-tools", SETTINGS.AUTO_SYNC_LIGHT, {
		name: "BINOS.settings.autoSyncPartyLight.name",
		hint: "BINOS.settings.autoSyncPartyLight.hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: true,
	});

	console.log("binos-shadowdark-tools | Initialized PartySD and PartySheetSD");
});

Hooks.once("ready", () => {
	const sceneHUD = ScenePlayerHUDSD.open();
	game.binosShadowdarkTools = { MonsterBrowserSD, MutationCauldronSD, sceneHUD };
});

// Re-render the HUD whenever the scene or its tokens change.
function refreshSceneHUD() {
	foundry.applications.instances.get("binos-scene-player-hud")?.render();
}

Hooks.on("canvasReady",   refreshSceneHUD);
Hooks.on("createToken",   refreshSceneHUD);
Hooks.on("deleteToken",   refreshSceneHUD);
Hooks.on("updateToken",   refreshSceneHUD);
Hooks.on("updateActor",  (actor) => {
	if (actor.type === "Player") refreshSceneHUD();
});

// Ensure new party actors have vision enabled on their prototype token by default.
Hooks.on("preCreateActor", (actor) => {
	if (actor.type !== "binos-shadowdark-tools.Party") return;
	actor.updateSource({ "prototypeToken.sight.enabled": true });
});

/**
 * Find every party actor that lists the given actor as a member and call
 * syncPartyLight on each one so the party token's light stays in sync.
 */
async function syncPartyLightForMember(memberActor) {
	const partyActors = game.actors.filter(
		a => a.type === "binos-shadowdark-tools.Party"
			&& a.system?.members?.includes(memberActor.uuid)
	);
	for (const partyActor of partyActors) {
		await syncPartyLight(partyActor);
	}
}

function autoSyncEnabled() {
	return game.settings.get("binos-shadowdark-tools", SETTINGS.AUTO_SYNC_LIGHT);
}

// Any item update on a member actor may affect the active light — re-evaluate.
Hooks.on("updateItem", async (item) => {
	if (!autoSyncEnabled()) return;
	const actor = item.parent;
	if (actor) await syncPartyLightForMember(actor);
});

// Any actor update on a member actor may affect the active light — re-evaluate.
Hooks.on("updateActor", async (actor) => {
	if (!autoSyncEnabled()) return;
	await syncPartyLightForMember(actor);
});
