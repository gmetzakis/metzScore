import fetch from "node-fetch";
import CryptoJS from "crypto-js";

const CLIENT_ID = "501a0202193e045569d09029e55c893c";
const LICENSING_URL = `https://widgets.sir.sportradar.com/${CLIENT_ID}/licensing`;

async function fetchLicensing() {
  // console.log("Fetching licensing from:", LICENSING_URL);

  const res = await fetch(LICENSING_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json,text/plain,*/*",
      "referer": "https://www.stoiximan.gr/",
      "origin": "https://www.stoiximan.gr",
    },
  });

  const text = await res.text();
  // console.log("Raw licensing response:", text, "...");

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (data && typeof data === "object" && "text" in data) {
    return data.text;
  }

  return data;
}

function decryptLicensingBlob(encrypted, clientId) {
  // console.log("Decrypting licensing blob with clientId:", clientId);

  const decrypted = CryptoJS.AES.decrypt(encrypted, clientId);
  const utf8 = decrypted.toString(CryptoJS.enc.Utf8);

  // console.log("Decrypted licensing JSON:", utf8.slice(0, 200), "...");

  const json = JSON.parse(utf8);
  return json;
}

function extractFnToken(licJson) {
  if (!licJson || !licJson.fishnetToken) {
    throw new Error("fishnetToken not found in licensing JSON");
  }

  const tokenObj = licJson.fishnetToken;

  if (typeof tokenObj === "string") {
    return tokenObj;
  }

  if (tokenObj.token) {
    return tokenObj.token;
  }

  throw new Error("Unexpected fishnetToken format");
}

function buildFnFeedUrl(baseUrl, token, feedPath) {
  const T = encodeURIComponent(token);
  return `${baseUrl}/${feedPath}?T=${T}`;
}

(async () => {
  try {
    const licensingBlob = await fetchLicensing();

    const licJson = decryptLicensingBlob(licensingBlob, CLIENT_ID);

    const fnToken = extractFnToken(licJson);

    console.log("FN TOKEN:", fnToken);

    const baseUrl =
      licJson.fishnetFeedsUrl || "https://widgets.fn.sportradar.com";
    const clientAlias =
      licJson.fishnetClientAlias || "common";

    // console.log("fishnetFeedsUrl:", baseUrl);
    // console.log("fishnetClientAlias:", clientAlias);

    const feedPath = `${clientAlias}/en/Etc:UTC/gismo/match_timelinedelta/12345`;
    const fnUrl = buildFnFeedUrl(baseUrl, fnToken, feedPath);

    // console.log("Example FN feed URL:");
    // console.log(fnUrl);
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
