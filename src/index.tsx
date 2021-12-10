import React from 'react';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { commandIDs } from './components/xpipeBodyWidget';

import {
  ICommandPalette,
  IThemeManager,
  WidgetTracker,
  ReactWidget
} from '@jupyterlab/apputils';

import { ILauncher } from '@jupyterlab/launcher';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { XpipeFactory, XPipeDocModelFactory } from './xpipeFactory';

import { XPipeWidget } from './xpipeWidget';

import Sidebar from './components_xpipe/Sidebar';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { XpipesDebugger } from './debugger/SidebarDebugger';

import { ITranslator } from '@jupyterlab/translation';

import { Log, logPlugin } from './log/LogPlugin';

import { requestAPI } from './server/handler';

import { OutputPanel } from './kernel/panel';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

const FACTORY = 'Xpipes editor';

// Export a token so other extensions can require it
// export const IExampleDocTracker = new Token<IWidgetTracker<ExampleDocWidget>>(
//   'exampleDocTracker'
// );

/**
 * Initialization data for the documents extension.
 */
const xpipes: JupyterFrontEndPlugin<void> = {
  id: 'xpipes',
  autoStart: true,
  requires: [
    ICommandPalette,
    ILauncher,
    IFileBrowserFactory,
    ILayoutRestorer,
    IMainMenu,
    IRenderMimeRegistry,
    IDocumentManager,
    ITranslator
  ],

  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    launcher: ILauncher,
    browserFactory: IFileBrowserFactory,
    restorer: ILayoutRestorer,
    menu: IMainMenu,
    rendermime: IRenderMimeRegistry,
    docmanager: IDocumentManager,
    themeManager?: IThemeManager,
    translator?: ITranslator
  ) => {

    console.log('Xpipes is activated!');

    // Creating the widget factory to register it so the document manager knows about
    // our new DocumentWidget
    const widgetFactory = new XpipeFactory({
      name: FACTORY,
      modelName: 'xpipes-model',
      fileTypes: ['xpipes'],
      defaultFor: ['xpipes'],
      app: app,
      shell: app.shell,
      commands: app.commands,
      browserFactory: browserFactory,
      serviceManager: app.serviceManager
    });

    // register the filetype
    app.docRegistry.addFileType({
      name: 'xpipes',
      displayName: 'Xpipes',
      extensions: ['.xpipes'],
      iconClass: 'jp-XpipeLogo'
    });

    // Registering the widget factory
    app.docRegistry.addWidgetFactory(widgetFactory);

    const tracker = new WidgetTracker<XPipeWidget>({
      namespace: "Xpipes Tracker"
    });


    // Add the widget to the tracker when it's created
    widgetFactory.widgetCreated.connect((sender, widget) => {
      // Notify the instance tracker if restore data needs to update.
      void tracker.add(widget);

      // Notify the widget tracker if restore data needs to update
      widget.context.pathChanged.connect(() => {
        void tracker.save(widget);
      });
    });

    // Creating and registering the model factory for our custom DocumentModel
    const modelFactory = new XPipeDocModelFactory();
    app.docRegistry.addModelFactory(modelFactory);

    // Handle state restoration
    void restorer.restore(tracker, {
      command: commandIDs.openDocManager,
      args: widget => ({
        path: widget.context.path,
        factory: FACTORY
      }),
      name: widget => widget.context.path
    });

    // Creating the sidebar widget
    const sidebarWidget = ReactWidget.create(<Sidebar lab = {app} basePath = "xai_components"/>);
    sidebarWidget.id = 'xpipes-component-sidebar';
    sidebarWidget.title.iconClass = 'jp-ComponentLibraryLogo';
    sidebarWidget.title.caption = "Xpipes Component Library";

    restorer.add(sidebarWidget, sidebarWidget.id);
    app.shell.add(sidebarWidget, "left");

    // Creating the sidebar debugger
    const sidebarDebugger = new XpipesDebugger.Sidebar({ app, translator, widgetFactory})
    sidebarDebugger.id = 'xpipes-debugger-sidebar';
    sidebarDebugger.title.iconClass = 'jp-DebuggerLogo';
    sidebarDebugger.title.caption = "Xpipes Debugger";
    restorer.add(sidebarDebugger, sidebarDebugger.id);
    app.shell.add(sidebarDebugger, 'right', { rank: 1001 });
    
    // Add a command to open xpipes sidebar debugger
    app.commands.addCommand(commandIDs.openDebugger, {
      execute: () => {
        if (sidebarDebugger.isHidden) {
          app.shell.activateById(sidebarDebugger.id);
        }
      },
    });

    // Add a command for creating a new xpipes file.
    app.commands.addCommand(commandIDs.createNewXpipe, {
      label: 'Xpipes File',
      iconClass: 'jp-XpipeLogo',
      caption: 'Create a new xpipes file',
      execute: () => {
        app.commands
          .execute(commandIDs.newDocManager, {
            path: browserFactory.defaultBrowser.model.path,
            type: 'file',
            ext: '.xpipes'
          })
          .then(model =>
            app.commands.execute(commandIDs.openDocManager, {
              path: model.path,
              factory: FACTORY
            })
          );
      }
    });

    async function requestToGenerateArbitraryFile(path: string, pythonScript: string) {
      const dataToSend = { "currentPath": path.split(".xpipes")[0] + ".py", "compilePythonScript": pythonScript};

      try {
        const server_reply = await requestAPI<any>('file/generate', {
          body: JSON.stringify(dataToSend),
          method: 'POST',
        });

        return server_reply;
      } catch (reason) {
        console.error(
          `Error on POST /xpipes/file/generate ${dataToSend}.\n${reason}`
        );
      }
    };

    app.commands.addCommand(commandIDs.createArbitraryFile, {
      execute: async args => {
        const current_path = tracker.currentWidget.context.path;
        const path = current_path;
        const message = typeof args['pythonCode'] === undefined ? '' : (args['pythonCode'] as string);
        const showOutput = typeof args['showOutput'] === undefined ? false : (args['showOutput'] as boolean);
        const request = await requestToGenerateArbitraryFile(path, message); // send this file and create new file
        
        if (request["message"] == "completed") {
          const model_path = current_path.split(".xpipes")[0] + ".py";
          await app.commands.execute(
            commandIDs.openDocManager,
            {
              path: model_path
            }
          );
          docmanager.closeFile(model_path);
          if (showOutput) {
            alert(`${model_path} successfully compiled!`);
          }
        } else {
          alert("Failed to generate arbitrary file!");
        }
      }
    });

    let outputPanel: OutputPanel;
    /**
      * Creates a output panel.
      *
      * @returns The panel
      */
    async function createPanel(): Promise<OutputPanel> {
      outputPanel = new OutputPanel(app.serviceManager, rendermime, widgetFactory, translator);
      app.shell.add(outputPanel, 'main',{ 
        mode: 'split-bottom'
      } );
      return outputPanel;
    }

    // Execute xpipes python script and display at output panel
    app.commands.addCommand(commandIDs.executeToOutputPanel, {
    execute: async args => {
        const xpipesLogger = new Log(app);
        const message = typeof args['runCommand'] === 'undefined' ? '' : (args['runCommand'] as string);
        const debug_mode = typeof args['debug_mode'] === 'undefined' ? '' : (args['debug_mode'] as string);

        // Create the panel if it does not exist
        if (!outputPanel || outputPanel.isDisposed) {
          await createPanel();
        }else {
          outputPanel.dispose();
          await createPanel();
        }

        outputPanel.session.ready.then(() => {
          const current_path = tracker.currentWidget.context.path;
          const model_path = current_path.split(".xpipes")[0] + ".py";
          const code = "%run " + model_path + message + debug_mode;
          outputPanel.execute(code, xpipesLogger);
        });
      },
    });

    // Add a launcher item if the launcher is available.
    if (launcher) {
      launcher.add({
        command: commandIDs.createNewXpipe,
        rank: 1,
        category: 'Other'
      });
    }
  },
};

/**
 * Export the plugins as default.
 */
 const plugins: JupyterFrontEndPlugin<any>[] = [
  xpipes,
  logPlugin
];

export default plugins;
