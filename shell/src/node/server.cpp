#include "server.h"
#include <windows.h>
#include <shlobj.h>
#include <string>
#include <thread>
#include <vector>
#include <utility>
#include <atomic>
#include <iostream>
#include "../core/globals.h"
#include "../ui/mainwindow.h"
#include "../utils/crashlog.h"
#include "../utils/helpers.h"

static void NodeOutputThreadProc()
{
    char buf[1024];
    DWORD readSz=0;
    while(g_nodeRunning){
        BOOL ok = ReadFile(g_nodeOutPipe, buf, sizeof(buf)-1, &readSz, nullptr);
        if(!ok || readSz==0) break;
        buf[readSz]='\0';
        std::cout<<"[node] "<<buf;
    }
    std::cout<<"NodeOutputThreadProc done.\n";
}

static std::wstring TrimSlashes(std::wstring s)
{
    while (!s.empty() && (s.back() == L'\\' || s.back() == L'/')) s.pop_back();
    return s;
}

static std::wstring RegInstallLocation(HKEY root, const wchar_t* key)
{
    wchar_t buf[MAX_PATH * 2];
    DWORD size = sizeof(buf);
    if (RegGetValueW(root, key, L"InstallLocation", RRF_RT_REG_SZ, nullptr, buf, &size) == ERROR_SUCCESS)
        return TrimSlashes(buf);
    return L"";
}

static std::wstring KnownFolder(int csidl)
{
    wchar_t buf[MAX_PATH];
    return SUCCEEDED(SHGetFolderPathW(nullptr, csidl, nullptr, 0, buf)) ? std::wstring(buf) : L"";
}

// Public builds don't ship Stremio's streaming server (it isn't open source), so it's taken from
// an installed Stremio 5 or Stremio Service. Both installers share one Windows install ID, which
// records where they went; the usual folders are checked too. (Stremio 4 has no separate server
// runtime, so it can't be used here, but its server works while Stremio 4 itself is running.)
static bool FindServerDir(std::wstring& dir)
{
    std::vector<std::wstring> candidates = { GetExeDirectory() };
    const wchar_t* uninstallKey = L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{DD3870DA-AF3C-4C73-B010-72944AB610C6}_is1";
    const wchar_t* uninstallKey32 = L"Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{DD3870DA-AF3C-4C73-B010-72944AB610C6}_is1";
    for (auto [root, key] : { std::pair{HKEY_CURRENT_USER, uninstallKey}, std::pair{HKEY_LOCAL_MACHINE, uninstallKey}, std::pair{HKEY_LOCAL_MACHINE, uninstallKey32} }) {
        std::wstring loc = RegInstallLocation(root, key);
        if (!loc.empty()) candidates.push_back(loc);
    }
    std::wstring local = KnownFolder(CSIDL_LOCAL_APPDATA);
    std::wstring programFiles = KnownFolder(CSIDL_PROGRAM_FILES);
    for (const wchar_t* sub : { L"\\Programs\\StremioService", L"\\Programs\\Stremio" })
        if (!local.empty()) candidates.push_back(local + sub);
    for (const wchar_t* sub : { L"\\StremioService", L"\\Stremio Service", L"\\Stremio" })
        if (!programFiles.empty()) candidates.push_back(programFiles + sub);

    for (const auto& c : candidates) {
        if (FileExists(c + L"\\stremio-runtime.exe") && FileExists(c + L"\\server.js")) {
            dir = c;
            return true;
        }
    }
    return false;
}

bool StartNodeServer()
{
    std::wstring exeDir;
    if (!FindServerDir(exeDir)) {
        AppendToCrashLog(L"[NODE]: No streaming server found (not bundled; no Stremio 5 or Stremio Service install). "
                         L"Torrents work only if a Stremio server is already running.");
        return false;
    }
    std::wstring exePath = exeDir + L"\\stremio-runtime.exe";
    std::wstring scriptPath = exeDir + L"\\server.js";

    if (!g_serverJob) {
        g_serverJob = CreateJobObject(nullptr, nullptr);
        if(!g_serverJob){
            AppendToCrashLog(L"[NODE]: Failed to create Job Object.");
            return false;
        }
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION jobInfo = {0};
        jobInfo.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(g_serverJob, JobObjectExtendedLimitInformation, &jobInfo, sizeof(jobInfo));
    }

    SECURITY_ATTRIBUTES sa;ZeroMemory(&sa, sizeof(sa));
    sa.nLength = sizeof(sa);
    sa.bInheritHandle = TRUE;

    HANDLE outR=nullptr, outW=nullptr;
    if(!CreatePipe(&outR,&outW,&sa,0)){
        AppendToCrashLog(L"[NODE]: CreatePipe fail1");
        return false;
    }
    SetHandleInformation(outR,HANDLE_FLAG_INHERIT,0);

    HANDLE inR=nullptr, inW=nullptr;
    if(!CreatePipe(&inR,&inW,&sa,0)){
        AppendToCrashLog(L"[NODE]: CreatePipe fail2");
        CloseHandle(outR);CloseHandle(outW);
        return false;
    }
    SetHandleInformation(inW,HANDLE_FLAG_INHERIT,0);

    STARTUPINFOW si;ZeroMemory(&si,sizeof(si));
    si.cb=sizeof(si);
    si.hStdOutput=outW; si.hStdError=outW; si.hStdInput=inR;
    si.dwFlags=STARTF_USESTDHANDLES;

    PROCESS_INFORMATION pi;ZeroMemory(&pi,sizeof(pi));
    // Full paths, run from the server's own folder: it may live in Stremio Service's or
    // Stremio's install, and it looks for ffmpeg next to itself.
    std::wstring cmdLine = L"\"" + exePath + L"\" \"" + scriptPath + L"\"";

    SetEnvironmentVariableW(L"NO_CORS", L"1");
    BOOL success = CreateProcessW(
        exePath.c_str(), &cmdLine[0],
        nullptr,nullptr, TRUE,
        CREATE_NO_WINDOW,nullptr,exeDir.c_str(),
        &si, &pi
    );
    CloseHandle(inR);
    CloseHandle(outW);
    if(!success){
        std::wstring err = L"Failed to launch stremio-runtime.exe\nGetLastError=" + std::to_wstring(GetLastError());
        AppendToCrashLog(err);
        CloseHandle(inW);CloseHandle(outR);
        return false;
    }

    // Ensure the process belongs to the job
    AssignProcessToJobObject(g_serverJob, pi.hProcess);

    g_nodeProcess = pi.hProcess;
    CloseHandle(pi.hThread);

    g_nodeRunning = true;
    g_nodeOutPipe = outR;
    g_nodeInPipe  = inW;
    g_nodeThread  = std::thread(NodeOutputThreadProc);

    std::cout<<"Node server started.\n";

    // Let front-end know:
    nlohmann::json j;
    j["type"] ="ServerStarted";
    g_outboundMessages.push_back(j);
    PostMessage(g_hWnd, WM_NOTIFY_FLUSH, 0, 0);

    return true;
}

void StopNodeServer()
{
    if(g_nodeRunning){
        g_nodeRunning=false;
        if(g_nodeProcess){
            TerminateProcess(g_nodeProcess,0);
            WaitForSingleObject(g_nodeProcess,INFINITE);
            CloseHandle(g_nodeProcess); g_nodeProcess=nullptr;
        }
        if(g_nodeThread.joinable()) g_nodeThread.join();
        if(g_nodeOutPipe){CloseHandle(g_nodeOutPipe); g_nodeOutPipe=nullptr;}
        if(g_nodeInPipe){CloseHandle(g_nodeInPipe);   g_nodeInPipe=nullptr;}
        std::cout<<"Node server stopped.\n";
    }
}
