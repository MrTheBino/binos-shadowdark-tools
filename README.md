# Bino's Shadowdark Tools

Some tools I use at my virtual Shadowdark Foundry VTT table.

## Features

### Party Sheet
Adds a Party sheet actor to the Shadowdark System.

- you can deploy / move all assigned actors of the party sheet around the party sheet with one click. Made for easier dungeon crawling
- synchronization of active light sources to the party sheet, so one actor is enough to move through dungeons
- automatic synchronization can be turned off , so tht you simply can turn a light on or off for the party sheet

### Simple player actor HUDs

Based on the idea of the Lights Out theme, there's a small HUD for the player characters on the lower left of a foundry scene which displays
the current scene'S actor player actors.


### Simple Monster Browser

Yeah... a simple monster browser to search more detailed for monsters.

To open the Monster Browser use this code for a macro:

    game.binosShadowdarkTools.MonsterBrowserSD.open();

### Mutation Cauldron

Apply mutations (a new item type) to selected NPCs on the current scene.

    game.binosShadowdarkTools.MutationCauldronSD.open();