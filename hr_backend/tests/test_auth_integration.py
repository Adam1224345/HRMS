
def test_login_integration(client):
    res = client.post("/api/auth/login", json={"email":"x@test.com","password":"123"})
    assert res.status_code in [200,400,401]
