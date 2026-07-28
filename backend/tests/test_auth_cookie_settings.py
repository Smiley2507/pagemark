from app.routers import auth


def test_auth_cookies_are_not_secure_for_local_http(monkeypatch):
    monkeypatch.setattr(auth.settings, "FRONTEND_URL", "http://127.0.0.1:5175")
    monkeypatch.setattr(auth.settings, "BACKEND_URL", "http://127.0.0.1:8000")

    assert auth._auth_cookie_kwargs() == {
        "httponly": True,
        "secure": False,
        "samesite": "lax",
    }


def test_auth_cookies_are_secure_for_https(monkeypatch):
    monkeypatch.setattr(auth.settings, "FRONTEND_URL", "https://app.example.com")
    monkeypatch.setattr(auth.settings, "BACKEND_URL", "https://api.example.com")

    assert auth._auth_cookie_kwargs() == {
        "httponly": True,
        "secure": True,
        "samesite": "none",
    }
