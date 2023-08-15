# dap-estgi-extension <img src="https://user-images.githubusercontent.com/875324/235317448-1cf2d543-40a8-4eaa-b765-6576ddd7f84f.png" width="5%" />

# Table of Contents
1. [VSCode setup](#vscode-setup)
2. [Run](#run)
3. [Usage](#usage)

## VSCode setup

Enable `allow breakpoints everywhere` option in VSCode settings.

## Run

  - Open `dap-estgi-vscode-extension` folder by using the `Files/Open Folder` menu.
  - Open the `src/extension.ts` file.
  - press F5 to run the extension in a new VSCode window.

## Usage

- Open your project folder that was compiled with `ghc-wpc` or `wpc-plugin`
- Select the debug view on the side bar
- Click to `create a launch.json file`, then select `Haskell DAP ESTGi`
- Edit the `program` field to be more specific with the application name if the debugee project has multiple executables
	- If there is only one executable then the default value should work
    - A more specific pattern would be: `"program": "${workspaceFolder}/--EXECUTABLE_NAME-ghc_stgapp"`
- Start `dap` server: `(cd dap-estgi-server ; stack run)`
- Press F5
