import * as React from 'react';

import styled from '@emotion/styled';

import { JupyterFrontEnd } from '@jupyterlab/application';
import { DefaultLinkModel, DiagramEngine } from '@projectstorm/react-diagrams';
import { CustomNodeModel } from '../components/CustomNodeModel';
import { GeneralComponentLibrary } from '../tray_library/GeneralComponentLib';

export interface TrayItemWidgetProps {
	model: any;
	color: any;
	name: string;
	path: string;
	app: JupyterFrontEnd;
	eng: DiagramEngine;
	componentList?: any;
	nodePosition?: any;
	linkData?: any;
	isParameter?: any;
}

interface TrayStyledProps {
	color: string
}

export const Tray = styled.div<TrayStyledProps>`
	color: white;
	font-family: Helvetica, Arial;
	padding: 2px;
	width: auto;
	margin: 2px;
	border: solid 1px ${(p) => p.color};
	border-radius: 2px;
	margin-bottom: 2px;
	cursor: pointer;
`;

export class TrayItemPanel extends React.Component<TrayItemWidgetProps> {
	selectedNode() {
		let component_task = this.props.componentList.map(x => x["task"]);
		let drop_node = component_task.indexOf(this.props.name);
		let current_node: any;
		let node: CustomNodeModel;
		if (drop_node != -1) {
			current_node = this.props.componentList[drop_node];
		}
		if (current_node != undefined) {
			if (current_node.header == "GENERAL") {
				node = GeneralComponentLibrary({ name: this.props.name, color: this.props.color, type: this.props.model.type });
			} else {
				node = new CustomNodeModel({ name: this.props.name, color: current_node["color"], extras: { "type": this.props.model.type } });
				node.addInPortEnhance('▶', 'in-0');
				node.addOutPortEnhance('▶', 'out-0');

				let type_name_remappings = {
					"bool": "boolean",
					"str": "string"
				}

				current_node["variables"].forEach(variable => {
					let name = variable["name"];
					let type = type_name_remappings[variable["type"]] || variable["type"];

					switch (variable["kind"]) {
						case "InCompArg":
							node.addInPortEnhance(`★${name}`, `parameter-${type}-${name}`);
							break;
						case "InArg":
							node.addInPortEnhance(name, `parameter-${type}-${name}`);
							break;
						case "OutArg":
							node.addOutPortEnhance(name, `parameter-out-${type}-${name}`);
							break;
						default:
							console.warn("Unknown variable kind for variable", variable)
							break;
					}
				})
			}
		}
		return node;
	}

	addNode(node) {
		node.setPosition(this.props.nodePosition);
		this.props.eng.getModel().addNode(node)
	}

	connectLink(node) {
		if (this.props.linkData == null) {
			return
		}

		// Create new link to connect to new node automatically
		let newLink = new DefaultLinkModel();
		let looseLink = this.props.linkData as DefaultLinkModel;
		let sourcePort;

		// Get loose link node port
		const linkPort = looseLink.getSourcePort();

		// Get target port and connect it
		let targetNode = node;
		let targetPort;

		// When '▶' of sourcePort from inPort, connect to '▶' outPort of target node
		if (looseLink.getSourcePort().getOptions()['name'] == "in-0") {
			sourcePort = targetNode.getPorts()["out-0"];
			targetPort = linkPort;
		} else if (this.props.isParameter) {
			// When looseLink is connected to parameter node
			const parameterNodeName = targetNode.getOutPorts()[0].getOptions()['name']
			sourcePort = targetNode.getPorts()[parameterNodeName];
			targetPort = linkPort;
		}
		else {
			// '▶' of sourcePort to '▶' of targetPort
			sourcePort = linkPort;
			targetPort = targetNode.getPorts()["in-0"];
		}
		newLink.setSourcePort(sourcePort);
		newLink.setTargetPort(targetPort);
		this.props.eng.getModel().addLink(newLink);
	}

	hidePanelEvent() {
		//@ts-ignore
		this.props.eng.fireEvent({}, 'hidePanel');
	};

	render() {
		return (
			<Tray
				color={this.props.color || "white"}
				onClick={(event) => {
					if (event.ctrlKey || event.metaKey) {
						const { commands } = this.props.app;
						commands.execute('docmanager:open', {
							path: this.props.path
						});
						return;
					}
					let node = this.selectedNode();
					this.addNode(node);
					this.connectLink(node);
					this.hidePanelEvent();
					this.forceUpdate();
				}}
				className="tray-item">
				{this.props.name}
			</Tray>
		);
	}
}