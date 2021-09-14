import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

import { MainAreaWidget } from '@jupyterlab/apputils';

import { ILauncher } from '@jupyterlab/launcher';

import { ReactDiagramWidget } from './diagram-widget'; 

import { xpipeIcon } from './icon';

/**
 * The command IDs used by the react-widget plugin.
 */
namespace CommandIDs {
  export const create = 'create-react-widget';
}

/**
 * Initialization data for the react-widget extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'react-widget',
  autoStart: true,
  optional: [ILauncher],
  activate: (app: JupyterFrontEnd, launcher: ILauncher) => {
    
    console.log("calling from activate")

    //var SRDapp = new Application();
    
    const { commands } = app;

    const command = CommandIDs.create;
    commands.addCommand(command, {
      caption: 'Create a new Xpipe File',
      label: 'Xpipe File',
      icon: (args) => (args['isPalette'] ? null : xpipeIcon),
      execute: () => {


        //var reactDiagramApp = new Application();
        
        const content = new ReactDiagramWidget();
        const widget = new MainAreaWidget<ReactDiagramWidget>({ content });
        widget.title.label = 'Xpipe Widget';
        widget.title.icon = xpipeIcon;
        app.shell.add(widget, 'main');
      },
    });

    if (launcher) {
      launcher.add({
        command,
      });
    }
  },
};

export default extension;