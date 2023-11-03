import * as vscode from 'vscode';

interface RegionSummary {
  kind: "RegionSummary";
  name: string;
  instanceCount: number;
  objectCount: number;
}

interface RegionInstance {
  kind: "RegionInstance";
  name: string;
  instanceId: number;
  objectCount: number;
  variable: any;
}

interface RegionObject {
  kind: "RegionObject";
  variable: any;
}

type RegionItem = RegionSummary | RegionInstance | RegionObject;

/*
  region tree view:
    region summary: name, instances, object count (tree item)
      + region instance: object count
        + object

  requests:
    regions
      arg:      none
      returns:  list of region summaries

    regionInstances
      arg:      region name
      returns:  list of region instances

  types:
    RegionSummary:
      name (unique)
      instanceCount
      objectCount

    RegionInstance:
      objectCount
      variablesReference
*/

export class RegionsProvider implements vscode.TreeDataProvider<RegionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RegionItem | undefined> = new vscode.EventEmitter<RegionItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<RegionItem | undefined> = this._onDidChangeTreeData.event;

  getChildren(element?: RegionItem): vscode.ProviderResult<RegionItem[]> {
    console.log("region getChildren:", element);

    if (vscode.debug.activeDebugSession === undefined) {
      return [];
    }

    if(element === undefined) {
      return vscode.debug.activeDebugSession?.customRequest('regions').then(
        reply => reply.regions.map(
          (r:any) =>
            ({ kind: "RegionSummary"
             , name: r.name
             , instanceCount: r.instanceCount
             , objectCount: r.objectCount
             })));
    }

    switch (element.kind) {
      case "RegionSummary":
        return vscode.debug.activeDebugSession?.customRequest('regionInstances', {regionName: element.name}).then(
          reply => reply.regionInstances.map(
            (i:any) =>
              ({ kind: "RegionInstance"
               , name: element.name
               , instanceId: i.instanceId
               , objectCount: i.objectCount
               , variable: {variablesReference: i.variablesReference}
               })));

      case "RegionInstance":
      case "RegionObject":
        if (element.variable.variablesReference === 0) {return [];}
        return vscode.debug.activeDebugSession?.customRequest('variables', {variablesReference: element.variable.variablesReference}).then(
          reply => reply.variables.map(
            (v:any) =>
              ({ kind: "RegionObject"
               , variable: v
               })));
    }
    return [];
  }

  getTreeItem(element: RegionItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    console.log("region getTreeItem:", element);
    switch (element.kind) {
      case "RegionSummary": {
        var state = element.instanceCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        var item = new vscode.TreeItem(element.name, state);
        item.description = `${element.instanceCount} instances`;
        return item;
      }
      case "RegionInstance": {
        var state = element.variable.variablesReference > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        state = vscode.TreeItemCollapsibleState.None; // disable object browsing
        var item = new vscode.TreeItem(`instance ${element.instanceId}:`, state);
        item.description = `${element.objectCount} objects`;
        return item;
      }
      case "RegionObject": {
        var state = element.variable.variablesReference > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        var item = new vscode.TreeItem(`${element.variable.name}: ${element.variable.type || ''}`, state);
        item.tooltip = element.variable.value;
        item.description = element.variable.value.split('\n', 1)[0];
        item.command = {command: "dap-estgi.selectVariableGraphNode", title: "jump to graph node", arguments:[element]};
        return item;
      }
    }
  }

  refresh() {
    console.log("region refresh");
    this._onDidChangeTreeData.fire(undefined);
  }
}
