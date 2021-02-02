export enum MapType {
	THE_SKELD,
	MIRA_HQ,
	POLUS,
	UNKNOWN,
}

export interface Vector2 {
	x: number;
	y: number;
}

export enum CameraLocation {
	East,
	Central,
	Northeast,
	South,
	SouthWest,
	NorthWest,
	Skeld,
	NONE,
}

export interface CamerasMap {
	[cameraLoc: number]: Vector2;
}

interface AmongUsMap {
	cameras: CamerasMap;
}

export const PolusMap: AmongUsMap = {
	cameras: {
		[CameraLocation.East]: { x: 29, y: -15.7 },
		[CameraLocation.Central]: { x: 15.4, y: -15.4 },
		[CameraLocation.Northeast]: { x: 24.4, y: -8.5 },
		[CameraLocation.South]: { x: 17, y: -20.6 },
		[CameraLocation.SouthWest]: { x: 4.7, y: -22.73 },
		[CameraLocation.NorthWest]: { x: 11.6, y: -8.2 },
	},
};

export const SkeldMap: AmongUsMap = {
	cameras: {
		[0]: { x: 13.2417, y: -4.348 },
		[1]: { x: 0.6216, y: -6.5642 },
		[2]: { x: -7.1503, y: 1.6709 },
		[3]: { x: -17.8098, y: -4.8983 },
	},
};

// East: 29, -15.7
// Central: 15.4, -15.4
// Northeast: 24.4, -8.5
// South: 17, -20.6
// Southwest: 4.7, -22.73
// Northwest: 11.6, -8.2
