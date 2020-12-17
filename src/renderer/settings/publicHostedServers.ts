export interface CrewLinkServerInfo {
	/** URL of CrewLink server */
	url: string
	/** User readable version */
	info: string
}

export const publicHostedServers: CrewLinkServerInfo[] = [
	{
		info: '(Official) crewl.ink',
		url: 'https://crewl.ink',
	},
	{
		info: 'proximity.betteramongus.net',
		url: 'http://proximity.betteramongus.net',
	},
	{
		info: 's1.theskeld.xyz (Oceania)',
		url: 'https://s1.theskeld.xyz',
	},
	{
		info: 's2.theskeld.xyz (NA)',
		url: 'https://s2.theskeld.xyz',
	},
	{
		info: 's3.theskeld.xyz (NA)',
		url: 'https://s3.theskeld.xyz',
	},
	{
		info: 's4.theskeld.xyz (Europe)',
		url: 'https://s4.theskeld.xyz',
	},
	{
		info: 'crewlink.among-us.tech',
		url: 'https://crewlink.among-us.tech',
	},
	{
		info: 'crewlink.glitch.me',
		url: 'https://crewlink.glitch.me',
	},
	{
		info: '(Official) public2.crewl.ink',
		url: 'https://public2.crewl.ink',
	},
];
