import React, { createContext } from 'react';
import { AmongUsState } from '../common/AmongUsState';
import { ISettings } from '../common/ISettings';


export const GameStateContext = createContext<AmongUsState>({} as AmongUsState);
export const SettingsContext = createContext<[ISettings, React.Dispatch<{
	type: 'set' | 'setOne';
	action: ISettings | [string, any];
}>]>(null as any);
