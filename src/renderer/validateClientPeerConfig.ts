import Ajv from 'ajv';

export const validateClientPeerConfig = new Ajv({
	format: 'full',
	allErrors: true,
}).compile({
	type: 'object',
	properties: {
		forceRelayOnly: {
			type: 'boolean',
		},
		iceServers: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					urls: {
						type: ['string', 'array'],
						format: 'uri',
						items: {
							type: 'string',
							format: 'uri',
						},
					},
					username: {
						type: 'string',
					},
					credential: {
						type: 'string',
					},
				},
				required: ['urls'],
			},
		},
	},
	required: ['forceRelayOnly', 'iceServers'],
});
