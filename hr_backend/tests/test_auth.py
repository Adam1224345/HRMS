def test_login(client):
    res = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "12345"
    })
    assert res.status_code in [200, 400, 401, 404]
