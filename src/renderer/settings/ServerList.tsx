import React, { useState } from 'react';
import { CrewLinkServerInfo } from './publicHostedServers';
import { validateURL } from '../settingsStore';
import { CircleSpinner } from 'react-spinners-kit';

interface ServerListProps {
	/** A name to add to react key for iterating over servers */
	serverKeyName: string;
	/** The current URL being connected to */
	currentURL: string;
	/** List of servers to be displayed to the user */
	servers: CrewLinkServerInfo[];
	/** Callback for when user selects a suggestion */
	onSelect(selection: string): void;

	children?: void;
}

/** Shows a list of servers for a user to select */
export const ServerList: React.FC<ServerListProps> = function (
	{ serverKeyName, currentURL, servers, onSelect }: ServerListProps
) {
	const currentServer = servers.find((suggestion) => currentURL === suggestion.url);
	const [isCustom, setShowInput] = useState(!currentServer);
	
	function selectChangeHandler(e: React.ChangeEvent<HTMLSelectElement>) {
		const { value } = e.target;
		console.log('Drop down value change:', value);
		if (!value) {
			return;
		}

		if (value === 'custom url') {
			setShowInput(true);
			return;
		}

		setShowInput(false);
		onSelect(value);
	}

	return <div className="suggestions">
		<select
			value={currentServer ? currentServer.url : 'custom url'}
			onChange={selectChangeHandler}
		>
			{servers.map((suggestion, i) => 
				(<option
					key={serverKeyName + ' suggestion ' + i}
					value={suggestion.url}
				>
					{suggestion.info || suggestion.url}
				</option>)
			)}
			<option value="custom url">-- Custom Server --</option>
		</select>
		{isCustom &&
			// true &&
			<URLInput
				initialURL={currentURL}
				onValidURL={url => onSelect(url)}
			/>
		}
	</div>;
};

interface URLInputProps {
	initialURL: string;
	onValidURL: (url: string) => void;
}

/** Allows the user to input a URL */
function URLInput({ initialURL, onValidURL }: URLInputProps) {
	const [isValidURL, setURLValid] = useState(true);
	const [currentURL, setCurrentURL] = useState(initialURL);
	const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout>();
	const [showSpinner, setShowSpinner] = useState(false);

	function onChange(event: React.ChangeEvent<HTMLInputElement>) {
		setCurrentURL(event.target.value);

		setShowSpinner(true);
		// NOTE: Disabling because typing is being overzealous
		//       and clearTimout is acutally very permissive
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		clearTimeout(debounceTimer!);
		setDebounceTimer(setTimeout(() => {
			setShowSpinner(false);
			if (validateURL(event.target.value)) {
				setURLValid(true);
				onValidURL(event.target.value);
			} else {
				setURLValid(false);
			}
		}, 2.5 * 1000));
	}

	return <>
		<input
			className={isValidURL ? '' : 'input-error'}
			spellCheck={false}
			type="text"
			value={currentURL}
			onChange={onChange} />
		<div style={{ display: 'inline-block' }}>
			{showSpinner || <CircleSpinner size={10} />}
		</div>
	</>;
}
