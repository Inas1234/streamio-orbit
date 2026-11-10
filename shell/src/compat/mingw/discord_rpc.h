// MinGW build: Discord Rich Presence is off. The upstream discord-rpc library only ships as an
// MSVC static .lib (and isn't in the repo), so this header keeps the same API as no-ops.
#pragma once
#include <cstdint>

typedef struct DiscordUser {
    const char* userId;
    const char* username;
    const char* discriminator;
    const char* avatar;
} DiscordUser;

typedef struct DiscordEventHandlers {
    void (*ready)(const DiscordUser* request);
    void (*disconnected)(int errorCode, const char* message);
    void (*errored)(int errorCode, const char* message);
    void (*joinGame)(const char* joinSecret);
    void (*spectateGame)(const char* spectateSecret);
    void (*joinRequest)(const DiscordUser* request);
} DiscordEventHandlers;

#define DISCORD_ACTIVITY_TYPE_PLAYING 0
#define DISCORD_ACTIVITY_TYPE_LISTENING 2
#define DISCORD_ACTIVITY_TYPE_WATCHING 3

typedef struct DiscordRichPresence {
    int type;
    const char* state;
    const char* details;
    int64_t startTimestamp;
    int64_t endTimestamp;
    const char* largeImageKey;
    const char* largeImageText;
    const char* smallImageKey;
    const char* smallImageText;
    const char* partyId;
    int partySize;
    int partyMax;
    const char* matchSecret;
    const char* joinSecret;
    const char* spectateSecret;
    const char* button1Label;
    const char* button1Url;
    const char* button2Label;
    const char* button2Url;
    int8_t instance;
} DiscordRichPresence;

inline void Discord_Initialize(const char*, DiscordEventHandlers*, int, const char*) {}
inline void Discord_Shutdown() {}
inline void Discord_RunCallbacks() {}
inline void Discord_UpdatePresence(const DiscordRichPresence*) {}
inline void Discord_ClearPresence() {}
