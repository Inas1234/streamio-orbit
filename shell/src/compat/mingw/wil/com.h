// MinGW stand-in for the part of WIL's <wil/com.h> the shell uses: wil::com_ptr<T>.
// Supports get(), operator->, operator& (put), try_query<U>(), detach(), reset() and copying.
#pragma once
#include <unknwn.h>
#include <memory>
#include <objbase.h>
#include <utility>
#include "../wv2_iids.h"

namespace wil {

template <class T>
class com_ptr {
public:
    com_ptr() noexcept = default;
    com_ptr(std::nullptr_t) noexcept {}
    com_ptr(T* p) noexcept : m_ptr(p) { if (m_ptr) m_ptr->AddRef(); }
    com_ptr(const com_ptr& other) noexcept : com_ptr(other.m_ptr) {}
    com_ptr(com_ptr&& other) noexcept : m_ptr(std::exchange(other.m_ptr, nullptr)) {}
    ~com_ptr() { reset(); }

    com_ptr& operator=(const com_ptr& other) noexcept {
        if (this != std::addressof(other)) { com_ptr tmp(other); swap(tmp); }
        return *this;
    }
    com_ptr& operator=(com_ptr&& other) noexcept {
        if (this != std::addressof(other)) { reset(); m_ptr = std::exchange(other.m_ptr, nullptr); }
        return *this;
    }
    com_ptr& operator=(T* p) noexcept { com_ptr tmp(p); swap(tmp); return *this; }
    com_ptr& operator=(std::nullptr_t) noexcept { reset(); return *this; }

    T* get() const noexcept { return m_ptr; }
    T* operator->() const noexcept { return m_ptr; }
    explicit operator bool() const noexcept { return m_ptr != nullptr; }

    /// Releases the current pointer and returns the slot for an out-parameter.
    T** put() noexcept { reset(); return &m_ptr; }
    T** operator&() noexcept { return put(); }

    void reset() noexcept { if (m_ptr) { m_ptr->Release(); m_ptr = nullptr; } }
    T* detach() noexcept { return std::exchange(m_ptr, nullptr); }
    void swap(com_ptr& other) noexcept { std::swap(m_ptr, other.m_ptr); }

    template <class U>
    com_ptr<U> try_query() const noexcept {
        com_ptr<U> out;
        if (m_ptr) m_ptr->QueryInterface(wv2compat::iid_of<U>(), reinterpret_cast<void**>(out.put()));
        return out;
    }

private:
    T* m_ptr = nullptr;
};

/// A CoTaskMemAlloc'd string (as returned by WebView2 getters), freed automatically.
class unique_cotaskmem_string {
public:
    unique_cotaskmem_string() noexcept = default;
    unique_cotaskmem_string(const unique_cotaskmem_string&) = delete;
    unique_cotaskmem_string& operator=(const unique_cotaskmem_string&) = delete;
    unique_cotaskmem_string(unique_cotaskmem_string&& o) noexcept : m_str(std::exchange(o.m_str, nullptr)) {}
    unique_cotaskmem_string& operator=(unique_cotaskmem_string&& o) noexcept {
        if (this != std::addressof(o)) { reset(); m_str = std::exchange(o.m_str, nullptr); }
        return *this;
    }
    ~unique_cotaskmem_string() { reset(); }

    LPWSTR get() const noexcept { return m_str; }
    LPWSTR* put() noexcept { reset(); return &m_str; }
    LPWSTR* operator&() noexcept { return put(); }
    explicit operator bool() const noexcept { return m_str != nullptr; }
    void reset() noexcept { if (m_str) { CoTaskMemFree(m_str); m_str = nullptr; } }
    LPWSTR release() noexcept { return std::exchange(m_str, nullptr); }

private:
    LPWSTR m_str = nullptr;
};

} // namespace wil
