import React, { createContext } from 'react';
import { AmongUsState } from '../common/AmongUsState';
import { ISettings } from '../common/ISettings';

interface ISetAll {
	type: 'set'
	action: ISettings
}

interface ISetOne<Key extends keyof ISettings> {
	type: 'setOne',
	action: [Key, ISettings[Key]]
}

export type SettingsDispatchValues = ISetAll | ISetOne<keyof ISettings>

export type SettingsContextValue = [
	ISettings,
	React.Dispatch<SettingsDispatchValues>
]

export const GameStateContext = createContext<AmongUsState>({} as AmongUsState);
export const SettingsContext = createContext<SettingsContextValue>(null as unknown as SettingsContextValue);
