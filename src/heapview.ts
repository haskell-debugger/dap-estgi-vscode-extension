import * as vscode from 'vscode';

type HeapValue = {
  variable: any;
  isRoot: boolean;
};

export class HeapValuesProvider implements vscode.TreeDataProvider<HeapValue> {
  private _onDidChangeTreeData: vscode.EventEmitter<HeapValue | undefined> = new vscode.EventEmitter<HeapValue | undefined>();
  readonly onDidChangeTreeData: vscode.Event<HeapValue | undefined> = this._onDidChangeTreeData.event;

  private topElement: any | undefined = undefined;

  getChildren(element?: HeapValue): vscode.ProviderResult<HeapValue[]> {
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
