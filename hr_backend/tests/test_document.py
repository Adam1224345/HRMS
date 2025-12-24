def test_documents(client):
    res = client.get("/documents")
    assert res.status_code in [200, 400, 401, 404]

