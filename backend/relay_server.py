import asyncio
import websockets
import json
import time
from urllib.parse import urlparse, parse_qs

WS_URL = "wss://www.stoiximan.gr/sbpitches/statsstream/matchhub"

HEADERS = [
    ("Origin", "https://www.stoiximan.gr"),
    ("Cache-Control", "no-cache"),
    ("Pragma", "no-cache"),
    ("Accept-Language", "en-US,en;q=0.9"),
    ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"),
    ("Cookie",
     "sticky_sb=b4698936772ef7cb7c0036c6b2ceff43; "
     "cntps_id=e4bb54b6a0150477e0c0a4929a4c6ebf; "
     "sb_landing=true; "
     "cf_clearance=vqjPyXFNl7ozwUHAD0QfJ._9pbQ9VBUP97Cyqwy4T8w-1780332511-1.2.1.1-1yi9xfpMYi1noy4whY3r9lU8RWLdwgtR1x6vw9uhfzaPCy3.OWeEZhYdL3XGXu_3srh7Xdh34mKPCA.45sYqam_TJTxCIrrX0U0k1T53MmM6qZQyJ6hxytlLl2fVHFZhgPffXN5cFWX6rnR2ZEFy6NTR.MJMpT3S6kEZa3FGu0V3Lk.PIMZqOB2FdlP7Z3DrNDNIhy6No5Tjo7LOpkdyf79.pZlxK8tdFcq_4l61mNZS5QgxkKalNXXJh4iwWTTs47n3zJPkju9FfUhdUQ3938WgAQooC952HdxoANMdhEGJIUYZS7zFmd1aE2cwbDxTvwhzVov5g.Fvxeyhwr8z.g; "
     "_lr_hb_-7hhr6m/stoiximangr={\"heartbeat\":1780334272205}; "
     "__cf_bm=Y1PPo.JIHBOaxbOgHR0Yvab6olkDeeuMVQBOVJ.3qqE-1780334289-1.0.1.1-_T8c4uDpd4TCOaddt0QlpX_ipVYBnPjgDo4wqGKQFo2gRIdqucr.pjYlgGMs_VFcZsw.GAQjVq2bcjEf0WVJghq4F1JtGTm.MXxozgABttI; "
     "_lr_tabs_-7hhr6m/stoiximangr={\"recordingID\":\"6-019e8404-f9c7-7db1-8f0f-a522061516d9\",\"sessionID\":0,\"lastActivity\":1780334289612,\"hasActivity\":true,\"confirmed\":false,\"recordingConditionThreshold\":2.8955243268810826,\"clearsIdentifiedUser\":false}; "
     "_cfuvid=UCfd.nTTuJt8HJVDh_lXqttsbhVWHXA_UtxnXIBxUek-1780334290.687037-1.0.1.1-ynDDiQ.HWlPeQ1EmNmqalYtG_x6hm8Ff2USiZQoXm3o"
     )
]

# matchId → set of frontend clients
match_clients = {}

# matchId → vendor websocket task
vendor_tasks = {}

def frame(msg: str) -> str:
    return msg + "\x1e"


async def broadcast(match_id, message):
    """Send vendor message to all frontend clients watching this match."""
    if match_id not in match_clients:
        return

    dead = []
    for ws in match_clients[match_id]:
        try:
            await ws.send(message)
        except:
            dead.append(ws)

    for ws in dead:
        match_clients[match_id].remove(ws)


async def vendor_loop(match_id):
    """Connect to vendor and stream messages for this match."""
    print(f"[Vendor] Connecting for match {match_id}")

    async with websockets.connect(
        WS_URL,
        additional_headers=HEADERS
    ) as ws:

        print(f"[Vendor] Connected for match {match_id}")

        await ws.send(frame(json.dumps({"protocol": "json", "version": 1})))
        time.sleep(1)

        subscribe_msg = {
            "arguments": [match_id],
            "invocationId": "0",
            "target": "Subscribe",
            "type": 1
        }
        await ws.send(frame(json.dumps(subscribe_msg)))

        print(f"[Vendor] Subscribed to match {match_id}")

        while True:
            msg = await ws.recv()
            await broadcast(match_id, msg)


async def frontend_handler(websocket):
    """Handle frontend connections and assign them to a match."""
    # websockets v12: path is inside websocket.path
    path = websocket.request.path
    query = urlparse(path).query
    params = parse_qs(query)
    match_id = params.get("matchId", [None])[0]

    if match_id is None:
        await websocket.send("ERROR: matchId missing")
        await websocket.close()
        return

    print(f"[Frontend] Client connected for match {match_id}")

    # Register client
    match_clients.setdefault(match_id, set()).add(websocket)

    # Start vendor task if not running
    if match_id not in vendor_tasks:
        vendor_tasks[match_id] = asyncio.create_task(vendor_loop(match_id))

    try:
        while True:
            await websocket.recv()  # ignore messages
    except:
        pass
    finally:
        match_clients[match_id].remove(websocket)
        print(f"[Frontend] Client disconnected from match {match_id}")


async def main():
    server = await websockets.serve(frontend_handler, "0.0.0.0", 8765)
    print("Frontend WebSocket server running on ws://localhost:8765")
    await server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())
