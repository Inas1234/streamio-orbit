// MinGW stand-ins for the WRL pieces the shell uses with WebView2:
//   Microsoft::WRL::Callback<Handler>(lambda)  - a COM object whose Invoke() calls the lambda
//   CoreWebView2EnvironmentOptions               - the SDK's options class (which needs full WRL)
//   Microsoft::WRL::Make<CoreWebView2EnvironmentOptions>()
#pragma once
#include <wrl/client.h>
#include <atomic>
#include <string>
#include <type_traits>
#include <utility>
#include "wv2_iids.h"

namespace wv2compat {

// Handler<I, F, &I::Invoke's type>: implements I by forwarding Invoke(...) to F.
template <class I, class F, class Sig> class Handler;
template <class I, class F, class... A>
class Handler<I, F, HRESULT (STDMETHODCALLTYPE I::*)(A...)> : public I {
public:
    explicit Handler(F f) : m_f(std::move(f)) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** out) override {
        if (!out) return E_POINTER;
        if (IsEqualIID(riid, IID_IUnknown) || IsEqualIID(riid, iid_of<I>())) {
            *out = static_cast<I*>(this);
            AddRef();
            return S_OK;
        }
        *out = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++m_refs; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG left = --m_refs;
        if (left == 0) delete this;
        return left;
    }
    HRESULT STDMETHODCALLTYPE Invoke(A... args) override { return m_f(args...); }

private:
    virtual ~Handler() = default;
    F m_f;
    std::atomic<ULONG> m_refs{1};
};

} // namespace wv2compat

namespace Microsoft::WRL {

template <class I, class F>
ComPtr<I> Callback(F&& f) {
    using H = wv2compat::Handler<I, std::decay_t<F>, decltype(&I::Invoke)>;
    ComPtr<I> out;
    out.Attach(new H(std::forward<F>(f)));
    return out;
}

} // namespace Microsoft::WRL

// --- Environment options -------------------------------------------------------------

#ifndef CORE_WEBVIEW_TARGET_PRODUCT_VERSION
#define CORE_WEBVIEW_TARGET_PRODUCT_VERSION L"156.0.4314.35"
#endif

class CoreWebView2EnvironmentOptions final : public ICoreWebView2EnvironmentOptions,
                                             public ICoreWebView2EnvironmentOptions5,
                                             public ICoreWebView2EnvironmentOptions6 {
public:
    // IUnknown
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** out) override {
        if (!out) return E_POINTER;
        if (IsEqualIID(riid, IID_IUnknown) || IsEqualIID(riid, IID_ICoreWebView2EnvironmentOptions))
            *out = static_cast<ICoreWebView2EnvironmentOptions*>(this);
        else if (IsEqualIID(riid, IID_ICoreWebView2EnvironmentOptions5))
            *out = static_cast<ICoreWebView2EnvironmentOptions5*>(this);
        else if (IsEqualIID(riid, IID_ICoreWebView2EnvironmentOptions6))
            *out = static_cast<ICoreWebView2EnvironmentOptions6*>(this);
        else { *out = nullptr; return E_NOINTERFACE; }
        AddRef();
        return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++m_refs; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG left = --m_refs;
        if (left == 0) delete this;
        return left;
    }

    // ICoreWebView2EnvironmentOptions
    HRESULT STDMETHODCALLTYPE get_AdditionalBrowserArguments(LPWSTR* v) override { return copy(m_args, v); }
    HRESULT STDMETHODCALLTYPE put_AdditionalBrowserArguments(LPCWSTR v) override { m_args = v ? v : L""; return S_OK; }
    HRESULT STDMETHODCALLTYPE get_Language(LPWSTR* v) override { return copy(m_language, v); }
    HRESULT STDMETHODCALLTYPE put_Language(LPCWSTR v) override { m_language = v ? v : L""; return S_OK; }
    HRESULT STDMETHODCALLTYPE get_TargetCompatibleBrowserVersion(LPWSTR* v) override { return copy(m_version, v); }
    HRESULT STDMETHODCALLTYPE put_TargetCompatibleBrowserVersion(LPCWSTR v) override { m_version = v ? v : L""; return S_OK; }
    HRESULT STDMETHODCALLTYPE get_AllowSingleSignOnUsingOSPrimaryAccount(BOOL* v) override { return out(m_sso, v); }
    HRESULT STDMETHODCALLTYPE put_AllowSingleSignOnUsingOSPrimaryAccount(BOOL v) override { m_sso = v; return S_OK; }

    // ICoreWebView2EnvironmentOptions5
    HRESULT STDMETHODCALLTYPE get_EnableTrackingPrevention(BOOL* v) override { return out(m_tracking, v); }
    HRESULT STDMETHODCALLTYPE put_EnableTrackingPrevention(BOOL v) override { m_tracking = v; return S_OK; }

    // ICoreWebView2EnvironmentOptions6
    HRESULT STDMETHODCALLTYPE get_AreBrowserExtensionsEnabled(BOOL* v) override { return out(m_extensions, v); }
    HRESULT STDMETHODCALLTYPE put_AreBrowserExtensionsEnabled(BOOL v) override { m_extensions = v; return S_OK; }

private:
    ~CoreWebView2EnvironmentOptions() = default;

    static HRESULT copy(const std::wstring& s, LPWSTR* v) {
        if (!v) return E_POINTER;
        size_t bytes = (s.size() + 1) * sizeof(wchar_t);
        *v = static_cast<LPWSTR>(CoTaskMemAlloc(bytes));
        if (!*v) return E_OUTOFMEMORY;
        memcpy(*v, s.c_str(), bytes);
        return S_OK;
    }
    static HRESULT out(BOOL b, BOOL* v) {
        if (!v) return E_POINTER;
        *v = b;
        return S_OK;
    }

    std::atomic<ULONG> m_refs{1};
    std::wstring m_args;
    std::wstring m_language;
    std::wstring m_version = CORE_WEBVIEW_TARGET_PRODUCT_VERSION;
    BOOL m_sso = FALSE;
    BOOL m_tracking = TRUE;
    BOOL m_extensions = FALSE;
};

namespace Microsoft::WRL {
template <class T>
ComPtr<T> Make();

template <>
inline ComPtr<CoreWebView2EnvironmentOptions> Make<CoreWebView2EnvironmentOptions>() {
    ComPtr<CoreWebView2EnvironmentOptions> p;
    p.Attach(new CoreWebView2EnvironmentOptions());
    return p;
}
} // namespace Microsoft::WRL
