; Streamio Orbit Setup (NSIS 3).
; Build:  makensis -DVERSION=0.1.0 installer/streamio-orbit.nsi
; Expects the app staged by:  (cd shell && PUBLIC=1 ./package.sh ../release/public-stage)

Unicode true
ManifestDPIAware true

!define APP_NAME   "Streamio Orbit"
!define APP_EXE    "Streamio Orbit.exe"
!define APP_ID     "StreamioOrbit"
!define PUBLISHER  "Streamio Orbit (unofficial Stremio community fork)"
!define HOMEPAGE   "https://github.com/Inas1234/streamio-orbit"
!define STREMIO_URL "https://www.stremio.com/downloads"
!define STREMIO_ID  "{DD3870DA-AF3C-4C73-B010-72944AB610C6}_is1" ; shared by Stremio 5 and Stremio Service
!define WEBVIEW2_URL "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
!ifndef VERSION
  !define VERSION "0.1.0"
!endif
!ifndef STAGE
  !define STAGE "..\release\public-stage"
!endif

Name "${APP_NAME}"
OutFile "..\release\Streamio-Orbit-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "${UNINST_KEY}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "${APP_NAME} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} Setup"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" "GPL-3.0. Not affiliated with Stremio."

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"

!define MUI_ICON   "..\shell\images\watch.ico"
!define MUI_UNICON "..\shell\images\watch.ico"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TEXT "This will install ${APP_NAME} ${VERSION}, a faster, cleaner Stremio app.$\r$\n$\r$\nYour Stremio account, addons and library work as usual.$\r$\n$\r$\n${APP_NAME} is an unofficial community project, not affiliated with Stremio.$\r$\n$\r$\nClick Next to continue."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; Finish page: start the app, and offer Stremio Service if no streaming server is installed.
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Start ${APP_NAME}"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchApp
!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Get Stremio 5 (needed for torrent streams)"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION OpenServicePage
!define MUI_PAGE_CUSTOMFUNCTION_SHOW FinishShow
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Var HasServer

; Stremio's streaming server isn't bundled (not open source); the app uses the one from an
; installed Stremio 5 or Stremio Service. (Stremio 4 has no separate server runtime.)
!macro _CheckServerDir DIR
  ${If} ${FileExists} "${DIR}\server.js"
  ${AndIf} ${FileExists} "${DIR}\stremio-runtime.exe"
    StrCpy $HasServer 1
  ${EndIf}
!macroend
Function DetectServer
  StrCpy $HasServer 0
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${STREMIO_ID}" "InstallLocation"
  ${If} $0 != ""
    !insertmacro _CheckServerDir "$0"
  ${EndIf}
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${STREMIO_ID}" "InstallLocation"
  ${If} $0 != ""
    !insertmacro _CheckServerDir "$0"
  ${EndIf}
  !insertmacro _CheckServerDir "$LOCALAPPDATA\Programs\StremioService"
  !insertmacro _CheckServerDir "$LOCALAPPDATA\Programs\Stremio"
  !insertmacro _CheckServerDir "$PROGRAMFILES64\Stremio"
FunctionEnd

Function CheckWebView2
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    MessageBox MB_YESNO|MB_ICONINFORMATION "${APP_NAME} needs the Microsoft Edge WebView2 Runtime, which isn't installed.$\r$\n$\r$\nOpen Microsoft's download page now? (Install it, then start ${APP_NAME}.)" /SD IDNO IDNO +2
      ExecShell "open" "${WEBVIEW2_URL}"
  ${EndIf}
FunctionEnd

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "${APP_NAME} needs 64-bit Windows." /SD IDOK
    Abort
  ${EndIf}
FunctionEnd

Section "Install"
  ; Close a running copy so its files can be replaced.
  nsExec::Exec 'taskkill /IM "${APP_EXE}" /F'
  Sleep 500

  SetOutPath "$INSTDIR"
  ; Replace the interface wholesale so old builds don't leave stale files behind.
  RMDir /r "$INSTDIR\ui"
  File /r "${STAGE}\*.*"
  File "..\LICENSE.md"
  File "..\THIRD-PARTY-NOTICES.md"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortcut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Apps & features entry.
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "${HOMEPAGE}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"

  Call CheckWebView2
  Call DetectServer
  ; The finish-page checkbox is easy to miss, so say it plainly.
  ${If} $HasServer == 0
    MessageBox MB_OK|MB_ICONINFORMATION "One more step for torrent streams: install Stremio 5 on this PC.$\r$\n$\r$\nStreamio Orbit plays torrents through Stremio's streaming server, which it isn't allowed to include. Get Stremio 5 from stremio.com (the next screen has a link), then start Streamio Orbit.$\r$\n$\r$\nDirect (HTTP/debrid) streams work without it." /SD IDOK
  ${EndIf}
SectionEnd

Function FinishShow
  ; Only offer Stremio Service when no streaming server was found.
  ${If} $HasServer == 1
    SendMessage $mui.FinishPage.ShowReadme ${BM_SETCHECK} ${BST_UNCHECKED} 0
    ShowWindow $mui.FinishPage.ShowReadme ${SW_HIDE}
  ${EndIf}
FunctionEnd

Function LaunchApp
  ; Start it as a normal process (not elevated, own working folder).
  SetOutPath "$INSTDIR"
  Exec '"$INSTDIR\${APP_EXE}"'
FunctionEnd

Function OpenServicePage
  ExecShell "open" "${STREMIO_URL}"
FunctionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM "${APP_EXE}" /F'
  Sleep 500

  Delete "$SMPROGRAMS\${APP_NAME}.lnk"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  DeleteRegKey HKCU "${UNINST_KEY}"

  ; App files.
  RMDir /r "$INSTDIR\ui"
  Delete "$INSTDIR\*.exe"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\LICENSE.md"
  Delete "$INSTDIR\THIRD-PARTY-NOTICES.md"

  ; Sign-in, library cache and settings live next to the app. Keep them unless asked
  ; (silent uninstalls keep them too).
  MessageBox MB_YESNO|MB_ICONQUESTION "Also remove your ${APP_NAME} settings and sign-in data?$\r$\n$\r$\n(Your Stremio account and library stay safe online either way.)" /SD IDNO IDNO keep
    RMDir /r "$INSTDIR\${APP_EXE}.WebView2"
    RMDir /r "$INSTDIR\portable_config"
  keep:
  RMDir "$INSTDIR"
SectionEnd
