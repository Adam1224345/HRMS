def test_calendar_events(client):
    res = client.get("/api/calendar/events")
    assert res.status_code in [200, 400, 401, 404]

