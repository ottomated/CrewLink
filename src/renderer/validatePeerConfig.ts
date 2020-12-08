import Ajv from 'ajv';

const ICE_SERVER_DEFINITION = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                format: 'uri'
            },
            username: {
                type: 'string',
            },
            credential: {
                type: 'string',
            }
        },
        required: ['url']
    }
}

export const validatePeerConfig = new Ajv({ format: 'full', allErrors: true }).compile({
	type: 'object',
	properties: {
		forceRelayOnly: {
			type: 'boolean'
		},
        stunServers: ICE_SERVER_DEFINITION,
        turnServers: ICE_SERVER_DEFINITION,
    },
    required: ['forceRelayOnly']
});
