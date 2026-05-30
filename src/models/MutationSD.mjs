const { TypeDataModel } = foundry.abstract;
const { ArrayField, HTMLField, NumberField, StringField } = foundry.data.fields;

export class MutationSD extends TypeDataModel {
	static defineSchema() {
		return {
			// Combat bonuses
			bonusAC:      new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusDamage:  new StringField({ initial: "", required: false }),
			bonusAttacks: new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusLVL:     new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusHP:      new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusHit:     new NumberField({ integer: true, initial: 0, nullable: false }),
			// Ability score bonuses
			bonusSTR: new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusDEX: new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusCON: new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusINT: new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusWIS: new NumberField({ integer: true, initial: 0, nullable: false }),
			bonusCHA: new NumberField({ integer: true, initial: 0, nullable: false }),
			// Rich-text description
			description: new HTMLField({ initial: "", required: false }),
			// Linked items
			features:       new ArrayField(new StringField(), { required: false, initial: [] }),
			specialAttacks: new ArrayField(new StringField(), { required: false, initial: [] }),
		};
	}
}
