// MinGW support: maps WebView2 interface types to their IIDs.
// MSVC gets this from __declspec(uuid); GCC ignores that, but WebView2.h also defines IID_<Name>
// constants, so each interface the shell queries or implements gets a one-line mapping here.
#pragma once
#include <WebView2.h>

namespace wv2compat {
template <class I> const IID& iid_of();
}

#define WV2_IID(I) \
    template <> inline const IID& wv2compat::iid_of<I>() { return IID_##I; }

// Interfaces the shell queries for.
WV2_IID(ICoreWebView2Controller4)
WV2_IID(ICoreWebView2_21)
WV2_IID(ICoreWebView2Profile8)
WV2_IID(ICoreWebView2Settings8)
WV2_IID(ICoreWebView2EnvironmentOptions)
WV2_IID(ICoreWebView2EnvironmentOptions5)
WV2_IID(ICoreWebView2EnvironmentOptions6)

// Handlers the shell implements with Callback<>.
WV2_IID(ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler)
WV2_IID(ICoreWebView2CreateCoreWebView2ControllerCompletedHandler)
WV2_IID(ICoreWebView2NavigationCompletedEventHandler)
WV2_IID(ICoreWebView2ContentLoadingEventHandler)
WV2_IID(ICoreWebView2DOMContentLoadedEventHandler)
WV2_IID(ICoreWebView2ContextMenuRequestedEventHandler)
WV2_IID(ICoreWebView2WebMessageReceivedEventHandler)
WV2_IID(ICoreWebView2NewWindowRequestedEventHandler)
WV2_IID(ICoreWebView2NavigationStartingEventHandler)
WV2_IID(ICoreWebView2ContainsFullScreenElementChangedEventHandler)
WV2_IID(ICoreWebView2ProfileAddBrowserExtensionCompletedHandler)
WV2_IID(ICoreWebView2ClearBrowsingDataCompletedHandler)
WV2_IID(ICoreWebView2WebResourceRequestedEventHandler)
