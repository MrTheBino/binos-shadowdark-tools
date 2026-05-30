const { TypeDataModel } = foundry.abstract;
const { ArrayField, StringField } = foundry.data.fields;

export class PartySD extends TypeDataModel {
	static defineSchema() {
		return {
			members: new ArrayField(
				new StringField({ required: true, blank: false }),
				{ initial: [] }
			),
		};
	}
}
