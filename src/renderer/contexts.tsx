import React, { createContext } from 'react';
import { AmongUsState } from '../common/AmongUsState';
import { ISettings } from '../common/ISettings';

type SettingsContextValue = [ISettings, React.Dispatch<{
	type: 'set' | 'setOne';
	action: ISettings | [string, unknown];
}>]

export const GameStateContext = createContext<AmongUsState>({} as AmongUsState);
export const SettingsContext = createContext<SettingsContextValue>(null as unknown as SettingsContextValue);
