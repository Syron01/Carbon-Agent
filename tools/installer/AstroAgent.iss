[Setup]
AppName=Astro Agent
AppVersion=31.0.0
DefaultDirName={pf}\Astro Agent
DefaultGroupName=Astro Agent
OutputDir=C:\Users\theay\Desktop
OutputBaseFilename=AstroAgent_Kurulum_Sihirbazi
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "C:\Users\theay\Desktop\Astro-Agent-Dev\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".git\*,AstroAgent_Kurulum_Sihirbazi.exe,*.log,AstroAgent.exe"

[Icons]
Name: "{commondesktop}\Astro Agent"; Filename: "cmd.exe"; Parameters: "/c """"cd /d """"{app}"""" && npm start"""""; IconFilename: "cmd.exe"
Name: "{group}\Astro Agent"; Filename: "cmd.exe"; Parameters: "/c """"cd /d """"{app}"""" && npm start"""""; IconFilename: "cmd.exe"

[Run]
Filename: "{commondesktop}\Astro Agent.lnk"; Description: "Astro Agent'ı Başlat"; Flags: postinstall shellexec nowait skipifsilent
