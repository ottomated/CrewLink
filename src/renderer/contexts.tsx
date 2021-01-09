import React, { createContext } from 'react';
import { AmongUsState } from '../common/AmongUsState';
import { ISettings, ILobbySettings } from '../common/ISettings';

type SettingsContextValue = [
	ISettings,
	React.Dispatch<{
		type: 'set' | 'setOne' | 'setLobbySetting';
		action: ISettings | [string, unknown];
	}>
];
type LobbySettingsContextValue = [
	ILobbySettings,
	React.Dispatch<{
		type: 'set' | 'setOne';
		action: ILobbySettings | [string, unknown];
	}>
];

export const GameStateContext = createContext<AmongUsState>({} as AmongUsState);
export const SettingsContext = createContext<SettingsContextValue>(
	(null as unknown) as SettingsContextValue
);
export const LobbySettingsContext = createContext<LobbySettingsContextValue>(
	(null as unknown) as LobbySettingsContextValue
);
