import React, { Component } from 'react';
// @ts-ignore
import { BrowserRouter as Router, Route } from 'react-router-dom';
import ReactDOM from 'react-dom';
import App from './App';
import Overlay from './Overlay';

// @ts-ignore
class ViewManager extends Component {
	static Views() {
		// @ts-ignore
		const val: any = {
			// @ts-ignore
			app: <App />,
			// @ts-ignore
			overlay: <Overlay />,
		};
		return val;
	}

	static View(props: any) {
		const name = props.location.search.split('view=')[1];
		// @ts-ignore
		console.log('View type: ' + name);
		const view = ViewManager.Views()[name];
		if (view == null) throw new Error("View '" + name + "' is undefined");

		return view;
	}

	render() {
		return (
			<Router>
				<div>
					<Route path="/" component={ViewManager.View} />
				</div>
			</Router>
		);
	}
}

export default ViewManager;

ReactDOM.render(<ViewManager />, document.getElementById('app'));
