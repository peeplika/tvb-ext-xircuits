import { JupyterFrontEnd } from '@jupyterlab/application';
import { commandIDs } from '../components/xircuitBodyWidget';
import { ITranslator } from '@jupyterlab/translation';
import { IXircuitsDocTracker } from '../index';
import * as _ from 'lodash';
import { CustomNodeModel } from '../components/CustomNodeModel';
import { XPipePanel } from '../xircuitWidget';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { DefaultLinkModel } from '@projectstorm/react-diagrams';
import { BaseModel, BaseModelGenerics } from '@projectstorm/react-canvas-core';

/**
 * Add the commands for the xircuits's context menu.
 */
export function addContextMenuCommands(
    app: JupyterFrontEnd,
    tracker: IXircuitsDocTracker,
    translator: ITranslator
): void {
    const trans = translator.load('jupyterlab');
    const { commands, shell } = app;

    /**
     * Whether there is an active xircuits.
     */
    function isEnabled(): boolean {
        return (
            tracker.currentWidget !== null &&
            tracker.currentWidget === shell.currentWidget
        );
    }

    //Add command to cut node
    commands.addCommand(commandIDs.cutNode, {
        execute: cutNode,
        label: trans.__('Cut'),
        isEnabled: () => {
            const widget = tracker.currentWidget?.content as XPipePanel;
            const selectedEntities = widget.xircuitsApp.getDiagramEngine().getModel().getSelectedEntities();
            let isNodeSelected: boolean;
            if (selectedEntities.length > 0) {
                isNodeSelected = true
            }
            return isNodeSelected ?? false;
        }
    });

    //Add command to copy node
    commands.addCommand(commandIDs.copyNode, {
        execute: copyNode,
        label: trans.__('Copy'),
        isEnabled: () => {
            const widget = tracker.currentWidget?.content as XPipePanel;
            const selectedEntities = widget.xircuitsApp.getDiagramEngine().getModel().getSelectedEntities();
            let isNodeSelected: boolean;
            if (selectedEntities.length > 0) {
                isNodeSelected = true
            }
            return isNodeSelected ?? false;
        }
    });

    //Add command to paste node
    commands.addCommand(commandIDs.pasteNode, {
        execute: pasteNode,
        label: trans.__('Paste'),
        isEnabled: () => {
            const clipboard = JSON.parse(localStorage.getItem('clipboard'));
            let isClipboardFilled: boolean
            if (clipboard) {
                isClipboardFilled = true
            }
            return isClipboardFilled ?? false;
        }
    });

    //Add command to edit literal component
    commands.addCommand(commandIDs.editNode, {
        execute: editLiteral,
        label: trans.__('Edit'),
        isEnabled: () => {
            const widget = tracker.currentWidget?.content as XPipePanel;
            const selectedEntities = widget.xircuitsApp.getDiagramEngine().getModel().getSelectedEntities();
            let isNodeSelected: boolean;
            _.forEach(selectedEntities, (model) => {
                if (model.getOptions()["name"].startsWith("Literal")) {
                    isNodeSelected = true;
                }
            });
            return isNodeSelected ?? false;
        }
    });

    //Add command to delete node
    commands.addCommand(commandIDs.deleteNode, {
        execute: deleteNode,
        label: "Delete",
        isEnabled: () => {
            const widget = tracker.currentWidget?.content as XPipePanel;
            const selectedEntities = widget.xircuitsApp.getDiagramEngine().getModel().getSelectedEntities();
            let isNodeSelected: boolean
            if (selectedEntities.length > 0) {
                isNodeSelected = true
            }
            return isNodeSelected ?? false;
        }
    });

    function cutNode(): void {
        const widget = tracker.currentWidget?.content as XPipePanel;

        if (widget) {
            const engine = widget.xircuitsApp.getDiagramEngine();
            const selected = widget.xircuitsApp.getDiagramEngine().getModel().getSelectedEntities()
            const copies = selected.map(entity =>
                entity.clone().serialize()
            );

            // TODO: Need to make this event working to be on the command manager, so the user can undo
            // and redo it.
            // engine.fireEvent(
            //     {
            //         nodes: selected,
            //         links: selected.reduce(
            //             (arr, node) => [...arr, ...node.getAllLinks()],
            //             [],
            //         ),
            //     },
            //     'entitiesRemoved',
            // );
            selected.forEach(node => node.remove());
            engine.repaintCanvas();

            localStorage.setItem('clipboard', JSON.stringify(copies));

        }
    }

    function copyNode(): void {
        const widget = tracker.currentWidget?.content as XPipePanel;

        if (widget) {
            const copies = widget.xircuitsApp.getDiagramEngine().getModel().getSelectedEntities().map(entity =>
                entity.clone().serialize(),
            );

            localStorage.setItem('clipboard', JSON.stringify(copies));

        }
    }

    function pasteNode(): void {
        const widget = tracker.currentWidget?.content as XPipePanel;

        if (widget) {
            const engine = widget.xircuitsApp.getDiagramEngine();
            const model = widget.xircuitsApp.getDiagramEngine().getModel();

            const clipboard = JSON.parse(localStorage.getItem('clipboard'));
            if (!clipboard) return;

            model.clearSelection();

            const models = clipboard.map(serialized => {
                const modelInstance = model
                    .getActiveNodeLayer()
                    .getChildModelFactoryBank(engine)
                    .getFactory(serialized.type)
                    .generateModel({ initialConfig: serialized });

                modelInstance.deserialize({
                    engine: engine,
                    data: serialized,
                    registerModel: () => { },
                    getModel: function <T extends BaseModel<BaseModelGenerics>>(id: string): Promise<T> {
                        throw new Error('Function not implemented.');
                    }
                });

                return modelInstance;
            });

            models.forEach(modelInstance => {
                const oldX = modelInstance.getX();
                const oldY = modelInstance.getY();

                modelInstance.setPosition(oldX + 10, oldY + 10)
                model.addNode(modelInstance);
                // Remove any empty/default node
                if(modelInstance.getOptions()['type'] == 'default') model.removeNode(modelInstance)
                modelInstance.setSelected(true);
            });

            localStorage.setItem(
                'clipboard',
                JSON.stringify(
                    models.map(modelInstance =>
                        modelInstance.clone().serialize(),
                    ),
                ),
            );
            // TODO: Need to make this event working to be on the command manager, so the user can undo
            // and redo it.
            // engine.fireEvent({ nodes: models }, 'componentsAdded');
            widget.xircuitsApp.getDiagramEngine().repaintCanvas();
        }
    }

    function editLiteral(): void {
        const widget = tracker.currentWidget?.content as XPipePanel;

        if (widget) {
            const selectedEntities = widget.xircuitsApp.getDiagramEngine().getModel().getSelectedEntities();
            _.forEach(selectedEntities, (model) => {

                let node = null;
                let links = widget.xircuitsApp.getDiagramEngine().getModel()["layers"][0]["models"];
                let oldValue = model.getPorts()["out-0"].getOptions()["label"]

                // Prompt the user to enter new value
                let theResponse = window.prompt('Enter New Value (Without Quotes):', oldValue);
                if (theResponse == null || theResponse == "" || theResponse == oldValue) {
                    // When Cancel is clicked or no input provided, just return
                    return
                }
                node = new CustomNodeModel({ name: model["name"], color: model["color"], extras: { "type": model["extras"]["type"] } });
                node.addOutPortEnhance(theResponse, 'out-0');

                // Set new node to old node position
                let position = model.getPosition();
                node.setPosition(position);
                widget.xircuitsApp.getDiagramEngine().getModel().addNode(node);

                // Update the links
                for (let linkID in links) {

                    let link = links[linkID];

                    if (link["sourcePort"] && link["targetPort"]) {

                        let newLink = new DefaultLinkModel();

                        let sourcePort = node.getPorts()["out-0"];
                        newLink.setSourcePort(sourcePort);

                        // This to make sure the new link came from the same literal node as previous link
                        let sourceLinkNodeId = link["sourcePort"].getParent().getID()
                        let sourceNodeId = model.getOptions()["id"]
                        if (sourceLinkNodeId == sourceNodeId) {
                            newLink.setTargetPort(link["targetPort"]);
                        }

                        widget.xircuitsApp.getDiagramEngine().getModel().addLink(newLink)
                    }
                }

                // Remove old node
                model.remove();
            });
        }
    }

    function deleteNode(): void {
        const widget = tracker.currentWidget?.content as XPipePanel;

        if (widget) {
            const selectedEntities = widget.xircuitsApp.getDiagramEngine().getModel().getSelectedEntities();
            _.forEach(selectedEntities, (model) => {
                if (model.getOptions()["name"] !== "undefined") {
                    let modelName = model.getOptions()["name"];
                    const errorMsg = `${modelName} node cannot be deleted!`
                    if (modelName !== 'Start' && modelName !== 'Finish') {
                        if (!model.isLocked()) {
                            model.remove()
                        } else {
                            showDialog({
                                title: 'Locked Node',
                                body: errorMsg,
                                buttons: [Dialog.warnButton({ label: 'OK' })]
                            });
                        }
                    }
                    else {
                        showDialog({
                            title: 'Undeletable Node',
                            body: errorMsg,
                            buttons: [Dialog.warnButton({ label: 'OK' })]
                        });
                    }
                }
            });
            widget.xircuitsApp.getDiagramEngine().repaintCanvas();
        }
    }
}