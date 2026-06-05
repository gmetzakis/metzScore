import asyncio
import websockets
import json
import time

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

MATCH_ID = "86861661"  # from your screenshot

def frame(msg: str) -> str:
    return msg + "\x1e"

async def main():
    print("Connecting…")

    async with websockets.connect(
        WS_URL,
        additional_headers=HEADERS
    ) as ws:

        print("Connected!")

        # 1) Send handshake
        await ws.send(frame(json.dumps({"protocol": "json", "version": 1})))

        # 2) Send empty frame
        #await ws.send("{}")
        time.sleep(1)  # wait a bit before sending the subscribe message

        # 3) Send Subscribe message
        subscribe_msg = {
            "arguments": [MATCH_ID],
            "invocationId": "0",
            "target": "Subscribe",
            "type": 1
        }
        await ws.send(frame(json.dumps(subscribe_msg)))

        print("Subscribed to match", MATCH_ID)

        # 4) Receive messages
        while True:
            msg = await ws.recv()
            print(msg, "\n")

asyncio.run(main())
