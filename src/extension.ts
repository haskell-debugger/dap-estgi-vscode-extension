// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as Net from 'net';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { platform } from 'process';
import { ProviderResult, TextDocument, CancellationToken } from 'vscode';

function showCodeRange(srcLoc : any) {
    var range = mkRangeFromJSON(srcLoc);

    // e.g. 'debug:haskell/main/Main.hs'
    var filePath = "debug:" + srcLoc.path;
    var openPath = vscode.Uri.parse(filePath, true);
    vscode.workspace.openTextDocument(openPath).then(doc =>
    {
        vscode.window.showTextDocument(doc).then(editor =>
        {
            // And the visible range jumps there too
            editor.revealRange(new vscode.Range(range.start, range.end));
            // Line added - by having a selection at the same position twice, the cursor jumps there
            editor.selections = [new vscode.Selection(range.start,range.end)];
        });
    });
}

type HeapValue = {
  variable: any;
  isRoot: boolean;
};

export class HeapValuesProvider implements vscode.TreeDataProvider<HeapValue> {
  private _onDidChangeTreeData: vscode.EventEmitter<HeapValue | undefined> = new vscode.EventEmitter<HeapValue | undefined>();
  readonly onDidChangeTreeData: vscode.Event<HeapValue | undefined> = this._onDidChangeTreeData.event;

  private topElement: any | undefined = undefined;

  getChildren(element?: HeapValue): ProviderResult<HeapValue[]> {
    console.log("getChildren:", element);
    if (vscode.debug.activeDebugSession === undefined || this.topElement === undefined) {
      return [];
    }

    if(element === undefined) {
      return [{variable: this.topElement, isRoot: true}];
    }
    if (element.variable.variablesReference === 0) {
      return [];
    }
    return vscode.debug.activeDebugSession?.customRequest('variables', {variablesReference: element.variable.variablesReference}).then(
      reply => reply.variables.map((v:any) => ({variable:v, isRoot: false}))
    );
  }
  getTreeItem(element: HeapValue): vscode.TreeItem | Thenable<vscode.TreeItem> {
    console.log("getTreeItem:", element);
    //var l : vscode.TreeItemLabel = {label: element.name, highlights:[[1,2], [3,4]]};
    var state = (element.variable.variablesReference === 0) ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;
    var item = new vscode.TreeItem(`${element.variable.name + (element.isRoot ? '' : ':')} ${element.variable.type || ''}`, state);
    //item.tooltip = new vscode.MarkdownString ("tooltip text\nline 2");
    item.tooltip = element.variable.value;
    item.description = element.variable.value.split('\n', 1)[0];
    item.command = {command: "dap-estgi.selectVariableGraphNode", title: "jump to graph node", arguments:[element]};

    //item.iconPath = new vscode.ThemeIcon("$(globe)");
    return item;
  }

  setRootValue(topVariable: any | undefined) {
    console.log("showRootValue:", topVariable);
    this.topElement = topVariable;
    this._onDidChangeTreeData.fire(undefined);
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  var heapValuesProvider = new HeapValuesProvider();
  vscode.window.createTreeView('dap-estgi.heapValuesView', {treeDataProvider: heapValuesProvider});

  vscode.debug.onDidChangeActiveDebugSession((e) => {
    // clear heap view to not show invalid data when the debug session is over
    heapValuesProvider.setRootValue(undefined);
  });

  vscode.debug.onDidReceiveDebugSessionCustomEvent(dapEvent => {
    console.log(dapEvent.event);
    switch (dapEvent.event) {
      case "showCode":
        showCodeRange(dapEvent.body);
        break;
      case "showValue":
        heapValuesProvider.setRootValue(dapEvent.body.variable);
        break;
      default:
        console.log("unknown custom event:", dapEvent);
        break;
    }
  });

  const dlprovider = new DLProvider();
  const clprovider = new CLProvider();

  context.subscriptions.push(vscode.languages.registerDocumentLinkProvider({scheme:'debug',language:'haskell'}, dlprovider));
  context.subscriptions.push(vscode.languages.registerCodeLensProvider({scheme:'debug',language:'haskell'}, clprovider));

  context.subscriptions.push(vscode.commands.registerCommand('dap-estgi.garbageCollect', () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.debug.activeDebugSession?.customRequest('garbageCollect');
    //window.showInformationMessage('Running garbage collection...');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('dap-estgi.showCallGraph', () => {
    vscode.debug.activeDebugSession?.customRequest('showCallGraph');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('dap-estgi.jumpToStg', (arg) => {
    /*
      - sessionId
      - container : type = Scope / Variable ; fields: [name]
      - variable
        - name
        - value
        - evaluateName
    */
    console.log('Running jump to stg...', arg);
    var jsonStr;
    ({variable:{evaluateName:jsonStr}} = arg);
    showCodeRange(JSON.parse(jsonStr));
  }));

  context.subscriptions.push(vscode.commands.registerCommand('dap-estgi.showGraphStructure', (x) => {
    console.log('Running show graph structure...', typeof x, x);
    vscode.debug.activeDebugSession?.customRequest('showVariableGraphStructure', {variablesReference: x.variable.variablesReference});
  }));

  context.subscriptions.push(vscode.commands.registerCommand('dap-estgi.selectVariableGraphNode', (x) => {
    console.log('Running select graph node...', typeof x, x);
    vscode.debug.activeDebugSession?.customRequest('selectVariableGraphNode', {variablesReference: x.variable.variablesReference});
  }));

  runDebugger (context, new MockDebugAdapterServerDescriptorFactory());
}

export function runDebugger (context: vscode.ExtensionContext, factory: MockDebugAdapterServerDescriptorFactory) {
  context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('dap-estgi', factory));
  console.log('made it to runDebugger');

  vscode.debug.onDidChangeBreakpoints((e) => {
    console.log(e, 'breakpoints changed hit');
  });

  vscode.debug.onDidChangeActiveDebugSession((e) => {
    console.log(e, 'active debug session hit');
  });

  vscode.debug.onDidReceiveDebugSessionCustomEvent((e) => {
    console.log(e, 'custom event received hit');
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}

class MockDebugAdapterServerDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {

  public server?: vscode.DebugAdapterServer;

  createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

    this.server = new vscode.DebugAdapterServer(4711, 'localhost');
    return this.server;
  }

  dispose() {
    console.log('in dispose MockAdapterDescriptorFactory');
  }
}

function mkRangeFromJSON(srcLoc : any) {
  // line and column numbers starts at 0
  var pos1 = new vscode.Position(srcLoc.start.line-1, srcLoc.start.column-1);
  var pos2 = new vscode.Position(srcLoc.end.line-1, srcLoc.end.column-1);
  return new vscode.Range(pos1, pos2);
}
class DLProvider implements vscode.DocumentLinkProvider {
  public provideDocumentLinks(document: TextDocument, token: CancellationToken): ProviderResult<vscode.DocumentLink[]> {
    return vscode.debug.activeDebugSession?.customRequest('getSourceLinks', {path: document.uri.path}).then(
      reply  => {
        return reply.sourceLinks.map((srcLink : any) => {
              // line and column numbers starts at 0
              var pos1 = new vscode.Position(srcLink.sourceLine-1, srcLink.sourceColumn-1);
              var pos2 = new vscode.Position(srcLink.sourceEndLine-1, srcLink.sourceEndColumn-1);
              var range = new vscode.Range(pos1, pos2);
              var uriStr = `debug:${srcLink.targetPath}#L${srcLink.targetLine},${srcLink.targetColumn}-L${srcLink.targetEndLine},${srcLink.targetEndColumn}`;
              return new vscode.DocumentLink(range, vscode.Uri.parse(uriStr, true));
            });
      });
  }
  public resolveDocumentLink(link: vscode.DocumentLink, token: CancellationToken): ProviderResult<vscode.DocumentLink> {
    return undefined;
  }
}

class CLProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(document: TextDocument, token: CancellationToken): ProviderResult<vscode.CodeLens[]> {
    return vscode.debug.activeDebugSession?.customRequest('getSourceLinks', {path: document.uri.path}).then(
      reply  => {
        return reply.sourceLinks.map((srcLink : any) => {
              // line and column numbers starts at 0
              var spos1 = new vscode.Position(srcLink.sourceLine-1, srcLink.sourceColumn-1);
              var spos2 = new vscode.Position(srcLink.sourceEndLine-1, srcLink.sourceEndColumn-1);
              var tpos1 = new vscode.Position(srcLink.targetLine-1, srcLink.targetColumn-1);
              var tpos2 = new vscode.Position(srcLink.targetEndLine-1, srcLink.targetEndColumn-1);
              var srange = new vscode.Range(spos1, spos2);
              var trange = new vscode.Range(tpos1, tpos2);
              var uri = vscode.Uri.parse('debug:'+srcLink.targetPath, true);
              var locations = [new vscode.Location(uri, trange)];
              var cmd = {
                    title: srcLink.targetPath,
                    command: "editor.action.peekLocations",
                    arguments: [document.uri, spos1, locations, 'peek']
                  };
              return new vscode.CodeLens(srange, cmd);
            });
      });
  }

  public resolveCodeLens(codeLens: vscode.CodeLens, token: CancellationToken): ProviderResult<vscode.CodeLens> {
    return undefined;
  }
}
