// utils/payfastUtils.js
import crypto from "crypto";
import querystring from "querystring";

export const generateSignature = (params, passphrase = "") => {
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const stringToSign = passphrase
    ? `${queryString}&passphrase=${passphrase}`
    : queryString;

  return crypto.createHash("md5").update(stringToSign).digest("hex");
};

export const validateIPNSignature = (ipnData, passphrase = "") => {
  const signature = ipnData.signature;
  delete ipnData.signature;

  const params = querystring.stringify(ipnData);
  const stringToCheck = passphrase
    ? `${params}&passphrase=${passphrase}`
    : params;

  const hash = crypto.createHash("md5").update(stringToCheck).digest("hex");
  return hash === signature;
};
