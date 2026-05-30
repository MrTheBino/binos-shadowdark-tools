const LIGHT_SOURCES_PATH = "systems/shadowdark/assets/mappings/map-light-sources.json";

/**
 * Mirrors ActorSD.changeLightSettings for the party actor.
 * Updates every token of the actor on the current canvas, then syncs the
 * prototype token so newly placed tokens inherit the setting.
 */
export async function changeLightSettings(partyActor, lightData) {
	// Update every visible token on the current scene (matches SD's getCanvasToken pattern).
	const canvasTokens = (canvas.tokens?.placeables ?? []).filter(
		t => t.document.actorId === partyActor.id
	);
	for (const token of canvasTokens) {
		await token.document.update({ light: lightData });
	}

	// Sync the prototype token (mirrors SD's Actor.updateDocuments call).
	await Actor.updateDocuments([{
		_id: partyActor.id,
		"prototypeToken.light": lightData,
	}]);
	console.log("Synced party light settings:", { partyActor, lightData, updatedTokens: canvasTokens.map(t => t.id) });
}

/**
 * Walk the party's member list and return the first active light source found,
 * together with its resolved Foundry light config from the SD mappings JSON.
 * Returns { item, actor, lightData } or null if no active light exists.
 */
export async function getActivePartyLight(partyActor) {
	const members = partyActor.system?.members ?? [];
	const sources = await foundry.utils.fetchJsonWithTimeout(LIGHT_SOURCES_PATH);

	for (const uuid of members) {
		try {
			const actor = await fromUuid(uuid);
			if (!actor) continue;

			const item = actor.items.find(
				i => i.system?.light?.isSource && i.system?.light?.active
			);
			if (!item) continue;

			const lightData = sources?.[item.system.light.template]?.light ?? null;
			return { item, actor, lightData };
		} catch { /* skip inaccessible members */ }
	}
	return null;
}

/**
 * Determine which light (if any) is active across all party members and
 * apply it to the party actor's token — or clear the light if none is active.
 */
export async function syncPartyLight(partyActor) {
	const result = await getActivePartyLight(partyActor);
	const lightData = result?.lightData ?? { bright: 0, dim: 0 };
	await changeLightSettings(partyActor, lightData);
}
