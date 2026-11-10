// MinGW build: the SDK's WebView2EnvironmentOptions.h is built on WRL's RuntimeClass, which
// MinGW doesn't have. This replacement provides the same CoreWebView2EnvironmentOptions class.
#pragma once
#include <WebView2.h>
#include "wv2_compat.h"
