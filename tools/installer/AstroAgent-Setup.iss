[Setup]
AppName=AstroAgent
AppVersion=30.0.0
DefaultDirName={autopf}\AstroAgent
DefaultGroupName=AstroAgent
UninstallDisplayIcon={app}\AstroAgent.exe
Compression=lzma2
SolidCompression=yes
OutputDir=userdocs:InnoSetupOutput
OutputBaseFilename=AstroAgent-Setup

[Files]
Source: "AstroAgent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "packages\*"; DestDir: "{app}\packages"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\AstroAgent"; Filename: "{app}\AstroAgent.exe"
Name: "{commondesktop}\AstroAgent"; Filename: "{app}\AstroAgent.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; GroupDescription: "Additional icons:"; Flags: unchecked

[Run]
Filename: "https://nodejs.org/en/download/"; Description: "Please ensure Node.js is installed before running AstroAgent."; Flags: runascurrentuser postinstall shellexec
Filename: "{app}\AstroAgent.exe"; Description: "Launch AstroAgent"; Flags: nowait postinstall skipifsilent
