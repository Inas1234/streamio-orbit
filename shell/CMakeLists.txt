cmake_minimum_required(VERSION 3.16)

project(stremio VERSION "5.0.22")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

option(DEBUG_LOG "Allow debug logs" ON)

# Locate MPV
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
    # 64-bit architecture
    set(MPV_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/deps/libmpv/x86_64/include")
    set(MPV_LIBRARY "${CMAKE_CURRENT_SOURCE_DIR}/deps/libmpv/x86_64/mpv.lib")
    set(MPV_DLL "${CMAKE_CURRENT_SOURCE_DIR}/deps/libmpv/x86_64/libmpv-2.dll")

    set(DISCORD_LIB "${CMAKE_CURRENT_SOURCE_DIR}/deps/discord-rpc/win64-static/lib/discord-rpc.lib")
    set(DISCORD_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/deps/discord-rpc/win64-static/include")
else()
    # 32-bit architecture
    set(MPV_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/deps/libmpv/i686/include")
    set(MPV_LIBRARY "${CMAKE_CURRENT_SOURCE_DIR}/deps/libmpv/i686/mpv.lib")
    set(MPV_DLL "${CMAKE_CURRENT_SOURCE_DIR}/deps/libmpv/i686/libmpv-2.dll")

    set(DISCORD_LIB "${CMAKE_CURRENT_SOURCE_DIR}/deps/discord-rpc/win32-static/lib/discord-rpc.lib")
    set(DISCORD_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/deps/discord-rpc/win32-static/include")
endif()

if(MINGW)
    # MinGW build (no Visual Studio): compatibility headers stand in for WIL/WRL and discord-rpc,
    # WebView2 and mpv are linked from their DLLs, nlohmann/json is header-only from deps/.
    set(MPV_LIBRARY "${CMAKE_CURRENT_SOURCE_DIR}/deps/libmpv/x86_64/libmpv.dll.a")
    set(WEBVIEW2_DIR "${CMAKE_CURRENT_SOURCE_DIR}/deps/webview2/build/native")
    set(WEBVIEW2_LIBRARY "${WEBVIEW2_DIR}/x64/WebView2Loader.dll")
    set(DISCORD_LIB "")
    include_directories(BEFORE "${CMAKE_CURRENT_SOURCE_DIR}/src/compat/mingw")
    include_directories("${WEBVIEW2_DIR}/include" "${CMAKE_CURRENT_SOURCE_DIR}/deps")
else()
    include_directories(${DISCORD_INCLUDE_DIR})
    find_package(nlohmann_json CONFIG REQUIRED)
    find_package(unofficial-webview2 CONFIG REQUIRED)
endif()
include_directories(${MPV_INCLUDE_DIR})

find_package(OpenSSL REQUIRED)
find_package(CURL REQUIRED)

set(SOURCES
        src/main.cpp
        stremio.rc
        src/core/globals.h
        src/core/globals.cpp
        src/utils/helpers.h
        src/utils/helpers.cpp
        src/utils/config.h
        src/utils/config.cpp
        src/utils/crashlog.h
        src/utils/crashlog.cpp
        src/mpv/player.h
        src/mpv/player.cpp
        src/node/server.cpp
        src/node/server.h
        src/tray/tray.h
        src/tray/tray.cpp
        src/ui/splash.h
        src/ui/splash.cpp
        src/updater/updater.cpp
        src/updater/updater.h
        src/webview/webview.h
        src/webview/webview.cpp
        src/ui/mainwindow.h
        src/ui/mainwindow.cpp
        src/resource.h
        src/utils/extensions.cpp
        src/utils/extensions.h
        src/utils/discord.cpp
        src/utils/discord.h
)

add_executable(${PROJECT_NAME} WIN32 ${SOURCES})
set_target_properties(${PROJECT_NAME} PROPERTIES OUTPUT_NAME "Streamio Orbit")


if(MINGW)
    target_link_libraries(${PROJECT_NAME} PRIVATE
            gdiplus dwmapi shcore msimg32 winhttp shlwapi
            ole32 oleaut32 uuid comctl32 version
            "${WEBVIEW2_LIBRARY}"
            OpenSSL::SSL
            OpenSSL::Crypto
            CURL::libcurl
            ${MPV_LIBRARY}
    )
    # No MinGW runtime DLLs needed next to the exe.
    target_link_options(${PROJECT_NAME} PRIVATE -static-libgcc -static-libstdc++ -Wl,-Bstatic -lwinpthread -Wl,-Bdynamic)
    # Target Windows 10 so the high-DPI APIs are declared (MSVC does this by default).
    target_compile_definitions(${PROJECT_NAME} PRIVATE _WIN32_WINNT=0x0A00 WINVER=0x0A00 NTDDI_VERSION=0x0A000006)
    add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different "${WEBVIEW2_LIBRARY}" $<TARGET_FILE_DIR:${PROJECT_NAME}>
    )
else()
    target_link_libraries(${PROJECT_NAME} PRIVATE
            gdiplus.lib
            dwmapi.lib
            Shcore.lib
            Msimg32.lib
            winhttp.lib
            shlwapi.lib
            nlohmann_json::nlohmann_json
            unofficial::webview2::webview2
            OpenSSL::SSL
            OpenSSL::Crypto
            CURL::libcurl
            ${MPV_LIBRARY}
            ${DISCORD_LIB}
    )
endif()

target_compile_definitions(${PROJECT_NAME} PRIVATE DEBUG_LOG)

# Copy MPV DLL
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${MPV_DLL}"
        $<TARGET_FILE_DIR:${PROJECT_NAME}>
)