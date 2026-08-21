export function getVastaRtcConfiguration(): RTCConfiguration {
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }

  return { iceServers };
}
